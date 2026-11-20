"""Migration 020 tests against a real PostgreSQL test database (HU11 / T11-01).

These tests drop and recreate the `public` schema, so they only run when TEST_DATABASE_URL points to a
PostgreSQL database whose name ends in `_test`.

While the migration is a proposal it lives as `020_evaluacion_utilidad_hu11.py.pendiente`, which
Alembic ignores. The tests copy the script directory to a temporary folder and give the file its
`.py` name there, so they exercise the real file in both states (pending or approved).
"""

import shutil
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import DataError, IntegrityError

from app.db.base import Base
from tests.test_migracion_011_alergenos import _reset_schema
from tests.test_migracion_015_elaboraciones import (
    _columnas,
    _conteos,
    _existe_tabla,
    _restricciones,
    _revision,
)
from tests.test_migracion_016_elaboracion_inmutable import _semilla
from tests.test_migracion_017_alergenos_revisados import engine, test_url  # noqa: F401  (fixtures)
from tests.test_triggers_elaboracion_hu05 import _ejecutar, _finalizada, _fila, _usos

REV_019 = "019_costos_producto_hu14"
REV_020 = "020_evaluacion_utilidad_hu11"
BACKEND_DIR = Path(__file__).resolve().parents[1]
VERSIONES = BACKEND_DIR / "alembic" / "versions"
ARCHIVO_020 = "020_evaluacion_utilidad_hu11.py"
TABLA = "evaluaciones_utilidad"
HASH = "a" * 64

COLUMNAS = {
    "id": ("integer", "NO"),
    "producto_id": ("integer", "NO"),
    "elaboracion_id": ("integer", "NO"),
    "util": ("boolean", "NO"),
    "nonce_hash": ("character varying", "NO"),
    "fecha": ("date", "NO"),
}


@pytest.fixture
def alembic_cfg(test_url: str, tmp_path: Path) -> Config:  # noqa: F811
    """A copy of the script directory in which 020 always has its `.py` name."""
    destino = tmp_path / "alembic"
    shutil.copytree(
        BACKEND_DIR / "alembic",
        destino,
        ignore=shutil.ignore_patterns("__pycache__", "*.pendiente"),
    )
    origen = VERSIONES / ARCHIVO_020
    if not origen.exists():
        origen = VERSIONES / f"{ARCHIVO_020}.pendiente"
    assert origen.exists(), "falta la migración 020 (ni .py ni .py.pendiente)"
    shutil.copy(origen, destino / "versions" / ARCHIVO_020)
    cfg = Config()
    cfg.set_main_option("script_location", str(destino))
    return cfg


@pytest.fixture
def db_at_019(engine: Engine, alembic_cfg: Config) -> Engine:  # noqa: F811
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_019)
    _semilla(engine)
    return engine


@pytest.fixture
def db_at_020(db_at_019: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_020)
    return db_at_019


def _evaluar(engine: Engine, elaboracion: int, nonce_hash: str = HASH, util: bool = True) -> None:
    _ejecutar(
        engine,
        "INSERT INTO evaluaciones_utilidad (producto_id, elaboracion_id, util, nonce_hash, fecha) "
        "SELECT producto_id, id, :util, :h, DATE '2026-11-19' FROM elaboraciones WHERE id = :e",
        util=util,
        h=nonce_hash,
        e=elaboracion,
    )


def _estado(engine: Engine) -> dict[str, list[tuple]]:
    """What 020 must never change: the rows of the tables it does not own."""
    consultas = {
        "productos": "SELECT id, productor_id, nombre, activo, publicado, id_publico FROM productos ORDER BY id",
        "ingredientes": "SELECT id, productor_id, nombre, activo FROM ingredientes ORDER BY id",
        "insumos": "SELECT id, productor_id, nombre, precio_referencia FROM insumos_comerciales ORDER BY id",
    }
    with engine.connect() as conn:
        return {clave: [tuple(f) for f in conn.execute(text(sql))] for clave, sql in consultas.items()}


# --- cabeza de Alembic -----------------------------------------------------------------------------


def test_la_cabeza_de_alembic_es_la_020_y_cuelga_de_la_019(alembic_cfg: Config) -> None:
    scripts = ScriptDirectory.from_config(alembic_cfg)

    assert scripts.get_heads() == [REV_020]
    assert scripts.get_revision(REV_020).down_revision == REV_019
    assert len(REV_020) <= 32


def test_la_020_esta_en_la_cadena_real_o_pendiente() -> None:
    """Against the real script directory: approved (a `.py` and the head) or still a `.pendiente`."""
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    scripts = ScriptDirectory.from_config(cfg)

    if (VERSIONES / ARCHIVO_020).exists():
        assert scripts.get_heads() == [REV_020]
        assert scripts.get_revision(REV_020).down_revision == REV_019
    else:
        assert (VERSIONES / f"{ARCHIVO_020}.pendiente").exists()
        assert scripts.get_heads() == [REV_019]


# --- upgrade ---------------------------------------------------------------------------------------


