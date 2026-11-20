from pydantic import BaseModel, ConfigDict

from app.repositories.vecinos import Vecinos


class VecinoRead(BaseModel):
    """A neighbouring record in the detail navigation (HT08): only what the link needs."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class VecinosRead(BaseModel):
    """Previous and next record in the default order of its list (HT08, CA8–CA10). None at the ends."""

    anterior: VecinoRead | None
    siguiente: VecinoRead | None

    @classmethod
    def desde(cls, vecinos: Vecinos) -> "VecinosRead":
        return cls(
            anterior=VecinoRead.model_validate(vecinos.anterior) if vecinos.anterior is not None else None,
            siguiente=VecinoRead.model_validate(vecinos.siguiente) if vecinos.siguiente is not None else None,
        )
