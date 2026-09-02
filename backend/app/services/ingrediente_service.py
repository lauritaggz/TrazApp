from app.models import Ingrediente, Productor
from app.repositories.ingrediente_repository import IngredienteRepository
from app.schemas.ingrediente import (
    IngredienteGestionCreate,
    IngredienteGestionRead,
    IngredienteGestionUpdate,
)


class IngredienteNotFoundError(Exception):
    """Raised when an ingredient is not visible to the authenticated productor."""


class IngredienteService:
    def __init__(self, repository: IngredienteRepository) -> None:
        self.repository = repository

    def create(
        self,
        productor: Productor,
        payload: IngredienteGestionCreate,
    ) -> IngredienteGestionRead:
        ingrediente = self.repository.create(
            productor_id=productor.id,
            **payload.model_dump(),
        )
        return IngredienteGestionRead.model_validate(ingrediente)

    def list_mine(self, productor: Productor) -> list[IngredienteGestionRead]:
        ingredientes = self.repository.list_by_productor(productor.id)
        return [IngredienteGestionRead.model_validate(i) for i in ingredientes]

    def get_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
    ) -> IngredienteGestionRead:
        ingrediente = self._get_owned_or_raise(productor.id, ingrediente_id)
        return IngredienteGestionRead.model_validate(ingrediente)

    def update_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
        payload: IngredienteGestionUpdate,
    ) -> IngredienteGestionRead:
        ingrediente = self._get_owned_or_raise(productor.id, ingrediente_id)
        updates = payload.model_dump(exclude_unset=True)
        updated = self.repository.update(ingrediente, **updates)
        return IngredienteGestionRead.model_validate(updated)

    def delete_mine(self, productor: Productor, ingrediente_id: int) -> None:
        ingrediente = self._get_owned_or_raise(productor.id, ingrediente_id)
        self.repository.deactivate(ingrediente)

    def _get_owned_or_raise(self, productor_id: int, ingrediente_id: int) -> Ingrediente:
        ingrediente = self.repository.get_by_id_and_productor(
            ingrediente_id,
            productor_id,
        )
        if ingrediente is None:
            raise IngredienteNotFoundError("Ingrediente no encontrado")
        return ingrediente
