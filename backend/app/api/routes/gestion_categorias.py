from fastapi import APIRouter, Depends

from app.api.dependencies import get_categoria_service, get_current_productor
from app.models import Productor
from app.schemas.producto import CategoriaRead
from app.services.categoria_service import CategoriaService

router = APIRouter(prefix="/gestion/categorias", tags=["gestion-categorias"])


@router.get("", response_model=list[CategoriaRead])
def listar_categorias(
    current_productor: Productor = Depends(get_current_productor),
    service: CategoriaService = Depends(get_categoria_service),
) -> list[CategoriaRead]:
    del current_productor
    return service.list_available()
