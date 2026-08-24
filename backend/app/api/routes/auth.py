from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_auth_service
from app.schemas.auth import (
    LoginResponse,
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
