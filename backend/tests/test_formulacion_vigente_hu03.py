"""HU03 / T03-02: current product formulation and automatic versioning (service layer)."""

import threading
import time
from decimal import Decimal

import pytest
from pydantic import ValidationError
from sqlalchemy import select, update

from app.models import (
    FormulacionVersionProducto,
    Ingrediente,
    Producto,
    Productor,
    VersionProducto,
)
from app.repositories.ingrediente_repository import IngredienteRepository
from app.repositories.producto_formulacion_repository import ProductoFormulacionRepository
from app.repositories.producto_repository import ProductoRepository
from app.schemas.producto import FormulacionLineaInput, FormulacionReemplazo
from app.services.ingrediente_service import IngredienteNotFoundError
from app.services.producto_formulacion_service import (
    FormulacionConflictError,
    InvalidFormulacionError,
    ProductoFormulacionService,
)
from app.services.producto_service import ProductoNotFoundError
from tests.conftest import USE_POSTGRESQL, TestingSessionLocal


def _service(session) -> ProductoFormulacionService:
    return ProductoFormulacionService(
        ProductoFormulacionRepository(session),
        ProductoRepository(session),
        IngredienteRepository(session),
    )


def _productor(session, email: str = "hu03@ejemplo.com") -> Productor:
    productor = Productor(nombre="Productor HU03", email=email, password_hash="hash", activo=True)
    session.add(productor)
    session.commit()
    return productor


def _producto(session, productor: Productor, nombre: str = "Pan amasado") -> Producto:
    producto = Producto(nombre=nombre, productor_id=productor.id, activo=True)
    session.add(producto)
    session.commit()
    return producto


def _ingrediente(session, productor: Productor, codigo: str, nombre: str) -> Ingrediente:
    ingrediente = Ingrediente(
        productor_id=productor.id,
        codigo_interno=codigo,
        nombre=nombre,
        activo=True,
    )
    session.add(ingrediente)
    session.commit()
    return ingrediente


def _payload(*lineas: tuple) -> FormulacionReemplazo:
    """Each line is (ingrediente, cantidad, unidad) or (ingrediente,)."""
    items = []
    for linea in lineas:
        ingrediente, *cuantificacion = linea
        cantidad, unidad = cuantificacion if cuantificacion else (None, None)
        items.append(
            FormulacionLineaInput(
                ingrediente_id=ingrediente.id,
                cantidad=cantidad,
                unidad=unidad,
            )
        )
    return FormulacionReemplazo(lineas=items)


def _versiones(session, producto: Producto) -> list[VersionProducto]:
    session.expire_all()
    return list(
        session.scalars(
            select(VersionProducto)
            .where(VersionProducto.producto_id == producto.id)
            .order_by(VersionProducto.numero_version)
        )
    )


def _lineas(session, version_id: int) -> list[tuple]:
    session.expire_all()
    return [
        (l.ingrediente_id, l.ingrediente_nombre, l.cantidad, l.unidad, l.orden)
        for l in session.scalars(
            select(FormulacionVersionProducto)
            .where(FormulacionVersionProducto.version_producto_id == version_id)
            .order_by(FormulacionVersionProducto.orden)
        )
    ]


def _marcar_usada(session, version_id: int) -> None:
    _service(session).marcar_version_usada(version_id)
    session.commit()


@pytest.fixture
def escenario(db_session):
    productor = _productor(db_session)
    return {
        "productor": productor,
        "producto": _producto(db_session, productor),
        "harina": _ingrediente(db_session, productor, "HAR", "Harina"),
        "agua": _ingrediente(db_session, productor, "AGU", "Agua"),
        "sal": _ingrediente(db_session, productor, "SAL", "Sal"),
    }


def _guardar(db_session, escenario, payload: FormulacionReemplazo):
    return _service(db_session).reemplazar_formulacion_mine(
        escenario["productor"], escenario["producto"].id, payload
    )


