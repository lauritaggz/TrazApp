from datetime import datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


UnidadMedida = Literal["g", "kg", "ml", "L", "unidad"]

_REQUIRED_UPDATE_FIELDS = (
    "codigo_interno",
    "nombre",
    "descripcion",
    "contenido_neto",
    "unidad_medida",
)


def _normalize_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    return normalized


def _normalize_optional_presentacion(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


# --- Contratos legacy RT-01 (prototipo de trazabilidad) ---


class ProductoCreate(BaseModel):
    """Legacy create payload used by RT-01: only product name."""

    nombre: str = Field(min_length=1, max_length=255)


class ProductoRead(BaseModel):
    """Legacy read payload used by RT-01 endpoints."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activo: bool


# --- Contratos de gestión HU01 ---


class ProductoGestionCreate(BaseModel):
    """Create payload for authenticated product management (HU01).

    Ownership (productor_id) comes from the authenticated session, not the body.
    Does not accept or create VersionProducto.
    """

    model_config = ConfigDict(extra="forbid")

    codigo_interno: str = Field(min_length=1, max_length=100)
    nombre: str = Field(min_length=1, max_length=255)
    descripcion: str = Field(min_length=1)
    contenido_neto: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unidad_medida: UnidadMedida
    presentacion: str | None = Field(default=None, max_length=255)

    @field_validator("codigo_interno")
    @classmethod
    def normalize_codigo_interno(cls, value: str) -> str:
        return _normalize_required_text(value, "codigo_interno").upper()

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str) -> str:
        return _normalize_required_text(value, "nombre")

    @field_validator("descripcion")
    @classmethod
    def normalize_descripcion(cls, value: str) -> str:
        return _normalize_required_text(value, "descripcion")

    @field_validator("presentacion")
    @classmethod
    def normalize_presentacion(cls, value: str | None) -> str | None:
        return _normalize_optional_presentacion(value)


class ProductoGestionUpdate(BaseModel):
    """Partial update payload for authenticated product management (HU01).

    Omitted fields stay unset (preserve current values later).
    Explicit null is rejected for required product fields; presentacion may be
    cleared with null because it is optional.
    """

    model_config = ConfigDict(extra="forbid")

    codigo_interno: str | None = Field(default=None, min_length=1, max_length=100)
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    descripcion: str | None = Field(default=None, min_length=1)
    contenido_neto: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )
    unidad_medida: UnidadMedida | None = None
    presentacion: str | None = Field(default=None, max_length=255)

    @field_validator("codigo_interno")
    @classmethod
    def normalize_codigo_interno(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "codigo_interno").upper()

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "nombre")

    @field_validator("descripcion")
    @classmethod
    def normalize_descripcion(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "descripcion")

    @field_validator("presentacion")
    @classmethod
    def normalize_presentacion(cls, value: str | None) -> str | None:
        return _normalize_optional_presentacion(value)

    @model_validator(mode="after")
    def reject_explicit_null_for_required_fields(self) -> Self:
        for field_name in _REQUIRED_UPDATE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} no puede ser null")
        return self


class ProductoGestionRead(BaseModel):
    """Detail/read payload for authenticated product management (HU01)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    productor_id: int | None
    codigo_interno: str | None
    nombre: str
    descripcion: str | None
    contenido_neto: Decimal | None
    unidad_medida: str | None
    presentacion: str | None
    activo: bool


# --- VersionProducto (RT-01 / formulación; sin cambios de contrato) ---


class VersionProductoCreate(BaseModel):
    descripcion: str = Field(min_length=1)
    vigente: bool = True


class VersionProductoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    producto_id: int
    numero_version: int
    descripcion: str
    fecha_creacion: datetime
    vigente: bool
