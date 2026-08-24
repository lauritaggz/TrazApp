from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_auth_service, get_current_productor
from app.models import Productor
from app.schemas.auth import (
    LoginResponse,
    LogoutResponse,
    ProductorLogin,
    ProductorRead,
    ProductorRegister,
)
from app.services.auth_service import AuthError, AuthService, DuplicateEmailError

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=ProductorRead,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: ProductorRegister,
    service: AuthService = Depends(get_auth_service),
) -> ProductorRead:
    try:
        return service.register(payload)
    except DuplicateEmailError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/login", response_model=LoginResponse)
def login(
    payload: ProductorLogin,
    service: AuthService = Depends(get_auth_service),
) -> LoginResponse:
    try:
        return service.login(payload)
    except AuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
        ) from exc


@router.get("/me", response_model=ProductorRead)
def me(
    current_productor: Productor = Depends(get_current_productor),
) -> ProductorRead:
    """Private route that returns the authenticated producer profile."""
    return ProductorRead.model_validate(current_productor)


@router.post("/logout", response_model=LogoutResponse)
def logout() -> LogoutResponse:
    """Semantic logout for a stateless JWT MVP.

    The server does not revoke tokens. The client must discard the access token
    it stores locally. No blacklist or session table is used in this stage.
    """
    return LogoutResponse()