def test_crea_v1_vigente_si_el_producto_no_tiene_version(db_session, escenario) -> None:
    harina, agua = escenario["harina"], escenario["agua"]

    result = _guardar(
        db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,))
    )

    assert result.resultado == "version_creada"
    assert result.version.numero_version == 1
    assert result.version.descripcion == "Versión 1"
    assert result.version.vigente is True
    assert result.version.usada_en_elaboracion is False
    assert [
        (l.ingrediente_id, l.ingrediente_nombre, l.ingrediente_codigo_interno, l.cantidad, l.unidad, l.orden, l.porcentaje)
        for l in result.version.lineas
    ] == [
        (harina.id, "Harina", "HAR", Decimal("500.000"), "g", 1, None),
        (agua.id, "Agua", "AGU", None, None, 2, None),
    ]
    assert len(_versiones(db_session, escenario["producto"])) == 1


def test_modifica_en_el_lugar_si_la_vigente_no_esta_usada(db_session, escenario) -> None:
    harina, agua, sal = escenario["harina"], escenario["agua"], escenario["sal"]
    v1 = _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,))).version
    linea_harina_id = v1.lineas[0].id
    harina.nombre = "Harina integral"
    db_session.commit()

    result = _guardar(
        db_session, escenario, _payload((sal, Decimal("10"), "g"), (harina, Decimal("450"), "g"))
    )

    assert result.resultado == "modificada_en_lugar"
    assert result.version.id == v1.id
    assert result.version.numero_version == 1
    assert _lineas(db_session, v1.id) == [
        (sal.id, "Sal", Decimal("10.000"), "g", 1),
        (harina.id, "Harina integral", Decimal("450.000"), "g", 2),
    ]
    assert next(l.id for l in result.version.lineas if l.ingrediente_id == harina.id) == linea_harina_id
    versiones = _versiones(db_session, escenario["producto"])
    assert [(v.numero_version, v.vigente) for v in versiones] == [(1, True)]


def test_crea_nueva_version_si_la_vigente_esta_usada(db_session, escenario) -> None:
    harina, agua = escenario["harina"], escenario["agua"]
    v1 = _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,))).version
    lineas_v1 = _lineas(db_session, v1.id)
    _marcar_usada(db_session, v1.id)
    harina.nombre = "Harina integral"
    db_session.commit()

    result = _guardar(db_session, escenario, _payload((harina, Decimal("600"), "g")))

    assert result.resultado == "nueva_version"
    assert result.version.id != v1.id
    assert result.version.numero_version == 2
    assert result.version.descripcion == "Versión 2"
    assert result.version.vigente is True
    assert result.version.usada_en_elaboracion is False
    assert _lineas(db_session, result.version.id) == [
        (harina.id, "Harina integral", Decimal("600.000"), "g", 1),
    ]

    anterior = db_session.get(VersionProducto, v1.id)
    assert anterior.vigente is False
    assert anterior.usada_en_elaboracion is True
    assert anterior.descripcion == "Versión 1"
    assert _lineas(db_session, v1.id) == lineas_v1
    assert lineas_v1[0][1] == "Harina"


def test_contenido_identico_no_hace_nada(db_session, escenario) -> None:
    harina, agua = escenario["harina"], escenario["agua"]
    payload = _payload((harina, Decimal("500"), "g"), (agua,))
    v1 = _guardar(db_session, escenario, payload).version

    en_lugar = _guardar(db_session, escenario, _payload((harina, Decimal("500.000"), "g"), (agua,)))
    _marcar_usada(db_session, v1.id)
    usada = _guardar(db_session, escenario, payload)

    assert en_lugar.resultado == "sin_cambios"
    assert usada.resultado == "sin_cambios"
    assert usada.version.id == v1.id
    assert [(v.numero_version, v.vigente) for v in _versiones(db_session, escenario["producto"])] == [
        (1, True)
    ]


