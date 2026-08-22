from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
