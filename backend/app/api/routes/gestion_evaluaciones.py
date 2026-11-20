"""Results of the anonymous evaluation for the productor (HU11, T11-03). Authenticated."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies import get_current_productor, get_evaluacion_resultados_service
from app.models import Productor
from app.schemas.evaluacion import ResultadosEvaluacionRead
from app.services.evaluacion_resultados_service import EvaluacionResultadosService
from app.services.producto_service import ProductoNotFoundError

router = APIRouter(prefix="/gestion/productos", tags=["gestion-evaluaciones"])


@router.get("/{producto_id}/evaluaciones", response_model=ResultadosEvaluacionRead)
def resultados_de_evaluacion(
    producto_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: EvaluacionResultadosService = Depends(get_evaluacion_resultados_service),
) -> ResultadosEvaluacionRead:
    try:
        return service.resultados(current_productor.id, producto_id)
    except ProductoNotFoundError as exc:
        # Same convention as the other management endpoints: a text `detail`.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from None
