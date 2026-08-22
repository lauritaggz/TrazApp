from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LoteIngredienteCreate(BaseModel):
    codigo_lote: str = Field(min_length=1, max_length=100)
    version_ingrediente_id: int


class LoteIngredienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_lote: str
    version_ingrediente_id: int
    fecha_recepcion: datetime


class LoteProductoCreate(BaseModel):
    codigo_lote: str = Field(min_length=1, max_length=100)
    version_producto_id: int
    lotes_ingredientes: list[str] = Field(min_length=1)


class LoteProductoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    codigo_lote: str
    version_producto_id: int
    fecha_elaboracion: datetime


class TrazabilidadProductoRead(BaseModel):
    nombre: str
    version: int
    descripcion: str


class TrazabilidadIngredienteRead(BaseModel):
    ingrediente: str
    lote: str
    version: int
    composicion_declarada: str
    alergenos_declarados: str


class TrazabilidadRead(BaseModel):
    lote_producto: str
    producto: TrazabilidadProductoRead
    ingredientes_utilizados: list[TrazabilidadIngredienteRead]
