"""Payloads of the anonymous evaluation (HU11, T11-01). Public endpoint: no authentication.

`token` is a plain `str` on purpose: any length or shape problem is judged by the token check, so
the 422 of an unusable token is always the same one. `util` is a strict boolean ("si" or 1 are not
accepted). Undeclared fields (an `ip`, a `user_agent`...) are rejected.
"""

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool


class EvaluacionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    token: str
    util: StrictBool


class EvaluacionRegistradaRead(BaseModel):
    """The only thing the consumer gets back: no id and nothing internal."""

    model_config = ConfigDict(extra="forbid")

    registrada: Literal[True] = True


class EvaluacionUtilidadResumen(BaseModel):
    """Answers of one product for its productor (HU11, T11-03).

    `porcentaje` is an integer rounded half up, and `null` while there are no answers (never 0).
    """

    total: int = 0
    positivas: int = 0
    porcentaje: int | None = None


class EvaluacionElaboracionRead(EvaluacionUtilidadResumen):
    codigo: str
    fecha: date


class ResultadosEvaluacionRead(EvaluacionUtilidadResumen):
    producto_id: int
    por_elaboracion: list[EvaluacionElaboracionRead] = Field(default_factory=list)
