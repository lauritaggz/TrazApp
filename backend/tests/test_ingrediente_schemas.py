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


def test_update_rechaza_null_en_tipo() -> None:
    with pytest.raises(ValidationError):
        IngredienteGestionUpdate(tipo=None)
