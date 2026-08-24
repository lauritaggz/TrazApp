from app.core.security import hash_password, verify_password
from app.models import Productor
from app.repositories.productor_repository import ProductorRepository
from app.schemas.auth import (
    LoginResponse,
    ProductorLogin,
    ProductorRead,
    ProductorRegister,
)


class AuthError(Exception):
    """Raised when authentication credentials are rejected."""


class DuplicateEmailError(Exception):
    """Raised when attempting to register an email that already exists."""


class AuthService:
    def __init__(self, repository: ProductorRepository) -> None:
        self.repository = repository

    def register(self, payload: ProductorRegister) -> ProductorRead:
        existing = self.repository.get_by_email(payload.email)
        if existing is not None:
            raise DuplicateEmailError("El correo ya está registrado")

        password_hash = hash_password(payload.password)
        productor = self.repository.create(
            nombre=payload.nombre,
            email=payload.email,
            password_hash=password_hash,
            activo=True,
        )
        return ProductorRead.model_validate(productor)

    def authenticate(self, payload: ProductorLogin) -> Productor:
        """Validate credentials and return the authenticated Productor entity."""
        productor = self.repository.get_by_email(payload.email)
        if productor is None or not productor.activo:
            raise AuthError("Credenciales inválidas")

        if not verify_password(payload.password, productor.password_hash):
            raise AuthError("Credenciales inválidas")

        return productor

    def login(self, payload: ProductorLogin) -> LoginResponse:
        productor = self.authenticate(payload)
        return LoginResponse(productor=ProductorRead.model_validate(productor))
