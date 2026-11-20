"""Previous and next record of a detail page (HT08): shared by products, elaboraciones and supplies."""

from dataclasses import dataclass
from typing import Any

from sqlalchemy import Select
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Vecinos:
    """The rows next to a record in its list; None at the ends."""

    anterior: Any | None
    siguiente: Any | None


def buscar_vecinos(db: Session, consulta: Select, registro_id: int) -> Vecinos | None:
    """Neighbours of `registro_id` inside `consulta`, or None when the record is not in it.

    `consulta` comes ALREADY filtered (the productor's own records, without the excluded ones) and
    ordered exactly like its list, and selects light columns that include `id` (plus what the link
    shows, e.g. `nombre`). One read-only query; the position is found here, not in SQL, so NULLs in the
    order columns behave exactly as in the list.
    """
    filas = list(db.execute(consulta).all())
    posicion = next((i for i, fila in enumerate(filas) if fila.id == registro_id), None)
    if posicion is None:
        return None
    return Vecinos(
        anterior=filas[posicion - 1] if posicion > 0 else None,
        siguiente=filas[posicion + 1] if posicion + 1 < len(filas) else None,
    )
