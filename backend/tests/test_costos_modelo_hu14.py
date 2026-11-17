"""HU14 cost calculator model tests (T14-02).

Run on SQLite (schema from metadata.create_all) and on PostgreSQL when TEST_DATABASE_URL is set.
The migration itself is covered in test_migracion_019_costos_hu14.py.
"""

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    CantidadIngredienteProducto,
    Ingrediente,
    InsumoComercial,
    OtroCostoProducto,
    Producto,
    Productor,
)

AHORA = datetime(2026, 11, 16, 12, 0, tzinfo=timezone.utc)


def _productor(session: Session) -> Productor:
    existente = session.query(Productor).filter_by(email="costos@ejemplo.com").first()
    if existente is not None:
        return existente
    productor = Productor(nombre="Productora HU14", email="costos@ejemplo.com", password_hash="hash")
    session.add(productor)
    session.commit()
    return productor


def _producto(session: Session, productor: Productor, codigo: str = "QUE-001") -> Producto:
    producto = Producto(productor_id=productor.id, codigo_interno=codigo, nombre=f"Queque {codigo}")
    session.add(producto)
    session.commit()
    return producto


def _ingrediente(session: Session, productor: Productor, nombre: str = "Harina") -> Ingrediente:
    existente = session.query(Ingrediente).filter_by(productor_id=productor.id, nombre=nombre).first()
    if existente is not None:
        return existente
    ingrediente = Ingrediente(productor_id=productor.id, nombre=nombre, activo=True)
    session.add(ingrediente)
    session.commit()
    return ingrediente


def _insumo(session: Session, **extra: object) -> InsumoComercial:
    productor = _productor(session)
    ingrediente = _ingrediente(session, productor)
    return InsumoComercial(
        productor_id=productor.id,
        ingrediente_id=ingrediente.id,
        nombre="Harina Selecta 1 kg",
        marca_origen="Selecta",
        **extra,
    )


def _rechaza(session: Session, objeto: object, restriccion: str) -> None:
    """The database rejects it, and the error names the constraint (or, for SQLite uniques, its columns)."""
    session.add(objeto)
    with pytest.raises(IntegrityError) as error:
        session.commit()
    session.rollback()
    assert restriccion in str(error.value.orig)


def _guarda(session: Session, objeto: object) -> None:
    session.add(objeto)
    session.commit()


# --- valores por defecto -------------------------------------------------------------------------


def test_insumo_nuevo_nace_sin_precio_ni_contenido(db_session: Session) -> None:
    insumo = _insumo(db_session)
    _guarda(db_session, insumo)
    db_session.refresh(insumo)

    assert insumo.precio_referencia is None
    assert insumo.precio_fuente is None
    assert insumo.precio_fecha is None
    assert insumo.contenido_cantidad is None
    assert insumo.contenido_unidad is None
    assert insumo.contenido_fuente is None


def test_producto_nuevo_nace_sin_rendimiento(db_session: Session) -> None:
    producto = _producto(db_session, _productor(db_session))
    db_session.refresh(producto)

    assert producto.rendimiento is None


def test_insumo_con_precio_y_contenido_completos_se_guarda(db_session: Session) -> None:
    insumo = _insumo(
        db_session,
        precio_referencia=Decimal("1990.50"),
        precio_fuente="jumbo",
        precio_fecha=AHORA,
        contenido_cantidad=Decimal("1.500"),
        contenido_unidad="kg",
        contenido_fuente="open_food_facts",
    )
    _guarda(db_session, insumo)
    db_session.refresh(insumo)

    assert insumo.precio_referencia == Decimal("1990.50")
    assert insumo.contenido_cantidad == Decimal("1.500")
    assert insumo.contenido_unidad == "kg"


# --- restricciones de insumos ----------------------------------------------------------------------


def test_precio_negativo_se_rechaza(db_session: Session) -> None:
    insumo = _insumo(db_session, precio_referencia=Decimal("-1"), precio_fuente="manual", precio_fecha=AHORA)

    _rechaza(db_session, insumo, "ck_insumo_precio_no_negativo")


def test_precio_cero_se_acepta(db_session: Session) -> None:
    insumo = _insumo(db_session, precio_referencia=Decimal("0"), precio_fuente="manual", precio_fecha=AHORA)

    _guarda(db_session, insumo)

    assert insumo.id is not None


