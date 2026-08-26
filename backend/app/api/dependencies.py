from collections.abc import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import TokenError, decode_access_token
from app.db.session import get_db
from app.models import Productor
from app.repositories.producto_repository import ProductoRepository
from app.repositories.productor_repository import ProductorRepository
from app.repositories.trazabilidad_repository import TrazabilidadRepository
from app.services.auth_service import AuthService
from app.services.producto_service import ProductoService
from app.services.trazabilidad_service import TrazabilidadService

bearer_scheme = HTTPBearer(auto_error=False)


def get_database_session(db: Session = Depends(get_db)) -> Generator[Session, None, None]:
    yield db


def get_trazabilidad_service(db: Session = Depends(get_db)) -> TrazabilidadService:
    repository = TrazabilidadRepository(db)
    return TrazabilidadService(repository)


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    repository = ProductorRepository(db)
    return AuthService(repository)


def get_producto_service(db: Session = Depends(get_db)) -> ProductoService:
    repository = ProductoRepository(db)
    return ProductoService(repository)


def get_current_productor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Productor:
    """Resolve and validate the authenticated Productor from a Bearer JWT."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = decode_access_token(credentials.credentials)
        subject = payload.get("sub")
        productor_id = int(subject)
    except (TokenError, TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    productor = ProductorRepository(db).get_by_id(productor_id)
    if productor is None or not productor.activo:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se pudo validar las credenciales",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return productor