def test_reordenar_no_es_cambio_de_receta(db_session, escenario) -> None:
    harina, agua = escenario["harina"], escenario["agua"]
    v1 = _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,))).version

    no_usada = _guardar(db_session, escenario, _payload((agua,), (harina, Decimal("500"), "g")))

    assert no_usada.resultado == "modificada_en_lugar"
    assert no_usada.version.id == v1.id
    assert [(l.ingrediente_id, l.orden) for l in no_usada.version.lineas] == [
        (agua.id, 1),
        (harina.id, 2),
    ]

    _marcar_usada(db_session, v1.id)
    usada = _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,)))

    assert usada.resultado == "sin_cambios"
    assert usada.version.id == v1.id
    assert [(l.ingrediente_id, l.orden) for l in usada.version.lineas] == [
        (agua.id, 1),
        (harina.id, 2),
    ]
    assert [(v.numero_version, v.vigente) for v in _versiones(db_session, escenario["producto"])] == [
        (1, True)
    ]


def test_nunca_quedan_dos_versiones_vigentes(db_session, escenario) -> None:
    harina = escenario["harina"]
    for cantidad in range(1, 5):
        result = _guardar(db_session, escenario, _payload((harina, Decimal(cantidad), "kg")))
        versiones = _versiones(db_session, escenario["producto"])
        vigentes = [v for v in versiones if v.vigente]
        assert len(vigentes) == 1
        assert vigentes[0].id == result.version.id
        assert [v.numero_version for v in versiones] == list(range(1, cantidad + 1))
        _marcar_usada(db_session, result.version.id)


def test_ingrediente_desactivado_en_la_vigente_impide_guardar(db_session, escenario) -> None:
    harina, agua = escenario["harina"], escenario["agua"]
    v1 = _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua,))).version
    lineas_v1 = _lineas(db_session, v1.id)
    harina.activo = False
    db_session.commit()

    with pytest.raises(InvalidFormulacionError, match="«Harina» está desactivado"):
        _guardar(db_session, escenario, _payload((harina, Decimal("500"), "g"), (agua, Decimal("1"), "L")))
    assert _lineas(db_session, v1.id) == lineas_v1

    result = _guardar(db_session, escenario, _payload((agua, Decimal("1"), "L")))
    assert result.resultado == "modificada_en_lugar"
    assert [l.ingrediente_id for l in result.version.lineas] == [agua.id]


def test_rechaza_ingrediente_inactivo_nuevo(db_session, escenario) -> None:
    harina, sal = escenario["harina"], escenario["sal"]
    sal.activo = False
    db_session.commit()

    with pytest.raises(InvalidFormulacionError, match="inactivos"):
        _guardar(db_session, escenario, _payload((harina,), (sal,)))
    assert _versiones(db_session, escenario["producto"]) == []


def test_rechaza_ingrediente_de_otro_productor_o_inexistente(db_session, escenario) -> None:
    otro = _productor(db_session, email="otro-hu03@ejemplo.com")
    ajeno = _ingrediente(db_session, otro, "AJENO", "Harina ajena")

    with pytest.raises(IngredienteNotFoundError):
        _guardar(db_session, escenario, _payload((escenario["harina"],), (ajeno,)))
    with pytest.raises(IngredienteNotFoundError):
        _guardar(
            db_session,
            escenario,
            FormulacionReemplazo(lineas=[FormulacionLineaInput(ingrediente_id=999_999)]),
        )
    assert _versiones(db_session, escenario["producto"]) == []


def test_rechaza_ingrediente_repetido(db_session, escenario) -> None:
    harina = escenario["harina"]

    with pytest.raises(InvalidFormulacionError, match="no puede repetirse"):
        _guardar(db_session, escenario, _payload((harina, Decimal("1"), "kg"), (harina,)))
    assert _versiones(db_session, escenario["producto"]) == []


def test_rechaza_producto_ajeno(db_session, escenario) -> None:
    otro = _productor(db_session, email="ajeno-hu03@ejemplo.com")

    with pytest.raises(ProductoNotFoundError):
        _service(db_session).reemplazar_formulacion_mine(
            otro, escenario["producto"].id, _payload((escenario["harina"],))
        )
    assert _versiones(db_session, escenario["producto"]) == []