def test_precio_exige_fuente_y_fecha(db_session: Session) -> None:
    sin_fuente = _insumo(db_session, precio_referencia=Decimal("100"), precio_fecha=AHORA)
    _rechaza(db_session, sin_fuente, "ck_insumo_precio_completo")

    sin_fecha = _insumo(db_session, precio_referencia=Decimal("100"), precio_fuente="manual")
    _rechaza(db_session, sin_fecha, "ck_insumo_precio_completo")

    fuente_sin_precio = _insumo(db_session, precio_fuente="manual", precio_fecha=AHORA)
    _rechaza(db_session, fuente_sin_precio, "ck_insumo_precio_completo")


def test_fuente_del_precio_invalida_se_rechaza(db_session: Session) -> None:
    # Open Food Facts has no prices: it is a content source only.
    insumo = _insumo(db_session, precio_referencia=Decimal("100"), precio_fuente="open_food_facts", precio_fecha=AHORA)

    _rechaza(db_session, insumo, "ck_insumo_precio_fuente")


def test_contenido_cero_se_rechaza(db_session: Session) -> None:
    insumo = _insumo(
        db_session,
        contenido_cantidad=Decimal("0"),
        contenido_unidad="g",
        contenido_fuente="manual",
    )

    _rechaza(db_session, insumo, "ck_insumo_contenido_positivo")


def test_contenido_unidad_invalida_se_rechaza(db_session: Session) -> None:
    insumo = _insumo(
        db_session,
        contenido_cantidad=Decimal("1"),
        contenido_unidad="litro",
        contenido_fuente="manual",
    )

    _rechaza(db_session, insumo, "ck_insumo_contenido_unidad")


def test_contenido_exige_unidad_y_fuente(db_session: Session) -> None:
    sin_unidad = _insumo(db_session, contenido_cantidad=Decimal("1"), contenido_fuente="manual")
    _rechaza(db_session, sin_unidad, "ck_insumo_contenido_completo")

    sin_fuente = _insumo(db_session, contenido_cantidad=Decimal("1"), contenido_unidad="kg")
    _rechaza(db_session, sin_fuente, "ck_insumo_contenido_completo")

    unidad_sola = _insumo(db_session, contenido_unidad="kg", contenido_fuente="manual")
    _rechaza(db_session, unidad_sola, "ck_insumo_contenido_completo")


def test_fuente_del_contenido_invalida_se_rechaza(db_session: Session) -> None:
    insumo = _insumo(
        db_session,
        contenido_cantidad=Decimal("1"),
        contenido_unidad="kg",
        contenido_fuente="lider",
    )

    _rechaza(db_session, insumo, "ck_insumo_contenido_fuente")


# --- rendimiento -----------------------------------------------------------------------------------


def test_rendimiento_cero_se_rechaza(db_session: Session) -> None:
    producto = _producto(db_session, _productor(db_session))
    producto.rendimiento = 0

    with pytest.raises(IntegrityError) as error:
        db_session.commit()
    db_session.rollback()

    assert "ck_producto_rendimiento_positivo" in str(error.value.orig)


def test_rendimiento_negativo_se_rechaza(db_session: Session) -> None:
    producto = _producto(db_session, _productor(db_session))
    producto.rendimiento = -3

    with pytest.raises(IntegrityError) as error:
        db_session.commit()
    db_session.rollback()

    assert "ck_producto_rendimiento_positivo" in str(error.value.orig)


def test_rendimiento_positivo_se_acepta(db_session: Session) -> None:
    producto = _producto(db_session, _productor(db_session))
    producto.rendimiento = 8
    db_session.commit()
    db_session.refresh(producto)

    assert producto.rendimiento == 8


# --- cantidades por producto e ingrediente -----------------------------------------------------------


@pytest.fixture
def base(db_session: Session) -> tuple[Productor, Producto, Ingrediente]:
    productor = _productor(db_session)
    return productor, _producto(db_session, productor), _ingrediente(db_session, productor)


def _cantidad(producto: Producto, ingrediente: Ingrediente, **extra: object) -> CantidadIngredienteProducto:
    campos: dict[str, object] = {"cantidad": Decimal("250"), "unidad": "g"}
    campos.update(extra)
    return CantidadIngredienteProducto(producto_id=producto.id, ingrediente_id=ingrediente.id, **campos)


