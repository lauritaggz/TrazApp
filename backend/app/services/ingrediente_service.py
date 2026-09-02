from app.models import Ingrediente, Productor
from app.repositories.ingrediente_repository import (
    DuplicateComposicionComponenteError,
    IngredienteRepository,
)
from app.schemas.ingrediente import (
    TIPO_COMPUESTO,
    TIPO_SIMPLE,
    ComposicionComponenteCreate,
    ComposicionComponenteRead,
    ComposicionComponenteUpdate,
    IngredienteGestionCreate,
    IngredienteGestionRead,
    IngredienteGestionUpdate,
)


class IngredienteNotFoundError(Exception):
    """Raised when an ingredient is not visible to the authenticated productor."""


class ComposicionNotFoundError(Exception):
    """Raised when a composition row is not found for the compound ingredient."""


class InvalidTipoIngredienteError(Exception):
    """Raised when a tipo change violates HU02 business rules."""


class InvalidComposicionError(Exception):
    """Raised when a composition operation violates HU02 business rules."""


class IngredienteService:
    def __init__(self, repository: IngredienteRepository) -> None:
        self.repository = repository

    def create(
        self,
        productor: Productor,
        payload: IngredienteGestionCreate,
    ) -> IngredienteGestionRead:
        self._validate_tipo_on_create(payload.tipo)
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
        if "tipo" in updates:
            self._validate_tipo_on_update(ingrediente, updates["tipo"])
        updated = self.repository.update(ingrediente, **updates)
        return IngredienteGestionRead.model_validate(updated)

    def delete_mine(self, productor: Productor, ingrediente_id: int) -> None:
        ingrediente = self._get_owned_or_raise(productor.id, ingrediente_id)
        self.repository.deactivate(ingrediente)

    def list_composicion_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
    ) -> list[ComposicionComponenteRead]:
        compuesto = self._get_compuesto_owned_or_raise(productor.id, ingrediente_id)
        composiciones = self.repository.list_composicion(compuesto.id)
        return [ComposicionComponenteRead.from_composicion(item) for item in composiciones]

    def add_composicion_component_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
        payload: ComposicionComponenteCreate,
    ) -> ComposicionComponenteRead:
        compuesto = self._get_compuesto_owned_or_raise(productor.id, ingrediente_id)
        componente = self._get_active_component_or_raise(
            productor.id,
            payload.ingrediente_componente_id,
        )
        self._validate_new_component(compuesto, componente)
        try:
            composicion = self.repository.add_composicion(
                compuesto_id=compuesto.id,
                componente_id=componente.id,
                porcentaje=payload.porcentaje,
                orden=payload.orden,
            )
        except DuplicateComposicionComponenteError as exc:
            raise InvalidComposicionError(str(exc)) from exc
        return ComposicionComponenteRead.from_composicion(composicion)

    def update_composicion_component_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
        composicion_id: int,
        payload: ComposicionComponenteUpdate,
    ) -> ComposicionComponenteRead:
        compuesto = self._get_compuesto_owned_or_raise(productor.id, ingrediente_id)
        composicion = self.repository.get_composicion_by_id_and_compuesto(
            composicion_id,
            compuesto.id,
        )
        if composicion is None:
            raise ComposicionNotFoundError("Componente de composición no encontrado.")
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return ComposicionComponenteRead.from_composicion(composicion)
        updated = self.repository.update_composicion(composicion, **updates)
        return ComposicionComponenteRead.from_composicion(updated)

    def delete_composicion_component_mine(
        self,
        productor: Productor,
        ingrediente_id: int,
        composicion_id: int,
    ) -> None:
        compuesto = self._get_compuesto_owned_or_raise(productor.id, ingrediente_id)
        composicion = self.repository.get_composicion_by_id_and_compuesto(
            composicion_id,
            compuesto.id,
        )
        if composicion is None:
            raise ComposicionNotFoundError("Componente de composición no encontrado.")
        self.repository.delete_composicion(composicion)

    def _get_owned_or_raise(self, productor_id: int, ingrediente_id: int) -> Ingrediente:
        ingrediente = self.repository.get_by_id_and_productor(
            ingrediente_id,
            productor_id,
        )
        if ingrediente is None:
            raise IngredienteNotFoundError("Ingrediente no encontrado")
        return ingrediente

    @staticmethod
    def _validate_tipo_on_create(tipo: str) -> None:
        if tipo == TIPO_SIMPLE:
            return
        if tipo == TIPO_COMPUESTO:
            return
        raise InvalidTipoIngredienteError("El tipo de ingrediente no es válido.")

    def _validate_tipo_on_update(self, ingrediente: Ingrediente, nuevo_tipo: str) -> None:
        if nuevo_tipo not in {TIPO_SIMPLE, TIPO_COMPUESTO}:
            raise InvalidTipoIngredienteError("El tipo de ingrediente no es válido.")
        if nuevo_tipo == ingrediente.tipo:
            return
        if nuevo_tipo == TIPO_SIMPLE and self.repository.has_componentes(ingrediente.id):
            raise InvalidTipoIngredienteError(
                "No se puede cambiar a simple mientras el ingrediente tenga componentes asociados."
            )

    def _get_compuesto_owned_or_raise(
        self,
        productor_id: int,
        ingrediente_id: int,
    ) -> Ingrediente:
        ingrediente = self._get_owned_or_raise(productor_id, ingrediente_id)
        if ingrediente.tipo != TIPO_COMPUESTO:
            raise InvalidComposicionError(
                "Solo los ingredientes compuestos pueden tener composición declarada."
            )
        return ingrediente

    def _get_active_component_or_raise(
        self,
        productor_id: int,
        componente_id: int,
    ) -> Ingrediente:
        componente = self.repository.get_by_id_and_productor(
            componente_id,
            productor_id,
            active_only=True,
        )
        if componente is None:
            raise IngredienteNotFoundError("Ingrediente no encontrado")
        return componente

    def _validate_new_component(
        self,
        compuesto: Ingrediente,
        componente: Ingrediente,
    ) -> None:
        if compuesto.id == componente.id:
            raise InvalidComposicionError(
                "Un ingrediente no puede ser componente de sí mismo."
            )
        if not componente.activo:
            raise InvalidComposicionError("No se pueden usar componentes inactivos.")
        if self.repository.would_create_cycle(compuesto.id, componente.id):
            raise InvalidComposicionError(
                "La composición generaría un ciclo entre ingredientes."
            )
