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


def _normalize_optional_url(value: str | None) -> str | None:
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


class CategoriaRead(BaseModel):
    """Read payload for product categories."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


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
    costo_produccion: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    precio_venta: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    imagen_url: str | None = Field(default=None, max_length=2048)
    categoria_ids: list[int] = Field(default_factory=list)

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

    @field_validator("imagen_url")
    @classmethod
    def normalize_imagen_url(cls, value: str | None) -> str | None:
        return _normalize_optional_url(value)

    @field_validator("categoria_ids")
    @classmethod
    def normalize_categoria_ids(cls, value: list[int]) -> list[int]:
        return list(dict.fromkeys(value))


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
    costo_produccion: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    precio_venta: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
    )
    imagen_url: str | None = Field(default=None, max_length=2048)
    categoria_ids: list[int] | None = None

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

    @field_validator("imagen_url")
    @classmethod
    def normalize_imagen_url(cls, value: str | None) -> str | None:
        return _normalize_optional_url(value)

    @field_validator("categoria_ids")
    @classmethod
    def normalize_categoria_ids(cls, value: list[int] | None) -> list[int] | None:
        if value is None:
            return None
        return list(dict.fromkeys(value))

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
    costo_produccion: Decimal | None
    precio_venta: Decimal | None
    imagen_url: str | None
    categorias: list[CategoriaRead] = Field(default_factory=list)
    activo: bool
    created_at: datetime | None


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


# --- Formulación versionada HU02 / T02-09 ---


class FormulacionComponenteCreate(BaseModel):
    """Add an ingredient line to a product version's declared formulation."""

    model_config = ConfigDict(extra="forbid")

    ingrediente_id: int = Field(gt=0)
    porcentaje: Decimal | None = Field(
        default=None,
        gt=0,
        le=100,
        max_digits=6,
        decimal_places=3,
    )
    cantidad: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )
    unidad: UnidadMedida | None = None
    orden: int | None = Field(default=None, ge=1)
    notas: str | None = None

    @model_validator(mode="after")
    def validate_cuantificacion(self) -> Self:
        has_porcentaje = self.porcentaje is not None
        has_cantidad = self.cantidad is not None
        has_unidad = self.unidad is not None

        if has_porcentaje and (has_cantidad or has_unidad):
            raise ValueError("Indique porcentaje o cantidad con unidad, no ambos.")
        if not has_porcentaje and not (has_cantidad and has_unidad):
            raise ValueError("Debe indicar porcentaje o cantidad con unidad.")
        if has_cantidad != has_unidad:
            raise ValueError("cantidad y unidad deben indicarse juntas.")
        return self


class FormulacionComponenteUpdate(BaseModel):
    """Partial update for a formulation line."""

    model_config = ConfigDict(extra="forbid")

    porcentaje: Decimal | None = Field(
        default=None,
        gt=0,
        le=100,
        max_digits=6,
        decimal_places=3,
    )
    cantidad: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=12,
        decimal_places=3,
    )
    unidad: UnidadMedida | None = None
    orden: int | None = Field(default=None, ge=1)
    notas: str | None = None


class FormulacionComponenteRead(BaseModel):
    """Read payload for a product version formulation line."""

    id: int
    ingrediente_id: int
    ingrediente_nombre: str
    ingrediente_codigo_interno: str | None
    ingrediente_tipo: str | None
    porcentaje: Decimal | None
    cantidad: Decimal | None
    unidad: str | None
    orden: int | None
    notas: str | None

    @classmethod
    def from_formulacion(cls, linea: object) -> "FormulacionComponenteRead":
        return cls(
            id=linea.id,  # type: ignore[attr-defined]
            ingrediente_id=linea.ingrediente_id,  # type: ignore[attr-defined]
            ingrediente_nombre=linea.ingrediente_nombre,  # type: ignore[attr-defined]
            ingrediente_codigo_interno=linea.ingrediente_codigo_interno,  # type: ignore[attr-defined]
            ingrediente_tipo=linea.ingrediente_tipo,  # type: ignore[attr-defined]
            porcentaje=linea.porcentaje,  # type: ignore[attr-defined]
            cantidad=linea.cantidad,  # type: ignore[attr-defined]
            unidad=linea.unidad,  # type: ignore[attr-defined]
            orden=linea.orden,  # type: ignore[attr-defined]
            notas=linea.notas,  # type: ignore[attr-defined]
        )
