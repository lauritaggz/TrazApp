from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Any, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

EstadoElaboracion = Literal["borrador", "finalizada"]
FaltanteUso = Literal["insumo", "lote"]

MAX_CODIGO = 100


class ElaboracionCreate(BaseModel):
    """Create payload of an elaboración borrador (HU05).

    Both fields are optional: a missing code is replaced by the suggested one and a
    missing date by today in America/Santiago. Ownership comes from the product in the URL.
    """

    model_config = ConfigDict(extra="forbid")

    codigo: str | None = None
    fecha: date | None = None

    @field_validator("codigo")
    @classmethod
    def normalize_codigo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        codigo = value.strip()
        if not codigo:
            raise ValueError("codigo no puede estar vacío")
        if len(codigo) > MAX_CODIGO:
            raise ValueError(f"codigo no puede superar los {MAX_CODIGO} caracteres")
        return codigo


class CodigoSugeridoRead(BaseModel):
    codigo: str


class LoteNuevoInput(BaseModel):
    """A lot that does not exist yet: it is created with the assignment (HU05, CA06)."""

    model_config = ConfigDict(extra="forbid")

    tipo: Literal["nuevo"]
    codigo: str
    fecha_vencimiento: date | None = None

    @field_validator("codigo")
    @classmethod
    def normalize_codigo(cls, value: str) -> str:
        codigo = value.strip()
        if not codigo:
            raise ValueError("codigo del lote no puede estar vacío")
        if len(codigo) > MAX_CODIGO:
            raise ValueError(f"codigo del lote no puede superar los {MAX_CODIGO} caracteres")
        return codigo


class LoteExistenteInput(BaseModel):
    """A lot already registered for the same supply (HU05, CA07)."""

    model_config = ConfigDict(extra="forbid")

    tipo: Literal["existente"]
    lote_id: int = Field(gt=0)


class SinLoteInput(BaseModel):
    """The productor states that the supply has no lot (HU05, CA06)."""

    model_config = ConfigDict(extra="forbid")

    tipo: Literal["sin_lote"]


LoteInput = Annotated[
    LoteNuevoInput | LoteExistenteInput | SinLoteInput,
    Field(discriminator="tipo"),
]


class UsoInsumoInput(BaseModel):
    """Assignment of one ingredient: a null supply or a missing lot leave it pending."""

    model_config = ConfigDict(extra="forbid")

    ingrediente_id: int = Field(gt=0)
    insumo_id: int | None = Field(default=None, gt=0)
    lote: LoteInput | None = None

    @model_validator(mode="after")
    def lote_requires_insumo(self) -> Self:
        if self.insumo_id is None and self.lote is not None:
            raise ValueError("No se puede indicar un lote sin insumo")
        return self


class UsosReemplazo(BaseModel):
    """Full replacement of the assignment: one entry per ingredient of the version."""

    model_config = ConfigDict(extra="forbid")

    usos: list[UsoInsumoInput] = Field(min_length=1)


class LoteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    insumo_id: int
    codigo: str
    fecha_vencimiento: date | None
    created_at: datetime


class ProductoResumenRead(BaseModel):
    id: int
    nombre: str


class VersionResumenRead(BaseModel):
    id: int
    numero_version: int


class InsumoUsadoRead(BaseModel):
    """Live data of the supply assigned to a borrador (a finalizada reads its copy, T05-04)."""

    id: int
    nombre: str
    marca_origen: str
    presentacion: str | None
    activo: bool
    habitual: bool


class LoteUsadoRead(BaseModel):
    id: int
    codigo: str
    fecha_vencimiento: date | None


class UsoInsumoRead(BaseModel):
    """One ingredient of the formulation with the supply and lot assigned to it."""

    ingrediente_id: int
    ingrediente_nombre: str
    orden: int | None
    cantidad: Decimal | None
    unidad: str | None
    insumo: InsumoUsadoRead | None
    lote: LoteUsadoRead | None
    sin_lote: bool
    pendiente: bool
    falta: list[FaltanteUso]


class ElaboracionRead(BaseModel):
    id: int
    producto: ProductoResumenRead
    version: VersionResumenRead
    codigo: str
    fecha: date
    estado: EstadoElaboracion
    finalizada_at: datetime | None
    created_at: datetime
    updated_at: datetime
    usos: list[UsoInsumoRead]

    @classmethod
    def from_elaboracion(
        cls,
        elaboracion: Any,
        lineas: dict[int, Any],
    ) -> "ElaboracionRead":
        """`lineas` maps ingrediente_id to the formulation line of the elaboración's version."""
        usos = [
            _uso_read(uso, lineas[uso.ingrediente_id])
            for uso in sorted(
                elaboracion.usos,
                key=lambda u: (
                    lineas[u.ingrediente_id].orden is None,
                    lineas[u.ingrediente_id].orden or 0,
                    u.id,
                ),
            )
        ]
        return cls(
            id=elaboracion.id,
            producto=ProductoResumenRead(
                id=elaboracion.producto.id,
                nombre=elaboracion.producto.nombre,
            ),
            version=VersionResumenRead(
                id=elaboracion.version_producto.id,
                numero_version=elaboracion.version_producto.numero_version,
            ),
            codigo=elaboracion.codigo,
            fecha=elaboracion.fecha_elaboracion,
            estado=elaboracion.estado,
            finalizada_at=elaboracion.finalizada_at,
            created_at=elaboracion.created_at,
            updated_at=elaboracion.updated_at,
            usos=usos,
        )


def _uso_read(uso: Any, linea: Any) -> UsoInsumoRead:
    insumo = uso.insumo
    lote = uso.lote
    falta: list[FaltanteUso] = []
    if insumo is None:
        falta.append("insumo")
    if lote is None and not uso.sin_lote:
        falta.append("lote")
    return UsoInsumoRead(
        ingrediente_id=uso.ingrediente_id,
        ingrediente_nombre=linea.ingrediente_nombre,
        orden=linea.orden,
        cantidad=linea.cantidad,
        unidad=linea.unidad,
        insumo=(
            InsumoUsadoRead(
                id=insumo.id,
                nombre=insumo.nombre,
                marca_origen=insumo.marca_origen,
                presentacion=insumo.presentacion,
                activo=insumo.activo,
                habitual=insumo.habitual,
            )
            if insumo is not None
            else None
        ),
        lote=(
            LoteUsadoRead(
                id=lote.id,
                codigo=lote.codigo,
                fecha_vencimiento=lote.fecha_vencimiento,
            )
            if lote is not None
            else None
        ),
        sin_lote=uso.sin_lote,
        pendiente=bool(falta),
        falta=falta,
    )


class ElaboracionResumenRead(BaseModel):
    """Row of the elaboraciones list."""

    id: int
    producto: ProductoResumenRead
    version: VersionResumenRead
    codigo: str
    fecha: date
    estado: EstadoElaboracion
    finalizada_at: datetime | None
    total_ingredientes: int
    pendientes: int
