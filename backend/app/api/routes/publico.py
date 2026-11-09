"""Public consultation (HU10). NO authentication: everything returned here is visible to anyone."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_consulta_publica_service
from app.schemas.consulta_publica import FichaPublicaRead
from app.services.consulta_publica_service import (
    MENSAJE_NO_DISPONIBLE,
    ConsultaPublicaService,
    FichaNoDisponibleError,
    InformacionConservadaIncompletaError,
    ParametrosInvalidosError,
    validar_parametros,
)

router = APIRouter(prefix="/publico", tags=["publico"])

# Never cached (unpublishing or hiding must show at once) and never indexed by search engines.
CABECERAS_PUBLICAS = {"Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow"}


@router.get(
    "/productos/{id_publico}",
    response_model=FichaPublicaRead,
    responses={404: {"description": "Producto no disponible (no publicado, eliminado o inexistente)"}},
)
def consultar_ficha(
    id_publico: str,
    response: Response,
    codigo: str | None = None,
    fecha: str | None = None,
    service: ConsultaPublicaService = Depends(get_consulta_publica_service),
) -> FichaPublicaRead:
    # No `pattern`/`max_length` on the path: a malformed identifier must answer the same 404.
    # The Authorization header is not read at all: a session in the same browser changes nothing.
    # Parameters are validated BEFORE the product is looked up: the 422 is the same for a product
    # that exists and one that does not, so it cannot be used to find out which exist.
    try:
        codigo_normalizado, fecha_pedida = validar_parametros(codigo, fecha)
    except ParametrosInvalidosError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"mensaje": str(exc)},
            headers=CABECERAS_PUBLICAS,
        ) from None
    try:
        ficha = service.consultar(id_publico, codigo_normalizado, fecha_pedida)
    except FichaNoDisponibleError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"mensaje": MENSAJE_NO_DISPONIBLE},
            headers=CABECERAS_PUBLICAS,
        ) from None
    except InformacionConservadaIncompletaError:
        # Already logged (use id and missing key only). Fail closed instead of showing partial data.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"mensaje": "No se pudo mostrar la información. Intenta nuevamente más tarde."},
            headers=CABECERAS_PUBLICAS,
        ) from None
    response.headers.update(CABECERAS_PUBLICAS)
    return ficha
