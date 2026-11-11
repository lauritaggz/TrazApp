"""Preview of the public ficha for the productor (HU10, T10-05, CA10). Authenticated.

Same response as the public consultation (`FichaPublicaRead`), built by the same service and the
same assembly function, but it also works for a product that is not published yet.
"""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.api.dependencies import get_consulta_publica_service, get_current_productor
from app.models import Productor
from app.schemas.consulta_publica import FichaPublicaRead
from app.services.consulta_publica_service import (
    ConsultaPublicaService,
    InformacionConservadaIncompletaError,
    ParametrosInvalidosError,
    validar_parametros,
)
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion/productos", tags=["gestion-vista-publica"])

CABECERAS_VISTA_PREVIA = {"Cache-Control": "no-store"}


@router.get("/{producto_id}/vista-publica", response_model=FichaPublicaRead)
def previsualizar_ficha(
    producto_id: int,
    response: Response,
    codigo: str | None = None,
    fecha: str | None = None,
    current_productor: Productor = Depends(get_current_productor),
    service: ConsultaPublicaService = Depends(get_consulta_publica_service),
) -> FichaPublicaRead:
    try:
        codigo_normalizado, fecha_pedida = validar_parametros(codigo, fecha)
    except ParametrosInvalidosError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"mensaje": str(exc)},
            headers=CABECERAS_VISTA_PREVIA,
        ) from None
    try:
        ficha = service.previsualizar(current_productor.id, producto_id, codigo_normalizado, fecha_pedida)
    except ProductoNotFoundError as exc:
        # Unknown, deleted and another productor's product: the convention of the management endpoints.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=str(exc), headers=CABECERAS_VISTA_PREVIA
        ) from None
    except InformacionConservadaIncompletaError:
        # Already logged (use id and missing key only). Fail closed, like the public consultation.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"mensaje": "No se pudo mostrar la información. Intenta nuevamente más tarde."},
            headers=CABECERAS_VISTA_PREVIA,
        ) from None
    response.headers.update(CABECERAS_VISTA_PREVIA)
    return ficha