@pytest.mark.parametrize(
    "linea",
    [
        {"ingrediente_id": 1, "cantidad": "5"},
        {"ingrediente_id": 1, "unidad": "g"},
        {"ingrediente_id": 1, "porcentaje": "50"},
    ],
)
def test_linea_exige_cantidad_y_unidad_juntas_y_sin_porcentaje(linea: dict) -> None:
    with pytest.raises(ValidationError):
        FormulacionReemplazo.model_validate({"lineas": [linea]})


def test_formulacion_vacia_no_es_valida() -> None:
    with pytest.raises(ValidationError):
        FormulacionReemplazo.model_validate({"lineas": []})


def test_conflicto_de_numero_de_version_revierte_todo(db_session, escenario, monkeypatch) -> None:
    harina = escenario["harina"]
    v1 = _guardar(db_session, escenario, _payload((harina,))).version
    _marcar_usada(db_session, v1.id)
    monkeypatch.setattr(ProductoFormulacionRepository, "next_numero_version", lambda self, _: 1)

    with pytest.raises(FormulacionConflictError, match="al mismo tiempo"):
        _guardar(db_session, escenario, _payload((harina, Decimal("2"), "kg")))

    versiones = _versiones(db_session, escenario["producto"])
    assert [(v.numero_version, v.vigente) for v in versiones] == [(1, True)]


def test_obtener_version_vigente(db_session, escenario) -> None:
    service = _service(db_session)
    productor, producto, harina = escenario["productor"], escenario["producto"], escenario["harina"]

    assert service.obtener_version_vigente(productor, producto.id) is None

    v1 = _guardar(db_session, escenario, _payload((harina,))).version
    assert service.obtener_version_vigente(productor, producto.id).id == v1.id

    _marcar_usada(db_session, v1.id)
    v2 = _guardar(db_session, escenario, _payload((harina, Decimal("1"), "kg"))).version
    assert service.obtener_version_vigente(productor, producto.id).id == v2.id

    otro = _productor(db_session, email="vigente-ajeno@ejemplo.com")
    with pytest.raises(ProductoNotFoundError):
        service.obtener_version_vigente(otro, producto.id)


def test_producto_sin_formulacion_no_tiene_version_para_elaborar(db_session, escenario) -> None:
    """PT03-13: without a current version there is nothing to elaborate.

    The API-level case (creating an elaboración is rejected) is PT05-02, in test_gestion_elaboraciones_hu05.py.
    """
    service = _service(db_session)

    assert service.obtener_version_vigente(escenario["productor"], escenario["producto"].id) is None
    assert _versiones(db_session, escenario["producto"]) == []


@pytest.mark.skipif(not USE_POSTGRESQL, reason="SELECT ... FOR UPDATE requiere PostgreSQL.")
def test_bloqueo_del_producto_serializa_guardados_simultaneos(db_session, escenario) -> None:
    """A save waits for the product lock and then sees the committed state."""
    harina, producto = escenario["harina"], escenario["producto"]
    v1 = _guardar(db_session, escenario, _payload((harina,))).version

    session_a = TestingSessionLocal()
    session_b = TestingSessionLocal()
    resultado: dict = {}
    try:
        session_a.scalar(select(Producto).where(Producto.id == producto.id).with_for_update())

        def guardar_en_b() -> None:
            productor_b = session_b.get(Productor, escenario["productor"].id)
            resultado["guardada"] = _service(session_b).reemplazar_formulacion_mine(
                productor_b, producto.id, _payload((harina, Decimal("3"), "kg"))
            )

        hilo = threading.Thread(target=guardar_en_b)
        hilo.start()
        time.sleep(0.5)
        assert hilo.is_alive(), "El guardado no esperó el bloqueo del producto."

        session_a.execute(
            update(VersionProducto)
            .where(VersionProducto.id == v1.id)
            .values(usada_en_elaboracion=True)
        )
        session_a.commit()
        hilo.join(timeout=10)
        assert not hilo.is_alive()
    finally:
        session_a.close()
        session_b.close()

    assert resultado["guardada"].resultado == "nueva_version"
    versiones = _versiones(db_session, producto)
    assert [(v.numero_version, v.vigente) for v in versiones] == [(1, False), (2, True)]
