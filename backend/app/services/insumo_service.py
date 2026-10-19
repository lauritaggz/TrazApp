from sqlalchemy.exc import IntegrityError

from app.models import Ingrediente, InsumoAlergeno, InsumoComercial, Productor
from app.models.insumo import FUENTE_MANUAL
from app.repositories.insumo_repository import InsumoRepository
from app.schemas.insumo import (
    AlergenoDeclaradoRead,
    InsumoAlergenoCreate,
    InsumoAlergenosReplace,
    InsumoAlergenoUpdate,
    InsumoCreate,
    InsumoRead,
    InsumoUpdate,
    ordenar_declarados,
)

MENSAJE_ALERGENO_REPETIDO = "El alérgeno ya está asociado al insumo."
MENSAJE_ALERGENO_NO_VALIDO = "Alérgeno no válido"
MENSAJE_ALERGENO_EN_LISTA_REPETIDO = "El alérgeno está repetido en la lista."
MENSAJE_CAMBIO_SIMULTANEO = (
    "No se pudo guardar el insumo por un cambio simultáneo. Inténtalo nuevamente."
)
MENSAJE_FUENTE_SIN_FECHA = (
    "Indica la fecha de recuperación de la información cuando el insumo viene de una fuente externa."
)
MENSAJE_CODIGO_ACTIVO = "Ya existe un insumo con ese código de barras."
MENSAJE_CODIGO_INACTIVO = (
    "Ya existe un insumo desactivado con ese código de barras. Puedes reactivarlo."
)


class InsumoNotFoundError(Exception):
    """Raised when a supply is not visible to the authenticated productor."""


class InvalidInsumoError(Exception):
    """Raised when a supply operation violates HU04 business rules (422)."""


class InsumoAlergenoNotFoundError(Exception):
    """Raised when the allergen is not declared by the supply (404, URL resource)."""


class FuenteSinFechaError(InvalidInsumoError):
    """A supply that comes from an external source must say when the information was retrieved (CA11)."""

    campo = "fecha_recuperacion"

    def __init__(self) -> None:
        super().__init__(MENSAJE_FUENTE_SIN_FECHA)


class InvalidInsumoAlergenoError(Exception):
    """Raised when an allergen operation is not valid: unknown allergen or repeated (422)."""


class InvalidAlergenosError(Exception):
    """Raised when a list of allergens sent in bulk is not valid: unknown or repeated (422).

    Carries the offending allergen so the client can point at it (detail: mensaje + alergeno_id).
    """

    def __init__(self, mensaje: str, alergeno_id: int) -> None:
        self.mensaje = mensaje
        self.alergeno_id = alergeno_id
        super().__init__(mensaje)


class InsumoConflictError(Exception):
    """Raised when a concurrent change prevented saving the supply (409)."""


class DuplicateCodigoBarrasError(Exception):
    """Raised when the barcode already belongs to a supply of the same productor.

    Carries the existing supply so the client can offer to use or reactivate it.
    """

    def __init__(self, existente: InsumoComercial) -> None:
        self.insumo_id = existente.id
        self.activo = existente.activo
        super().__init__(MENSAJE_CODIGO_ACTIVO if existente.activo else MENSAJE_CODIGO_INACTIVO)


