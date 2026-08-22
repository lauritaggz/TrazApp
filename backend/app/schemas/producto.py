from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProductoCreate(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)


class ProductoRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    activo: bool


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
