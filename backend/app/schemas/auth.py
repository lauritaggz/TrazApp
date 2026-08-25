from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def _normalize_required_text(value: str, field_name: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} no puede estar vacío")
    return normalized


class ProductorRegister(BaseModel):
    nombre: str = Field(min_length=1, max_length=255)
    nombre_negocio: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str) -> str:
        return _normalize_required_text(value, "nombre")

    @field_validator("nombre_negocio")
    @classmethod
    def normalize_nombre_negocio(cls, value: str) -> str:
        return _normalize_required_text(value, "nombre_negocio")

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


class ProductorUpdate(BaseModel):
    """Editable profile fields. Identity comes from the authenticated session."""

    nombre: str | None = Field(default=None, min_length=1, max_length=255)
    nombre_negocio: str | None = Field(default=None, min_length=1, max_length=255)

    @field_validator("nombre")
    @classmethod
    def normalize_nombre(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "nombre")

    @field_validator("nombre_negocio")
    @classmethod
    def normalize_nombre_negocio(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _normalize_required_text(value, "nombre_negocio")


class ProductorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    nombre_negocio: str | None
    email: str
    activo: bool
    created_at: datetime


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    productor: ProductorRead


class LogoutResponse(BaseModel):
    """Stateless logout: the client must discard its local access token."""

    message: str = (
        "Sesión cerrada. Descarte el access token en el cliente; "
        "el servidor no mantiene sesiones ni revoca tokens en esta etapa."
    )
