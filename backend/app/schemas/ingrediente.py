from datetime import datetime
from decimal import Decimal
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


TipoIngrediente = Literal["simple", "compuesto"]

TIPO_SIMPLE: TipoIngrediente = "simple"
TIPO_COMPUESTO: TipoIngrediente = "compuesto"
TIPOS_INGREDIENTE_PERMITIDOS = frozenset({TIPO_SIMPLE, TIPO_COMPUESTO})

_REQUIRED_UPDATE_FIELDS = ("codigo_interno", "nombre", "tipo")


def _normalize_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    return normalized


def _normalize_optional_descripcion(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


# --- Contratos legacy RT-01 (prototipo de trazabilidad) ---


class IngredienteCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)


class IngredienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activo: bool


class VersionIngredienteCreate(BaseModel):
    composicion_declarada: str = Field(min_length=1)
    alergenos_declarados: str = ""
    vigente: bool = True


class VersionIngredienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ingrediente_id: int
    numero_version: int
    composicion_declarada: str
    alergenos_declarados: str
    fecha_creacion: datetime
    vigente: bool


# --- Contratos de gestión HU02 ---


class IngredienteGestionCreate(BaseModel):
    """Create payload for authenticated ingredient management (HU02).

    Ownership (productor_id) comes from the authenticated session, not the body.
    Does not accept or create VersionIngrediente.
    """

    model_config = ConfigDict(extra="forbid")

    codigo_interno: str = Field(min_length=1, max_length=100)
    nombre: str = Field(min_length=1, max_length=255)
    descripcion: str | None = Field(default=None)
    tipo: TipoIngrediente

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
    def normalize_descripcion(cls, value: str | None) -> str | None:
        return _normalize_optional_descripcion(value)


class IngredienteGestionUpdate(BaseModel):
    """Partial update payload for authenticated ingredient management (HU02)."""

    model_config = ConfigDict(extra="forbid")

    codigo_interno: str | None = Field(default=None, min_length=1, max_length=100)
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    descripcion: str | None = None
    tipo: TipoIngrediente | None = None

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
        return _normalize_optional_descripcion(value)

    @model_validator(mode="after")
    def reject_explicit_null_for_required_fields(self) -> Self:
        for field_name in _REQUIRED_UPDATE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} no puede ser null")
        return self


class IngredienteGestionRead(BaseModel):
    """Detail/read payload for authenticated ingredient management (HU02)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    productor_id: int | None
    codigo_interno: str | None
    nombre: str
    descripcion: str | None
    tipo: TipoIngrediente | None
    activo: bool
    created_at: datetime | None


# --- Composición declarada HU02 (T02-04) ---


class ComposicionComponenteCreate(BaseModel):
    """Add a component to a compound ingredient's declared composition."""

    model_config = ConfigDict(extra="forbid")

    ingrediente_componente_id: int = Field(gt=0)
    porcentaje: Decimal = Field(gt=0, le=100, max_digits=6, decimal_places=3)
    orden: int | None = Field(default=None, ge=1)


class ComposicionComponenteUpdate(BaseModel):
    """Partial update for a composition row."""

    model_config = ConfigDict(extra="forbid")

    porcentaje: Decimal | None = Field(
        default=None,
        gt=0,
        le=100,
        max_digits=6,
        decimal_places=3,
    )
    orden: int | None = Field(default=None, ge=1)


class ComposicionComponenteRead(BaseModel):
    """Read payload for a composition row with component summary."""

    id: int
    ingrediente_componente_id: int
    codigo_interno: str | None
    nombre: str
    tipo: TipoIngrediente | None
    porcentaje: Decimal
    orden: int | None

    @classmethod
    def from_composicion(cls, composicion: object) -> "ComposicionComponenteRead":
        componente = composicion.componente  # type: ignore[attr-defined]
        return cls(
            id=composicion.id,  # type: ignore[attr-defined]
            ingrediente_componente_id=composicion.ingrediente_componente_id,  # type: ignore[attr-defined]
            codigo_interno=componente.codigo_interno,
            nombre=componente.nombre,
            tipo=componente.tipo,
            porcentaje=composicion.porcentaje,  # type: ignore[attr-defined]
            orden=composicion.orden,  # type: ignore[attr-defined]
        )
