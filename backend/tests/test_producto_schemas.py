"""Unit tests for Producto schemas (T01-02): HU01 management + RT-01 legacy."""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.producto import (
    CategoriaRead,
    ProductoCreate,
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
    ProductoRead,
)


VALID_CREATE = {
    "codigo_interno": "gal-001",
    "nombre": "Galleta de chocolate",
    "descripcion": "Galleta artesanal con cobertura de chocolate.",
    "contenido_neto": "250.000",
    "unidad_medida": "g",
    "presentacion": "Bolsa resellable",
}


def test_producto_gestion_create_valido() -> None:
    producto = ProductoGestionCreate.model_validate(VALID_CREATE)

    assert producto.codigo_interno == "GAL-001"
    assert producto.nombre == "Galleta de chocolate"
    assert producto.descripcion.startswith("Galleta artesanal")
    assert producto.contenido_neto == Decimal("250.000")
    assert producto.unidad_medida == "g"
    assert producto.presentacion == "Bolsa resellable"


def test_codigo_interno_se_normaliza_trim_y_mayusculas() -> None:
    producto = ProductoGestionCreate.model_validate(
        {**VALID_CREATE, "codigo_interno": "  gal-001  "}
    )

    assert producto.codigo_interno == "GAL-001"


def test_nombre_vacio_o_solo_espacios_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "nombre": "   "})


def test_descripcion_vacia_es_rechazada() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "descripcion": "  "})


def test_contenido_neto_cero_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "contenido_neto": "0"})


def test_contenido_neto_negativo_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "contenido_neto": "-1"})


def test_unidad_medida_invalida_es_rechazada() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "unidad_medida": "oz"})


def test_presentacion_es_opcional() -> None:
    payload = {k: v for k, v in VALID_CREATE.items() if k != "presentacion"}
    producto = ProductoGestionCreate.model_validate(payload)

    assert producto.presentacion is None


def test_presentacion_vacia_se_normaliza_a_none() -> None:
    producto = ProductoGestionCreate.model_validate(
        {**VALID_CREATE, "presentacion": "   "}
    )

    assert producto.presentacion is None


def test_create_rechaza_productor_id_e_id_en_payload() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "productor_id": 1})

    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "id": 1})

    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, "activo": False})


def test_create_acepta_costo_precio_imagen_y_categorias_opcionales() -> None:
    producto = ProductoGestionCreate.model_validate(
        {
            **VALID_CREATE,
            "costo_produccion": "12.50",
            "precio_venta": "25.00",
            "imagen_url": "https://cdn.ejemplo.com/galleta.jpg",
            "categoria_ids": [1, 2, 2],
        }
    )

    assert producto.costo_produccion == Decimal("12.50")
    assert producto.precio_venta == Decimal("25.00")
    assert producto.imagen_url == "https://cdn.ejemplo.com/galleta.jpg"
    assert producto.categoria_ids == [1, 2]


@pytest.mark.parametrize("field_name", ["costo_produccion", "precio_venta"])
def test_create_rechaza_valores_negativos(field_name: str) -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate({**VALID_CREATE, field_name: "-0.01"})


def test_create_permite_costo_y_precio_null() -> None:
    producto = ProductoGestionCreate.model_validate(
        {
            **VALID_CREATE,
            "costo_produccion": None,
            "precio_venta": None,
        }
    )

    assert producto.costo_produccion is None
    assert producto.precio_venta is None


def test_producto_gestion_update_parcial_valido() -> None:
    update = ProductoGestionUpdate.model_validate(
        {"nombre": "  Galleta revisada  ", "unidad_medida": "kg"}
    )

    assert update.nombre == "Galleta revisada"
    assert update.unidad_medida == "kg"
    assert "codigo_interno" not in update.model_fields_set
    assert "descripcion" not in update.model_fields_set
    assert "contenido_neto" not in update.model_fields_set


def test_update_campos_omitidos_son_validos() -> None:
    update = ProductoGestionUpdate.model_validate({})

    assert update.model_fields_set == set()
    assert update.codigo_interno is None
    assert update.nombre is None
    assert update.descripcion is None
    assert update.contenido_neto is None
    assert update.unidad_medida is None
    assert update.presentacion is None


@pytest.mark.parametrize(
    "field_name",
    [
        "codigo_interno",
        "nombre",
        "descripcion",
        "contenido_neto",
        "unidad_medida",
    ],
)
def test_update_null_explicito_rechazado_en_campos_obligatorios(field_name: str) -> None:
    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({field_name: None})


def test_update_presentacion_null_explicito_es_valido() -> None:
    update = ProductoGestionUpdate.model_validate({"presentacion": None})

    assert "presentacion" in update.model_fields_set
    assert update.presentacion is None


