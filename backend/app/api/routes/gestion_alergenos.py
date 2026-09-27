from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_productor, get_ingrediente_service
from app.models import Productor
from app.schemas.ingrediente import AlergenoCatalogoRead
from app.services.ingrediente_service import IngredienteService

router = APIRouter(prefix="/gestion/alergenos", tags=["gestion-alergenos"])


@router.get("", response_model=list[AlergenoCatalogoRead])
def listar_alergenos(
    current_productor: Productor = Depends(get_current_productor),
    service: IngredienteService = Depends(get_ingrediente_service),
) -> list[AlergenoCatalogoRead]:
    del current_productor
    return service.list_alergenos_catalogo()
