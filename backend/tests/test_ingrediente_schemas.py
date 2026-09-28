"""Unit tests for HU02 ingredient management schemas (T02-03)."""

import pytest
from pydantic import ValidationError

from app.schemas.ingrediente import (
    TIPO_COMPUESTO,
    TIPO_SIMPLE,
    IngredienteGestionCreate,
    IngredienteGestionUpdate,
)


def test_create_acepta_tipos_permitidos() -> None:
    simple = IngredienteGestionCreate(
        codigo_interno="har-001",
        nombre="Harina",
        tipo=TIPO_SIMPLE,
    )
    compuesto = IngredienteGestionCreate(
        codigo_interno="mas-001",
        nombre="Masa",
        tipo=TIPO_COMPUESTO,
    )

    assert simple.tipo == "simple"
    assert compuesto.tipo == "compuesto"


def test_create_rechaza_tipo_invalido() -> None:
    with pytest.raises(ValidationError):
        IngredienteGestionCreate(
            codigo_interno="x-001",
            nombre="Ingrediente",
            tipo="mezcla",  # type: ignore[arg-type]
        )


def test_create_sin_tipo_queda_en_null() -> None:
    ingrediente = IngredienteGestionCreate(codigo_interno="azu-001", nombre="Azúcar")

    assert ingrediente.tipo is None


def test_update_acepta_null_explicito_en_tipo() -> None:
    payload = IngredienteGestionUpdate(tipo=None)

    assert payload.tipo is None
    assert "tipo" in payload.model_fields_set


def test_update_sin_tipo_no_lo_marca_como_enviado() -> None:
    payload = IngredienteGestionUpdate(nombre="Masa editada")

    assert payload.model_dump(exclude_unset=True) == {"nombre": "Masa editada"}


def test_update_sigue_rechazando_null_en_campos_obligatorios() -> None:
    with pytest.raises(ValidationError):
        IngredienteGestionUpdate(nombre=None)
    with pytest.raises(ValidationError):
        IngredienteGestionUpdate(codigo_interno=None)
