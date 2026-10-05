from datetime import datetime
from typing import Any, Literal, Self

from pydantic import (
    AwareDatetime,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

from app.core.codigo_barras import normalizar_codigo_barras, validar_codigo_barras
from app.models.insumo import TIPO_CONTIENE

FuenteInsumo = Literal["manual", "open_food_facts"]

# These fields cannot be cleared with an explicit null in a PATCH.
_NOT_NULLABLE_UPDATE_FIELDS = (
    "ingrediente_id",
    "nombre",
    "marca_origen",
    "fuente",
    "habitual",
    "activo",
)


def _normalize_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    return normalized


def _normalize_optional_text(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _normalize_codigo_barras(value: str | None) -> str | None:
    codigo = normalizar_codigo_barras(value)
    if codigo is None:
        return None
    return validar_codigo_barras(codigo)


class InsumoCreate(BaseModel):
    """Create payload for commercial supplies (HU04).

    Ownership (productor_id) comes from the authenticated session. The declared
    allergens are managed with their own endpoints (T04-04), not here.
    """

    model_config = ConfigDict(extra="forbid")

    ingrediente_id: int = Field(gt=0)
    nombre: str = Field(min_length=1, max_length=255)
    marca_origen: str = Field(min_length=1, max_length=255)
    presentacion: str | None = Field(default=None, max_length=255)
    codigo_barras: str | None = None
    ingredientes_declarados: str | None = None
    advertencias: str | None = None
    ficha: dict[str, Any] | None = None
    fuente: FuenteInsumo = "manual"
    fecha_recuperacion: AwareDatetime | None = None
    habitual: bool = False

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str) -> str:
        return _normalize_required_text(value, "nombre")

    @field_validator("marca_origen")
    @classmethod
    def normalize_marca_origen(cls, value: str) -> str:
        return _normalize_required_text(value, "marca_origen")

    @field_validator("presentacion", "ingredientes_declarados", "advertencias")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("codigo_barras")
    @classmethod
    def normalize_codigo_barras(cls, value: str | None) -> str | None:
        return _normalize_codigo_barras(value)


class InsumoUpdate(BaseModel):
    """Partial update payload for commercial supplies (HU04).

    `activo` allows reactivating a deactivated supply; deactivating is also available
    with DELETE, like HU02.
    """

    model_config = ConfigDict(extra="forbid")

    ingrediente_id: int | None = Field(default=None, gt=0)
    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    marca_origen: str | None = Field(default=None, min_length=1, max_length=255)
    presentacion: str | None = Field(default=None, max_length=255)
    codigo_barras: str | None = None
    ingredientes_declarados: str | None = None
    advertencias: str | None = None
    ficha: dict[str, Any] | None = None
    fuente: FuenteInsumo | None = None
    fecha_recuperacion: AwareDatetime | None = None
    habitual: bool | None = None
    activo: bool | None = None

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "nombre")

    @field_validator("marca_origen")
    @classmethod
    def normalize_marca_origen(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "marca_origen")

    @field_validator("presentacion", "ingredientes_declarados", "advertencias")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        return _normalize_optional_text(value)

    @field_validator("codigo_barras")
    @classmethod
    def normalize_codigo_barras(cls, value: str | None) -> str | None:
        return _normalize_codigo_barras(value)

    @model_validator(mode="after")
    def reject_explicit_null_for_required_fields(self) -> Self:
        for field_name in _NOT_NULLABLE_UPDATE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"{field_name} no puede ser null")
        return self


class IngredienteResumenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class AlergenoDeclaradoRead(BaseModel):
    """Allergen declared by the supply with its declaration type (read-only here)."""

    alergeno_id: int
    codigo: str
    nombre: str
    obligatorio_chile: bool
    tipo: Literal["contiene", "trazas"]


class InsumoRead(BaseModel):
    """Detail/read payload for commercial supplies (HU04)."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    productor_id: int
    ingrediente_id: int
    ingrediente: IngredienteResumenRead
    nombre: str
    marca_origen: str
    presentacion: str | None
    codigo_barras: str | None
    ingredientes_declarados: str | None
    advertencias: str | None
    ficha: dict[str, Any] | None
    fuente: str
    fecha_recuperacion: datetime | None
    habitual: bool
    activo: bool
    created_at: datetime
    updated_at: datetime
    alergenos_declarados: list[AlergenoDeclaradoRead]

    @classmethod
    def from_insumo(cls, insumo: Any) -> "InsumoRead":
        declarados = sorted(
            insumo.alergenos_declarados,
            key=lambda d: (
                d.tipo != TIPO_CONTIENE,
                not d.alergeno.obligatorio_chile,
                d.alergeno.nombre,
            ),
        )
        return cls(
            id=insumo.id,
            productor_id=insumo.productor_id,
            ingrediente_id=insumo.ingrediente_id,
            ingrediente=IngredienteResumenRead.model_validate(insumo.ingrediente),
            nombre=insumo.nombre,
            marca_origen=insumo.marca_origen,
            presentacion=insumo.presentacion,
            codigo_barras=insumo.codigo_barras,
            ingredientes_declarados=insumo.ingredientes_declarados,
            advertencias=insumo.advertencias,
            ficha=insumo.ficha,
            fuente=insumo.fuente,
            fecha_recuperacion=insumo.fecha_recuperacion,
            habitual=insumo.habitual,
            activo=insumo.activo,
            created_at=insumo.created_at,
            updated_at=insumo.updated_at,
            alergenos_declarados=[
                AlergenoDeclaradoRead(
                    alergeno_id=d.alergeno_id,
                    codigo=d.alergeno.codigo,
                    nombre=d.alergeno.nombre,
                    obligatorio_chile=d.alergeno.obligatorio_chile,
                    tipo=d.tipo,
                )
                for d in declarados
            ],
        )