def test_upgrade_020_crea_la_tabla_con_el_conjunto_exacto_de_columnas(db_at_020: Engine) -> None:
    columnas = _columnas(db_at_020, TABLA)

    assert {nombre: valor[:2] for nombre, valor in columnas.items()} == COLUMNAS
    assert columnas["nonce_hash"][2] == 64
    assert _revision(db_at_020) == REV_020


def test_upgrade_020_crea_unicidad_fk_restrict_y_check(db_at_020: Engine) -> None:
    assert _restricciones(db_at_020, TABLA, "u") == {"uq_evaluaciones_utilidad_nonce_hash": "UNIQUE (nonce_hash)"}
    foraneas = _restricciones(db_at_020, TABLA, "f")
    assert set(foraneas) == {"fk_evaluaciones_utilidad_producto", "fk_evaluaciones_utilidad_elaboracion"}
    assert all("ON DELETE RESTRICT" in definicion for definicion in foraneas.values())
    assert set(_restricciones(db_at_020, TABLA, "c")) == {"ck_evaluaciones_utilidad_nonce_hash"}


def test_el_modelo_coincide_con_la_migracion(db_at_020: Engine) -> None:
    """A change only in the model or only in the migration would make the two schemas drift."""
    tabla = Base.metadata.tables[TABLA]

    assert set(tabla.columns.keys()) == set(_columnas(db_at_020, TABLA))
    assert {c.name for c in tabla.constraints if c.name} >= {
        "uq_evaluaciones_utilidad_nonce_hash",
        "ck_evaluaciones_utilidad_nonce_hash",
        "fk_evaluaciones_utilidad_producto",
        "fk_evaluaciones_utilidad_elaboracion",
    }


def test_la_tabla_rechaza_un_nonce_repetido_y_un_hash_de_otro_largo(db_at_020: Engine) -> None:
    elaboracion = _finalizada(db_at_020, "E-001")
    _evaluar(db_at_020, elaboracion)

    with pytest.raises(IntegrityError):
        _evaluar(db_at_020, elaboracion, util=False)  # same nonce_hash
    # A nonce or a token cannot be stored: too short fails the CHECK, too long fails varchar(64).
    for invalido in ("corto", "a" * 22, "a" * 65):
        with pytest.raises((IntegrityError, DataError)):
            _evaluar(db_at_020, elaboracion, nonce_hash=invalido)
    assert _conteos_evaluaciones(db_at_020) == 1


def test_la_tabla_no_deja_borrar_la_elaboracion_ni_el_producto_evaluados(db_at_020: Engine) -> None:
    elaboracion = _finalizada(db_at_020, "E-001")
    _evaluar(db_at_020, elaboracion)

    with pytest.raises(Exception):
        _ejecutar(db_at_020, "DELETE FROM productos WHERE id = (SELECT producto_id FROM elaboraciones WHERE id = :e)", e=elaboracion)
    assert _conteos_evaluaciones(db_at_020) == 1


def test_upgrade_020_no_toca_las_otras_tablas_ni_las_elaboraciones(db_at_019: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_019, "E-001")
    antes = (_estado(db_at_019), _fila(db_at_019, finalizada), _usos(db_at_019, finalizada), _conteos(db_at_019))

    command.upgrade(alembic_cfg, REV_020)

    assert (_estado(db_at_019), _fila(db_at_019, finalizada), _usos(db_at_019, finalizada), _conteos(db_at_019)) == antes
    assert _conteos_evaluaciones(db_at_019) == 0


# --- downgrade -------------------------------------------------------------------------------------


def _conteos_evaluaciones(engine: Engine) -> int:
    with engine.connect() as conn:
        return conn.execute(text(f"SELECT count(*) FROM {TABLA}")).scalar_one()


def test_downgrade_020_revierte_sin_evaluaciones(db_at_020: Engine, alembic_cfg: Config) -> None:
    command.downgrade(alembic_cfg, REV_019)

    assert _revision(db_at_020) == REV_019
    assert not _existe_tabla(db_at_020, TABLA)


def test_downgrade_020_se_niega_si_hay_evaluaciones_y_no_cambia_nada(db_at_020: Engine, alembic_cfg: Config) -> None:
    elaboracion = _finalizada(db_at_020, "E-001")
    _evaluar(db_at_020, elaboracion)
    antes = _estado(db_at_020)

    with pytest.raises(RuntimeError, match="020") as error:
        command.downgrade(alembic_cfg, REV_019)

    assert "1 evaluación(es)" in str(error.value)
    assert _revision(db_at_020) == REV_020
    assert _existe_tabla(db_at_020, TABLA)
    assert _conteos_evaluaciones(db_at_020) == 1
    assert _estado(db_at_020) == antes


def test_upgrade_downgrade_upgrade(db_at_019: Engine, alembic_cfg: Config) -> None:
    command.upgrade(alembic_cfg, REV_020)
    command.downgrade(alembic_cfg, REV_019)
    command.upgrade(alembic_cfg, REV_020)

    assert _revision(db_at_019) == REV_020
    assert _existe_tabla(db_at_019, TABLA)