def test_cantidad_valida_se_guarda_con_fecha(db_session: Session, base) -> None:
    _, producto, ingrediente = base
    fila = _cantidad(producto, ingrediente, cantidad=Decimal("0.250"), unidad="kg")

    _guarda(db_session, fila)
    db_session.refresh(fila)

    assert fila.cantidad == Decimal("0.250")
    assert fila.unidad == "kg"
    assert fila.updated_at is not None


def test_cantidad_cero_se_rechaza(db_session: Session, base) -> None:
    _, producto, ingrediente = base

    _rechaza(db_session, _cantidad(producto, ingrediente, cantidad=Decimal("0")), "ck_producto_ingrediente_cantidad_positiva")


def test_cantidad_negativa_se_rechaza(db_session: Session, base) -> None:
    _, producto, ingrediente = base

    _rechaza(db_session, _cantidad(producto, ingrediente, cantidad=Decimal("-5")), "ck_producto_ingrediente_cantidad_positiva")


def test_cantidad_nula_se_rechaza(db_session: Session, base) -> None:
    _, producto, ingrediente = base

    _rechaza(db_session, _cantidad(producto, ingrediente, cantidad=None), "cantidad")


def test_unidad_invalida_se_rechaza(db_session: Session, base) -> None:
    _, producto, ingrediente = base

    _rechaza(db_session, _cantidad(producto, ingrediente, unidad="oz"), "ck_producto_ingrediente_cantidad_unidad")


def test_par_producto_ingrediente_duplicado_se_rechaza(db_session: Session, base) -> None:
    _, producto, ingrediente = base
    _guarda(db_session, _cantidad(producto, ingrediente))

    _rechaza(
        db_session,
        _cantidad(producto, ingrediente, cantidad=Decimal("100")),
        "uq_producto_ingrediente_cantidad" if _es_postgresql(db_session) else "producto_ingrediente_cantidades.producto_id",
    )


def test_mismo_ingrediente_en_otro_producto_se_acepta(db_session: Session, base) -> None:
    productor, producto, ingrediente = base
    otro = _producto(db_session, productor, "QUE-002")
    _guarda(db_session, _cantidad(producto, ingrediente))

    _guarda(db_session, _cantidad(otro, ingrediente))

    assert db_session.query(CantidadIngredienteProducto).count() == 2


def test_otro_ingrediente_en_el_mismo_producto_se_acepta(db_session: Session, base) -> None:
    productor, producto, ingrediente = base
    azucar = _ingrediente(db_session, productor, "Azúcar")
    _guarda(db_session, _cantidad(producto, ingrediente))

    _guarda(db_session, _cantidad(producto, azucar))

    assert db_session.query(CantidadIngredienteProducto).count() == 2


# --- otros costos ------------------------------------------------------------------------------------


def _otro(producto: Producto, **extra: object) -> OtroCostoProducto:
    campos: dict[str, object] = {"nombre": "Envases", "monto": Decimal("1500"), "orden": 1}
    campos.update(extra)
    return OtroCostoProducto(producto_id=producto.id, **campos)


def test_otro_costo_monto_cero_se_acepta(db_session: Session, base) -> None:
    _, producto, _ = base

    _guarda(db_session, _otro(producto, monto=Decimal("0")))

    assert db_session.query(OtroCostoProducto).one().monto == Decimal("0")


def test_otro_costo_monto_negativo_se_rechaza(db_session: Session, base) -> None:
    _, producto, _ = base

    _rechaza(db_session, _otro(producto, monto=Decimal("-0.01")), "ck_producto_otro_costo_monto")


def test_otro_costo_nombre_vacio_se_rechaza(db_session: Session, base) -> None:
    _, producto, _ = base

    _rechaza(db_session, _otro(producto, nombre=""), "ck_producto_otro_costo_nombre")
    _rechaza(db_session, _otro(producto, nombre="   "), "ck_producto_otro_costo_nombre")


def test_otro_costo_orden_cero_se_rechaza(db_session: Session, base) -> None:
    _, producto, _ = base

    _rechaza(db_session, _otro(producto, orden=0), "ck_producto_otro_costo_orden")


def test_dos_otros_costos_con_el_mismo_nombre_se_aceptan(db_session: Session, base) -> None:
    _, producto, _ = base
    _guarda(db_session, _otro(producto, orden=1))

    _guarda(db_session, _otro(producto, orden=2))

    assert db_session.query(OtroCostoProducto).count() == 2


def _es_postgresql(session: Session) -> bool:
    return session.get_bind().dialect.name == "postgresql"
