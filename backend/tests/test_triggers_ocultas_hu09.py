"""Hiding an elaboración does not weaken the immutability of finalized ones (T09-01 / HU09).

PostgreSQL only. The schema comes from `create_all`, which installs the triggers of migration 016
(unchanged) plus the new one of elaboraciones_ocultas. Statements go straight to the database.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.triggers_elaboracion import MARCADOR_FINALIZADA, MARCADOR_OCULTAR_NO_FINALIZADA
from tests.conftest import USE_POSTGRESQL
from tests.test_triggers_elaboracion_hu05 import (
    _ejecutar,
    _elaborar,
    _escalar,
    _fila,
    _finalizada,
    _rechaza,
    _usos,
    bd,  # noqa: F401  (fixture)
)

pytestmark = pytest.mark.skipif(not USE_POSTGRESQL, reason="Los triggers de elaboraciones son de PostgreSQL.")


def _ocultar(engine: Engine, elaboracion: int) -> None:
    _ejecutar(engine, "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:e)", e=elaboracion)


def _ocultas(engine: Engine) -> list[int]:
    with engine.connect() as conn:
        return list(conn.execute(text("SELECT elaboracion_id FROM elaboraciones_ocultas ORDER BY 1")).scalars())


def test_ocultar_una_finalizada_funciona_y_no_cambia_la_elaboracion_ni_sus_usos(bd: Engine) -> None:
    elaboracion = _finalizada(bd)
    antes = (_fila(bd, elaboracion), _usos(bd, elaboracion))
    tocada = _escalar(bd, "SELECT updated_at FROM elaboraciones WHERE id = :e", e=elaboracion)

    _ocultar(bd, elaboracion)

    assert _ocultas(bd) == [elaboracion]
    assert (_fila(bd, elaboracion), _usos(bd, elaboracion)) == antes
    assert _escalar(bd, "SELECT updated_at FROM elaboraciones WHERE id = :e", e=elaboracion) == tocada


def test_volver_a_mostrar_una_finalizada_funciona(bd: Engine) -> None:
    elaboracion = _finalizada(bd)
    _ocultar(bd, elaboracion)

    _ejecutar(bd, "DELETE FROM elaboraciones_ocultas WHERE elaboracion_id = :e", e=elaboracion)

    assert _ocultas(bd) == []
    assert _fila(bd, elaboracion)[1] == "finalizada"


def test_el_trigger_rechaza_ocultar_un_borrador(bd: Engine) -> None:
    borrador = _elaborar(bd, "E-BORRADOR")

    _rechaza(
        bd,
        "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:e)",
        MARCADOR_OCULTAR_NO_FINALIZADA,
        e=borrador,
    )

    assert _ocultas(bd) == []


def test_un_insert_masivo_con_un_borrador_falla_completo(bd: Engine) -> None:
    finalizada = _finalizada(bd, "E-001")
    borrador = _elaborar(bd, "E-002")

    _rechaza(
        bd,
        "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:a), (:b)",
        MARCADOR_OCULTAR_NO_FINALIZADA,
        a=finalizada,
        b=borrador,
    )

    assert _ocultas(bd) == []


@pytest.mark.parametrize(
    "sentencia",
    [
        "UPDATE elaboraciones SET codigo = 'OTRO' WHERE id = :e",
        "UPDATE elaboraciones SET fecha_elaboracion = DATE '2020-01-01' WHERE id = :e",
        "UPDATE elaboraciones SET estado = 'borrador', finalizada_at = NULL WHERE id = :e",
        "UPDATE elaboraciones SET finalizada_at = now() WHERE id = :e",
        "UPDATE elaboraciones SET updated_at = now() WHERE id = :e",
        "DELETE FROM elaboraciones WHERE id = :e",
    ],
)
def test_una_finalizada_oculta_sigue_siendo_inmutable(bd: Engine, sentencia: str) -> None:
    elaboracion = _finalizada(bd)
    _ocultar(bd, elaboracion)
    antes = _fila(bd, elaboracion)

    _rechaza(bd, sentencia, MARCADOR_FINALIZADA, e=elaboracion)

    assert _fila(bd, elaboracion) == antes
    assert _ocultas(bd) == [elaboracion]


def test_los_usos_de_una_finalizada_oculta_siguen_bloqueados(bd: Engine) -> None:
    elaboracion = _finalizada(bd)
    _ocultar(bd, elaboracion)
    antes = _usos(bd, elaboracion)

    _rechaza(bd, "UPDATE usos_insumo SET sin_lote = true WHERE elaboracion_id = :e", MARCADOR_FINALIZADA, e=elaboracion)
    _rechaza(bd, "DELETE FROM usos_insumo WHERE elaboracion_id = :e", MARCADOR_FINALIZADA, e=elaboracion)

    assert _usos(bd, elaboracion) == antes