def test_update_rechaza_campos_obligatorios_vacios() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"nombre": "   "})

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"codigo_interno": "  "})

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"descripcion": ""})


def test_update_rechaza_contenido_neto_invalido_y_unidad_invalida() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"contenido_neto": "0"})

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"unidad_medida": "ton"})


def test_contenido_neto_mas_de_tres_decimales_es_rechazado() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate(
            {**VALID_CREATE, "contenido_neto": "1.1234"}
        )

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"contenido_neto": "1.1234"})


def test_contenido_neto_excede_capacidad_numeric_12_3() -> None:
    # Numeric(12,3) allows at most 9 digits before the decimal point.
    overflow = "1000000000.000"
    with pytest.raises(ValidationError):
        ProductoGestionCreate.model_validate(
            {**VALID_CREATE, "contenido_neto": overflow}
        )

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"contenido_neto": overflow})


def test_update_rechaza_id_y_productor_id() -> None:
    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"id": 1})

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"productor_id": 1, "nombre": "X"})

    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({"activo": False})


def test_update_permite_null_en_costo_precio_e_imagen() -> None:
    update = ProductoGestionUpdate.model_validate(
        {
            "costo_produccion": None,
            "precio_venta": None,
            "imagen_url": None,
        }
    )

    assert "costo_produccion" in update.model_fields_set
    assert "precio_venta" in update.model_fields_set
    assert "imagen_url" in update.model_fields_set
    assert update.costo_produccion is None
    assert update.precio_venta is None
    assert update.imagen_url is None


@pytest.mark.parametrize("field_name", ["costo_produccion", "precio_venta"])
def test_update_rechaza_valores_negativos(field_name: str) -> None:
    with pytest.raises(ValidationError):
        ProductoGestionUpdate.model_validate({field_name: "-1"})


def test_update_normaliza_codigo_interno() -> None:
    update = ProductoGestionUpdate.model_validate({"codigo_interno": "  gal-002  "})

    assert update.codigo_interno == "GAL-002"


def test_producto_gestion_read_from_attributes() -> None:
    class _Row:
        id = 10
        productor_id = 3
        codigo_interno = "GAL-001"
        nombre = "Galleta"
        descripcion = "Descripción"
        contenido_neto = Decimal("100.5")
        unidad_medida = "g"
        presentacion = None
        costo_produccion = None
        precio_venta = None
        imagen_url = None
        categorias = []
        activo = True
        created_at = None

    read = ProductoGestionRead.model_validate(_Row())

    assert read.id == 10
    assert read.productor_id == 3
    assert read.codigo_interno == "GAL-001"
    assert read.contenido_neto == Decimal("100.5")
    assert read.presentacion is None
    assert read.categorias == []
    assert read.costo_produccion is None
    assert read.precio_venta is None
    assert read.imagen_url is None
    assert read.created_at is None


def test_producto_gestion_read_incluye_categorias() -> None:
    class _CategoriaRow:
        id = 1
        nombre = "Pastelería"

    class _Row:
        id = 12
        productor_id = 1
        codigo_interno = "GAL-001"
        nombre = "Galleta"
        descripcion = "Descripción"
        contenido_neto = Decimal("100")
        unidad_medida = "g"
        presentacion = None
        costo_produccion = Decimal("10.00")
        precio_venta = Decimal("20.00")
        imagen_url = "https://cdn.ejemplo.com/galleta.jpg"
        categorias = [_CategoriaRow()]
        activo = True
        created_at = None

    read = ProductoGestionRead.model_validate(_Row())

    assert len(read.categorias) == 1
    assert read.categorias[0] == CategoriaRead(id=1, nombre="Pastelería")


def test_producto_gestion_read_incluye_created_at_cuando_existe() -> None:
    from datetime import datetime, timezone

    class _RowWithCreatedAt:
        id = 11
        productor_id = 2
        codigo_interno = "GAL-002"
        nombre = "Galleta"
        descripcion = "Descripción"
        contenido_neto = Decimal("100")
        unidad_medida = "g"
        presentacion = None
        costo_produccion = None
        precio_venta = None
        imagen_url = None
        categorias = []
        activo = True
        created_at = datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)

    read = ProductoGestionRead.model_validate(_RowWithCreatedAt())

    assert read.created_at == datetime(2026, 8, 25, 12, 0, tzinfo=timezone.utc)


def test_contrato_legacy_rt01_producto_create_solo_nombre() -> None:
    legacy = ProductoCreate.model_validate({"nombre": "Galleta"})

    assert legacy.nombre == "Galleta"


def test_contrato_legacy_rt01_producto_read() -> None:
    class _LegacyRow:
        id = 1
        nombre = "Galleta"
        activo = True

    read = ProductoRead.model_validate(_LegacyRow())

    assert read.id == 1
    assert read.nombre == "Galleta"
    assert read.activo is True
