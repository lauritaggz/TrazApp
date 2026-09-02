"""T02-08 versioned product formulation model tests."""

from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import (
    FormulacionVersionProducto,
    Ingrediente,
    Producto,
    Productor,
    VersionProducto,
)


def _create_productor(session, email: str = "form@ejemplo.com") -> Productor:
    productor = Productor(
        nombre="Productor formulación",
        email=email,
        password_hash="hash",
        activo=True,
    )
    session.add(productor)
    session.commit()
    session.refresh(productor)
    return productor


def _create_version_producto(
    session,
    *,
    productor_id: int | None = None,
    descripcion: str = "Formulación base",
) -> tuple[Producto, VersionProducto]:
    producto = Producto(
        nombre="Pan integral",
        activo=True,
        productor_id=productor_id,
    )
    session.add(producto)
    session.commit()
    session.refresh(producto)

    version = VersionProducto(
        producto_id=producto.id,
        numero_version=1,
        descripcion=descripcion,
        vigente=True,
    )
    session.add(version)
    session.commit()
    session.refresh(version)
    return producto, version


def _create_ingrediente(
    session,
    productor_id: int | None,
    *,
    codigo: str = "HAR-001",
    nombre: str = "Harina de trigo",
    tipo: str | None = "simple",
) -> Ingrediente:
    ingrediente = Ingrediente(
        productor_id=productor_id,
        codigo_interno=codigo,
        nombre=nombre,
        tipo=tipo,
        activo=True,
    )
    session.add(ingrediente)
    session.commit()
    session.refresh(ingrediente)
    return ingrediente


def _create_linea_formulacion(
    session,
    version: VersionProducto,
    ingrediente: Ingrediente,
    **kwargs: object,
) -> FormulacionVersionProducto:
    linea = FormulacionVersionProducto(
        version_producto_id=version.id,
        ingrediente_id=ingrediente.id,
        ingrediente_nombre=ingrediente.nombre,
        ingrediente_codigo_interno=ingrediente.codigo_interno,
        ingrediente_tipo=ingrediente.tipo,
        **kwargs,
    )
    session.add(linea)
    session.commit()
    session.refresh(linea)
    return linea


