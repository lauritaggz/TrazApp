from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies import (
    get_current_productor,
    get_insumo_service,
    get_recuperacion_service,
)
from app.models import Productor
from app.schemas.consulta_codigo import ConsultaCodigoRead
from app.schemas.insumo import (
    AlergenoDeclaradoRead,
    InsumoAlergenoCreate,
    InsumoAlergenosReplace,
    InsumoAlergenoUpdate,
    InsumoCreate,
    InsumoRead,
    InsumoUpdate,
)
from app.services.insumo_service import (
    DuplicateCodigoBarrasError,
    FichaInvalidaError,
    FuenteSinFechaError,
    InsumoAlergenoNotFoundError,
    InsumoConflictError,
    InsumoNotFoundError,
    InsumoService,
    InvalidAlergenosError,
    InvalidInsumoAlergenoError,
    InvalidInsumoError,
)
from app.services.recuperacion.base import FuenteNoDisponibleError
from app.services.recuperacion.service import CodigoInvalidoError, RecuperacionService

router = APIRouter(prefix="/gestion/insumos", tags=["gestion-insumos"])


def _duplicate_codigo_error(exc: DuplicateCodigoBarrasError) -> HTTPException:
    """409 with the existing supply, so the client can use it or reactivate it."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "mensaje": str(exc),
            "insumo_id": exc.insumo_id,
            "activo": exc.activo,
        },
    )


def _error_de_campo(exc: FuenteSinFechaError | FichaInvalidaError) -> HTTPException:
    """422 naming the field of the supply that was refused."""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"mensaje": str(exc), "campo": exc.campo},
    )


def _alergenos_error(exc: InvalidAlergenosError) -> HTTPException:
    """422 naming the allergen of the list that was rejected."""
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"mensaje": exc.mensaje, "alergeno_id": exc.alergeno_id},
    )


@router.post(
    "",
    response_model=InsumoRead,
    status_code=status.HTTP_201_CREATED,
)
def crear_insumo(
    payload: InsumoCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.create(current_productor, payload)
    except DuplicateCodigoBarrasError as exc:
        raise _duplicate_codigo_error(exc) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except InvalidAlergenosError as exc:
        raise _alergenos_error(exc) from exc
    except (FuenteSinFechaError, FichaInvalidaError) as exc:
        raise _error_de_campo(exc) from exc
    except InvalidInsumoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.get("/consulta-codigo/{codigo}", response_model=ConsultaCodigoRead)
def consultar_codigo_barras(
    codigo: str,
    current_productor: Productor = Depends(get_current_productor),
    service: RecuperacionService = Depends(get_recuperacion_service),
) -> ConsultaCodigoRead:
    """Proposal for a new supply from the barcode. Read-only: nothing is registered here.

    Declared before `/{insumo_id}` so the path is never read as a supply id.
    """
    try:
        return service.consultar(current_productor, codigo)
    except CodigoInvalidoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"mensaje": str(exc)},
        ) from exc
    except DuplicateCodigoBarrasError as exc:
        raise _duplicate_codigo_error(exc) from exc
    except FuenteNoDisponibleError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"mensaje": str(exc), "motivo": exc.motivo},
        ) from exc


@router.get("", response_model=list[InsumoRead])
def listar_insumos(
    ingrediente_id: int | None = Query(default=None, gt=0),
    activo: bool = Query(default=True),
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> list[InsumoRead]:
    return service.list_mine(
        current_productor,
        activo=activo,
        ingrediente_id=ingrediente_id,
    )


@router.get("/{insumo_id}", response_model=InsumoRead)
def obtener_insumo(
    insumo_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.get_mine(current_productor, insumo_id)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.patch("/{insumo_id}", response_model=InsumoRead)
def actualizar_insumo(
    insumo_id: int,
    payload: InsumoUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    try:
        return service.update_mine(current_productor, insumo_id, payload)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except DuplicateCodigoBarrasError as exc:
        raise _duplicate_codigo_error(exc) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except (FuenteSinFechaError, FichaInvalidaError) as exc:
        raise _error_de_campo(exc) from exc
    except InvalidInsumoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc


@router.delete("/{insumo_id}", status_code=status.HTTP_204_NO_CONTENT)
def desactivar_insumo(
    insumo_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> None:
    try:
        service.delete_mine(current_productor, insumo_id)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# --- allergens declared by the supply (T04-04) ---


@router.get("/{insumo_id}/alergenos", response_model=list[AlergenoDeclaradoRead])
def listar_alergenos_insumo(
    insumo_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> list[AlergenoDeclaradoRead]:
    try:
        return service.list_alergenos_mine(current_productor, insumo_id)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{insumo_id}/alergenos", response_model=InsumoRead)
def reemplazar_alergenos_insumo(
    insumo_id: int,
    payload: InsumoAlergenosReplace,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> InsumoRead:
    """Replace the complete list of declared allergens and mark it as reviewed (HT06)."""
    try:
        return service.replace_alergenos_mine(current_productor, insumo_id, payload)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidAlergenosError as exc:
        raise _alergenos_error(exc) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post(
    "/{insumo_id}/alergenos",
    response_model=AlergenoDeclaradoRead,
    status_code=status.HTTP_201_CREATED,
)
def agregar_alergeno_insumo(
    insumo_id: int,
    payload: InsumoAlergenoCreate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> AlergenoDeclaradoRead:
    try:
        return service.add_alergeno_mine(current_productor, insumo_id, payload)
    except InsumoNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except InvalidInsumoAlergenoError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc
    except InsumoConflictError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.patch(
    "/{insumo_id}/alergenos/{alergeno_id}",
    response_model=AlergenoDeclaradoRead,
)
def cambiar_tipo_alergeno_insumo(
    insumo_id: int,
    alergeno_id: int,
    payload: InsumoAlergenoUpdate,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> AlergenoDeclaradoRead:
    try:
        return service.update_alergeno_mine(current_productor, insumo_id, alergeno_id, payload)
    except (InsumoNotFoundError, InsumoAlergenoNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.delete(
    "/{insumo_id}/alergenos/{alergeno_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def quitar_alergeno_insumo(
    insumo_id: int,
    alergeno_id: int,
    current_productor: Productor = Depends(get_current_productor),
    service: InsumoService = Depends(get_insumo_service),
) -> None:
    try:
        service.delete_alergeno_mine(current_productor, insumo_id, alergeno_id)
    except (InsumoNotFoundError, InsumoAlergenoNotFoundError) as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
