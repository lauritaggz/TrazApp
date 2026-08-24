from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class ProductorRegister(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("nombre no puede estar vacío")
        return normalized

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ProductorLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class ProductorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    email: str
    activo: bool
    created_at: datetime


class LoginResponse(BaseModel):
    """Temporary successful-auth payload until JWT is introduced in T12-04."""

    message: str = "Autenticación satisfactoria"
    productor: ProductorRead