def test_formulacion_valida_con_porcentaje(db_session) -> None:
    productor = _create_productor(db_session, email="pct@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id)

    linea = _create_linea_formulacion(
        db_session,
        version,
        harina,
        porcentaje=Decimal("62.500"),
        orden=1,
        notas="Tamizada",
    )

    assert linea.id is not None
    assert linea.porcentaje == Decimal("62.500")
    assert linea.cantidad is None
    assert linea.unidad is None
    assert linea.orden == 1
    assert linea.notas == "Tamizada"
    assert linea.ingrediente_nombre == "Harina de trigo"
    assert linea.ingrediente_codigo_interno == "HAR-001"
    assert linea.ingrediente_tipo == "simple"


def test_formulacion_valida_con_cantidad_y_unidad(db_session) -> None:
    productor = _create_productor(db_session, email="qty@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    agua = _create_ingrediente(
        db_session,
        productor.id,
        codigo="AGU-001",
        nombre="Agua",
    )

    linea = _create_linea_formulacion(
        db_session,
        version,
        agua,
        cantidad=Decimal("250.000"),
        unidad="ml",
        orden=2,
    )

    assert linea.porcentaje is None
    assert linea.cantidad == Decimal("250.000")
    assert linea.unidad == "ml"


def test_relacion_version_producto_formulacion(db_session) -> None:
    productor = _create_productor(db_session, email="rel-vp@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-002", nombre="Harina")
    agua = _create_ingrediente(db_session, productor.id, codigo="AGU-002", nombre="Agua")

    _create_linea_formulacion(
        db_session,
        version,
        harina,
        porcentaje=Decimal("70.000"),
        orden=1,
    )
    _create_linea_formulacion(
        db_session,
        version,
        agua,
        porcentaje=Decimal("30.000"),
        orden=2,
    )
    db_session.refresh(version)

    assert len(version.formulacion) == 2
    assert [item.orden for item in version.formulacion] == [1, 2]
    assert version.formulacion[0].ingrediente.nombre == "Harina"


def test_relacion_ingrediente_formulacion(db_session) -> None:
    productor = _create_productor(db_session, email="rel-ing@ejemplo.com")
    _, version_a = _create_version_producto(
        db_session,
        productor_id=productor.id,
        descripcion="VP A",
    )
    _, version_b = _create_version_producto(
        db_session,
        productor_id=productor.id,
        descripcion="VP B",
    )
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-003", nombre="Harina común")

    _create_linea_formulacion(
        db_session,
        version_a,
        harina,
        porcentaje=Decimal("50.000"),
        orden=1,
    )
    _create_linea_formulacion(
        db_session,
        version_b,
        harina,
        porcentaje=Decimal("40.000"),
        orden=1,
    )
    db_session.refresh(harina)

    assert len(harina.formulaciones_producto) == 2
    assert {linea.version_producto_id for linea in harina.formulaciones_producto} == {
        version_a.id,
        version_b.id,
    }


def test_duplicado_ingrediente_misma_version(db_session) -> None:
    productor = _create_productor(db_session, email="dup@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-DUP", nombre="Harina")

    _create_linea_formulacion(
        db_session,
        version,
        harina,
        porcentaje=Decimal("60.000"),
        orden=1,
    )

    db_session.add(
        FormulacionVersionProducto(
            version_producto_id=version.id,
            ingrediente_id=harina.id,
            ingrediente_nombre=harina.nombre,
            ingrediente_codigo_interno=harina.codigo_interno,
            ingrediente_tipo=harina.tipo,
            porcentaje=Decimal("10.000"),
            orden=2,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    "porcentaje",
    [Decimal("0.000"), Decimal("100.001"), Decimal("-5.000")],
)
def test_porcentaje_invalido(db_session, porcentaje: Decimal) -> None:
    productor = _create_productor(db_session, email=f"pct-{porcentaje}@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-PCT", nombre="Harina")

    db_session.add(
        FormulacionVersionProducto(
            version_producto_id=version.id,
            ingrediente_id=harina.id,
            ingrediente_nombre=harina.nombre,
            porcentaje=porcentaje,
            orden=1,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize("cantidad", [Decimal("0.000"), Decimal("-1.000")])
def test_cantidad_invalida(db_session, cantidad: Decimal) -> None:
    productor = _create_productor(db_session, email=f"qty-{cantidad}@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    agua = _create_ingrediente(db_session, productor.id, codigo="AGU-QTY", nombre="Agua")

    db_session.add(
        FormulacionVersionProducto(
            version_producto_id=version.id,
            ingrediente_id=agua.id,
            ingrediente_nombre=agua.nombre,
            cantidad=cantidad,
            unidad="ml",
            orden=1,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_rechaza_cantidad_sin_unidad(db_session) -> None:
    productor = _create_productor(db_session, email="sin-unidad@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    agua = _create_ingrediente(db_session, productor.id, codigo="AGU-SU", nombre="Agua")

    db_session.add(
        FormulacionVersionProducto(
            version_producto_id=version.id,
            ingrediente_id=agua.id,
            ingrediente_nombre=agua.nombre,
            cantidad=Decimal("10.000"),
            orden=1,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_rechaza_orden_invalido(db_session) -> None:
    productor = _create_productor(db_session, email="orden@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-ORD", nombre="Harina")

    db_session.add(
        FormulacionVersionProducto(
            version_producto_id=version.id,
            ingrediente_id=harina.id,
            ingrediente_nombre=harina.nombre,
            porcentaje=Decimal("50.000"),
            orden=0,
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_version_existente_sin_formulacion_sigue_siendo_valida(db_session) -> None:
    producto = Producto(nombre="Producto legacy", activo=True)
    db_session.add(producto)
    db_session.commit()
    db_session.refresh(producto)

    version = VersionProducto(
        producto_id=producto.id,
        numero_version=1,
        descripcion="Solo texto libre",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)

    assert version.descripcion == "Solo texto libre"
    assert version.formulacion == []


def test_compatibilidad_rt01_version_sin_formulacion(db_session) -> None:
    """RT-01 versions with only descripcion remain valid without formulation lines."""
    producto = Producto(nombre="Chocolate", activo=True)
    db_session.add(producto)
    db_session.commit()

    version = VersionProducto(
        producto_id=producto.id,
        numero_version=1,
        descripcion="Formulación original",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)

    assert producto.productor_id is None
    assert len(version.formulacion) == 0
    assert version.descripcion == "Formulación original"


def test_snapshot_preserva_nombre_aunque_ingrediente_cambie(db_session) -> None:
    productor = _create_productor(db_session, email="snap@ejemplo.com")
    _, version = _create_version_producto(db_session, productor_id=productor.id)
    harina = _create_ingrediente(db_session, productor.id, codigo="HAR-SNAP", nombre="Harina v1")

    linea = _create_linea_formulacion(
        db_session,
        version,
        harina,
        porcentaje=Decimal("100.000"),
        orden=1,
    )

    harina.nombre = "Harina v2 renombrada"
    db_session.commit()
    db_session.refresh(linea)

    assert linea.ingrediente_nombre == "Harina v1"
    assert linea.ingrediente.nombre == "Harina v2 renombrada"