class InsumoService:
    def __init__(self, repository: InsumoRepository) -> None:
        self.repository = repository

    def create(self, productor: Productor, payload: InsumoCreate) -> InsumoRead:
        # Retrieved information is only credible with the date it was retrieved (CA11).
        if payload.fuente != FUENTE_MANUAL and payload.fecha_recuperacion is None:
            raise FuenteSinFechaError()
        # Read the id up front: after a failed flush the session cannot refresh ORM objects.
        productor_id = productor.id
        ingrediente = self._get_valid_ingrediente(productor_id, payload.ingrediente_id)
        alergenos = payload.alergenos
        if alergenos is not None:
            self._validar_alergenos(alergenos)
        data = payload.model_dump(exclude={"alergenos"})
        self._ensure_codigo_disponible(productor_id, data["codigo_barras"])

        insumo = InsumoComercial(productor_id=productor_id, **data)
        if alergenos is not None:
            # Same transaction as the supply: all or nothing. Sent (even empty) = reviewed.
            insumo.alergenos_declarados = [
                InsumoAlergeno(alergeno_id=a.alergeno_id, tipo=a.tipo) for a in alergenos
            ]
            self.repository.marcar_alergenos_revisados(insumo)
        try:
            if insumo.habitual:
                self._claim_habitual(ingrediente.id)
            self.repository.add(insumo)
            self.repository.commit()
        except IntegrityError as exc:
            self._raise_for_integrity_error(productor_id, data["codigo_barras"], exc)
        return InsumoRead.from_insumo(self.repository.reload(insumo.id, productor_id))

    def list_mine(
        self,
        productor: Productor,
        *,
        activo: bool = True,
        ingrediente_id: int | None = None,
    ) -> list[InsumoRead]:
        insumos = self.repository.list_by_productor(
            productor.id,
            activo=activo,
            ingrediente_id=ingrediente_id,
        )
        return [InsumoRead.from_insumo(insumo) for insumo in insumos]

    def get_mine(self, productor: Productor, insumo_id: int) -> InsumoRead:
        return InsumoRead.from_insumo(self._get_owned_or_raise(productor.id, insumo_id))

    def update_mine(
        self,
        productor: Productor,
        insumo_id: int,
        payload: InsumoUpdate,
    ) -> InsumoRead:
        productor_id = productor.id
        insumo = self._get_owned_or_raise(productor_id, insumo_id)
        updates = payload.model_dump(exclude_unset=True)
        if not updates:
            return InsumoRead.from_insumo(insumo)

        target_ingrediente_id = insumo.ingrediente_id
        if "ingrediente_id" in updates and updates["ingrediente_id"] != insumo.ingrediente_id:
            target_ingrediente_id = self._get_valid_ingrediente(
                productor_id, updates["ingrediente_id"]
            ).id

        codigo = updates.get("codigo_barras")
        if codigo is not None and codigo != insumo.codigo_barras:
            self._ensure_codigo_disponible(productor_id, codigo, exclude_id=insumo.id)

        insumo_pk = insumo.id
        final = self._resolve_habitual(insumo, updates, target_ingrediente_id)
        updates["habitual"] = final
        if "activo" in updates and updates["activo"] is False:
            updates["habitual"] = False

        try:
            if updates["habitual"]:
                self._claim_habitual(target_ingrediente_id, except_id=insumo_pk)
            for field, value in updates.items():
                setattr(insumo, field, value)
            self.repository.commit()
        except IntegrityError as exc:
            self._raise_for_integrity_error(productor_id, updates.get("codigo_barras"), exc)
        return InsumoRead.from_insumo(self.repository.reload(insumo_pk, productor_id))

    def delete_mine(self, productor: Productor, insumo_id: int) -> None:
        """Deactivate (soft delete). A deactivated habitual supply loses the mark."""
        insumo = self._get_owned_or_raise(productor.id, insumo_id)
        if not insumo.activo:
            return
        insumo.activo = False
        insumo.habitual = False
        self.repository.commit()

    # --- allergens declared by the supply (T04-04) ---

    def list_alergenos_mine(
        self,
        productor: Productor,
        insumo_id: int,
    ) -> list[AlergenoDeclaradoRead]:
        insumo = self._get_owned_or_raise(productor.id, insumo_id)
        return [
            AlergenoDeclaradoRead.from_declarado(d)
            for d in ordenar_declarados(insumo.alergenos_declarados)
        ]

    def replace_alergenos_mine(
        self,
        productor: Productor,
        insumo_id: int,
        payload: InsumoAlergenosReplace,
    ) -> InsumoRead:
        """Replace the whole list of declared allergens and mark the supply as reviewed (HT06).

        An empty list means "reviewed, no allergens". Like PATCH, it works on a deactivated
        supply. The list is validated before anything is locked or changed, so a rejected
        request leaves the previous list (and review date) as they were.
        """
        productor_id = productor.id
        self._get_owned_or_raise(productor_id, insumo_id)
        self._validar_alergenos(payload.alergenos)

        insumo = self.repository.lock_insumo(insumo_id, productor_id)
        if insumo is None:
            raise InsumoNotFoundError("Insumo no encontrado")
        deseados = {a.alergeno_id: a.tipo for a in payload.alergenos}
        for declarado in list(insumo.alergenos_declarados):
            if declarado.alergeno_id in deseados:
                declarado.tipo = deseados.pop(declarado.alergeno_id)
            else:
                insumo.alergenos_declarados.remove(declarado)
        for alergeno_id, tipo in deseados.items():
            insumo.alergenos_declarados.append(InsumoAlergeno(alergeno_id=alergeno_id, tipo=tipo))
        self.repository.marcar_alergenos_revisados(insumo)
        try:
            self.repository.commit()
        except IntegrityError as exc:
            self.repository.rollback()
            raise InsumoConflictError(MENSAJE_CAMBIO_SIMULTANEO) from exc
        return InsumoRead.from_insumo(self.repository.reload(insumo_id, productor_id))

    def add_alergeno_mine(
        self,
        productor: Productor,
        insumo_id: int,
        payload: InsumoAlergenoCreate,
    ) -> AlergenoDeclaradoRead:
        insumo = self._get_owned_or_raise(productor.id, insumo_id)
        insumo_pk = insumo.id
        if self.repository.get_alergeno(payload.alergeno_id) is None:
            raise InvalidInsumoAlergenoError("Alérgeno no válido")
        if self.repository.get_declarado(insumo_pk, payload.alergeno_id) is not None:
            raise InvalidInsumoAlergenoError(MENSAJE_ALERGENO_REPETIDO)

        self.repository.add_declarado(insumo_pk, payload.alergeno_id, payload.tipo)
        self.repository.marcar_alergenos_revisados(insumo)
        try:
            self.repository.commit()
        except IntegrityError as exc:
            self.repository.rollback()
            if self.repository.get_declarado(insumo_pk, payload.alergeno_id) is not None:
                raise InvalidInsumoAlergenoError(MENSAJE_ALERGENO_REPETIDO) from exc
            raise InsumoConflictError(MENSAJE_CAMBIO_SIMULTANEO) from exc
        return AlergenoDeclaradoRead.from_declarado(
            self._get_declarado_or_raise(insumo_pk, payload.alergeno_id)
        )

    def update_alergeno_mine(
        self,
        productor: Productor,
        insumo_id: int,
        alergeno_id: int,
        payload: InsumoAlergenoUpdate,
    ) -> AlergenoDeclaradoRead:
        insumo = self._get_owned_or_raise(productor.id, insumo_id)
        insumo_pk = insumo.id
        declarado = self._get_declarado_or_raise(insumo_pk, alergeno_id)
        if declarado.tipo != payload.tipo:
            declarado.tipo = payload.tipo
            self.repository.marcar_alergenos_revisados(insumo)
            self.repository.commit()
            declarado = self._get_declarado_or_raise(insumo_pk, alergeno_id)
        elif insumo.alergenos_revisados_at is None:
            # Same type: nothing changes, except that a supply with declared allergens is never
            # left unreviewed. An already reviewed supply is not touched (no new date).
            self.repository.marcar_alergenos_revisados(insumo)
            self.repository.commit()
            declarado = self._get_declarado_or_raise(insumo_pk, alergeno_id)
        return AlergenoDeclaradoRead.from_declarado(declarado)

    def delete_alergeno_mine(
        self,
        productor: Productor,
        insumo_id: int,
        alergeno_id: int,
    ) -> None:
        insumo = self._get_owned_or_raise(productor.id, insumo_id)
        declarado = self._get_declarado_or_raise(insumo.id, alergeno_id)
        self.repository.delete_declarado(declarado)
        # Removing the last one leaves "reviewed, no allergens": a decision, not a blank.
        self.repository.marcar_alergenos_revisados(insumo)
        self.repository.commit()

    # --- helpers ---

    def _validar_alergenos(self, alergenos: list) -> None:
        """422 for a repeated or unknown allergen in a bulk list (the type is checked by the schema)."""
        vistos: set[int] = set()
        for item in alergenos:
            if item.alergeno_id in vistos:
                raise InvalidAlergenosError(MENSAJE_ALERGENO_EN_LISTA_REPETIDO, item.alergeno_id)
            vistos.add(item.alergeno_id)
        existentes = self.repository.alergeno_ids_existentes([a.alergeno_id for a in alergenos])
        for item in alergenos:
            if item.alergeno_id not in existentes:
                raise InvalidAlergenosError(MENSAJE_ALERGENO_NO_VALIDO, item.alergeno_id)

    def _get_declarado_or_raise(self, insumo_id: int, alergeno_id: int):
        declarado = self.repository.get_declarado(insumo_id, alergeno_id)
        if declarado is None:
            raise InsumoAlergenoNotFoundError("Asociación de alérgeno no encontrada.")
        return declarado

    def _get_owned_or_raise(self, productor_id: int, insumo_id: int) -> InsumoComercial:
        insumo = self.repository.get_by_id_and_productor(insumo_id, productor_id)
        if insumo is None:
            raise InsumoNotFoundError("Insumo no encontrado")
        return insumo

    def _get_valid_ingrediente(self, productor_id: int, ingrediente_id: int) -> Ingrediente:
        ingrediente = self.repository.get_active_ingrediente(productor_id, ingrediente_id)
        if ingrediente is None:
            raise InvalidInsumoError("Ingrediente no válido")
        return ingrediente

    def _ensure_codigo_disponible(
        self,
        productor_id: int,
        codigo_barras: str | None,
        *,
        exclude_id: int | None = None,
    ) -> None:
        if codigo_barras is None:
            return
        existente = self.repository.find_by_codigo_barras(
            productor_id,
            codigo_barras,
            exclude_id=exclude_id,
        )
        if existente is not None:
            raise DuplicateCodigoBarrasError(existente)

    @staticmethod
    def _resolve_habitual(
        insumo: InsumoComercial,
        updates: dict,
        target_ingrediente_id: int,
    ) -> bool:
        """Final habitual mark of the supply after applying a PATCH.

        - Marking an inactive supply (or deactivating and marking at once) is not allowed.
        - Changing the ingredient drops the mark unless the same request marks it again.
        - Deactivating drops the mark (applied by the caller).
        """
        activo_final = updates.get("activo", insumo.activo)
        if updates.get("habitual") is True and not activo_final:
            raise InvalidInsumoError("Un insumo desactivado no puede ser habitual.")
        if "habitual" in updates:
            return bool(updates["habitual"])
        if target_ingrediente_id != insumo.ingrediente_id:
            return False
        return insumo.habitual

    def _claim_habitual(self, ingrediente_id: int, *, except_id: int | None = None) -> None:
        """Make room for a new habitual supply: lock the ingredient and unmark the previous."""
        self.repository.lock_ingrediente(ingrediente_id)
        self.repository.clear_habitual(ingrediente_id, except_id=except_id)

    def _raise_for_integrity_error(
        self,
        productor_id: int,
        codigo_barras: str | None,
        exc: IntegrityError,
    ) -> None:
        """Translate a database rejection: the barcode when it is the cause, else a race."""
        self.repository.rollback()
        if codigo_barras is not None:
            existente = self.repository.find_by_codigo_barras(productor_id, codigo_barras)
            if existente is not None:
                raise DuplicateCodigoBarrasError(existente) from exc
        raise InsumoConflictError(MENSAJE_CAMBIO_SIMULTANEO) from exc
