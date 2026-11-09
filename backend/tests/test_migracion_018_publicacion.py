"""Migration 018 tests against a real PostgreSQL test database (HU09 / T09-01).

These tests drop and recreate the `public` schema, so they only run when
TEST_DATABASE_URL points to a PostgreSQL database whose name ends in `_test`.

While the migration is a proposal it lives as `018_publicacion_producto_hu09.py.pendiente`, which
Alembic ignores. The tests copy the script directory to a temporary folder and give the file its
`.py` name there, so they exercise the real file in both states (pending or approved).
"""

import shutil
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

from app.db.triggers_elaboracion import MARCADOR_OCULTAR_NO_FINALIZADA
from tests.test_migracion_011_alergenos import _reset_schema
from tests.test_migracion_015_elaboraciones import (
    _columnas,
    _conteos,
    _elaborar,
    _existe_tabla,
    _restricciones,
    _revision,
)
from tests.test_migracion_016_elaboracion_inmutable import _semilla, rol_sin_superusuario
from tests.test_migracion_017_alergenos_revisados import engine, test_url  # noqa: F401  (fixtures)
from tests.test_triggers_elaboracion_hu05 import _ejecutar, _fila, _finalizada, _rechaza, _usos

REV_017 = "017_alergenos_revisados_ht06"
REV_018 = "018_publicacion_producto_hu09"
BACKEND_DIR = Path(__file__).resolve().parents[1]
VERSIONES = BACKEND_DIR / "alembic" / "versions"
ARCHIVO_018 = "018_publicacion_producto_hu09.py"
TRIGGERS_016 = {
    "trg_elaboraciones_nacen_borrador": "elaboraciones",
    "trg_elaboraciones_inmutables": "elaboraciones",
    "trg_elaboraciones_finalizacion_completa": "elaboraciones",
    "trg_usos_insumo_elaboracion_abierta": "usos_insumo",
}
TRIGGER_018 = "trg_elaboraciones_ocultas_finalizada"
FUNCION_018 = "fn_elaboraciones_ocultas_finalizada"


@pytest.fixture
def alembic_cfg(test_url: str, tmp_path: Path) -> Config:  # noqa: F811
    """A copy of the script directory in which 018 always has its `.py` name."""
    destino = tmp_path / "alembic"
    shutil.copytree(
        BACKEND_DIR / "alembic",
        destino,
        ignore=shutil.ignore_patterns("__pycache__", "*.pendiente"),
    )
    origen = VERSIONES / ARCHIVO_018
    if not origen.exists():
        origen = VERSIONES / f"{ARCHIVO_018}.pendiente"
    assert origen.exists(), "falta la migración 018 (ni .py ni .py.pendiente)"
    shutil.copy(origen, destino / "versions" / ARCHIVO_018)
    cfg = Config()
    cfg.set_main_option("script_location", str(destino))
    return cfg


@pytest.fixture
def db_at_017(engine: Engine, alembic_cfg: Config) -> Engine:  # noqa: F811
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_017)
    _semilla(engine)
    return engine


@pytest.fixture
def db_at_018(db_at_017: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_018)
    return db_at_017


def _triggers(engine: Engine) -> dict[str, str]:
    with engine.connect() as conn:
        return {
            fila[0]: fila[1]
            for fila in conn.execute(
                text(
                    "SELECT tgname, tgrelid::regclass::text FROM pg_trigger "
                    "WHERE NOT tgisinternal AND tgname LIKE 'trg\\_%'"
                )
            )
        }


def _funcion_existe(engine: Engine, nombre: str) -> bool:
    with engine.connect() as conn:
        return bool(conn.execute(text("SELECT count(*) FROM pg_proc WHERE proname = :n"), {"n": nombre}).scalar_one())


def _fk(engine: Engine) -> str:
    with engine.connect() as conn:
        return conn.execute(
            text(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conname = 'fk_elaboraciones_ocultas_elaboracion'"
            )
        ).scalar_one()


def _publicar(engine: Engine, producto: str = "Queque") -> None:
    _ejecutar(
        engine,
        "UPDATE productos SET id_publico = 'abc123', publicado = true, publicado_en = now() WHERE nombre = :n",
        n=producto,
    )


def _ocultas(engine: Engine) -> list[int]:
    with engine.connect() as conn:
        return list(conn.execute(text("SELECT elaboracion_id FROM elaboraciones_ocultas ORDER BY 1")).scalars())


def _productos(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return [tuple(f) for f in conn.execute(text("SELECT id, productor_id, nombre, activo FROM productos ORDER BY id"))]


# --- upgrade -------------------------------------------------------------------------------------


def test_la_cabeza_de_alembic_es_la_018(alembic_cfg: Config) -> None:
    assert ScriptDirectory.from_config(alembic_cfg).get_current_head() == REV_018
    assert len(REV_018) <= 32


def test_la_cabeza_real_es_la_018_y_cuelga_de_la_017() -> None:
    """Against the real script directory (not the temporary copy of the fixtures)."""
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    scripts = ScriptDirectory.from_config(cfg)

    assert scripts.get_heads() == [REV_018]
    assert scripts.get_revision(REV_018).down_revision == REV_017


def test_upgrade_018_agrega_las_columnas_de_productos(db_at_017: Engine, alembic_cfg: Config) -> None:
    antes = _columnas(db_at_017, "productos")
    command.upgrade(alembic_cfg, REV_018)
    despues = _columnas(db_at_017, "productos")

    assert set(despues) - set(antes) == {"publicado", "id_publico", "publicado_en"}
    assert despues["publicado"][:2] == ("boolean", "NO")
    assert despues["id_publico"] == ("character varying", "YES", 32)
    assert despues["publicado_en"][:2] == ("timestamp with time zone", "YES")
    assert {k: v for k, v in despues.items() if k in antes} == antes
    assert _revision(db_at_017) == REV_018


def test_upgrade_018_crea_la_unicidad_y_el_check(db_at_018: Engine) -> None:
    unicas = _restricciones(db_at_018, "productos", "u")
    checks = _restricciones(db_at_018, "productos", "c")

    assert unicas["uq_producto_id_publico"] == "UNIQUE (id_publico)"
    # PostgreSQL stores the normalized expression.
    assert checks["ck_producto_publicado_requiere_id_publico"] == (
        "CHECK (((NOT publicado) OR (id_publico IS NOT NULL)))"
    )


def test_upgrade_018_crea_la_tabla_de_ocultas_con_su_clave_foranea(db_at_018: Engine) -> None:
    columnas = _columnas(db_at_018, "elaboraciones_ocultas")

    assert set(columnas) == {"elaboracion_id", "oculta_at"}
    assert columnas["elaboracion_id"][:2] == ("integer", "NO")
    assert columnas["oculta_at"][:2] == ("timestamp with time zone", "NO")
    assert "PRIMARY KEY (elaboracion_id)" in _restricciones(db_at_018, "elaboraciones_ocultas", "p").values()
    assert _fk(db_at_018) == "FOREIGN KEY (elaboracion_id) REFERENCES elaboraciones(id) ON DELETE CASCADE"


def test_upgrade_018_instala_el_trigger_nuevo_y_deja_intactos_los_de_la_016(db_at_018: Engine) -> None:
    assert _triggers(db_at_018) == {**TRIGGERS_016, TRIGGER_018: "elaboraciones_ocultas"}
    assert _funcion_existe(db_at_018, FUNCION_018)


def test_upgrade_018_deja_los_productos_existentes_sin_publicar_y_sin_tocar(
    db_at_017: Engine, alembic_cfg: Config
) -> None:
    antes = _productos(db_at_017)
    assert antes

    command.upgrade(alembic_cfg, REV_018)

    assert _productos(db_at_017) == antes
    with db_at_017.connect() as conn:
        filas = conn.execute(text("SELECT publicado, id_publico, publicado_en FROM productos")).all()
    assert filas
    assert all(not f[0] and f[1] is None and f[2] is None for f in filas)


def test_upgrade_018_no_toca_las_elaboraciones_ni_sus_usos(db_at_017: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_017, "E-001")
    borrador = _elaborar(db_at_017, "E-002", "Galletas")
    antes = (_fila(db_at_017, finalizada), _usos(db_at_017, finalizada), _fila(db_at_017, borrador), _conteos(db_at_017))

    command.upgrade(alembic_cfg, REV_018)

    assert (_fila(db_at_017, finalizada), _usos(db_at_017, finalizada), _fila(db_at_017, borrador), _conteos(db_at_017)) == antes


# --- comportamiento tras el upgrade ----------------------------------------------------------


def test_tras_el_upgrade_el_id_publico_es_unico_y_publicar_exige_id(db_at_018: Engine) -> None:
    _publicar(db_at_018, "Queque")
    with pytest.raises(Exception) as unico:
        _publicar(db_at_018, "Galletas")
    assert "uq_producto_id_publico" in str(unico.value)
    with pytest.raises(Exception) as check:
        _ejecutar(db_at_018, "UPDATE productos SET publicado = true WHERE nombre = 'Galletas'")
    assert "ck_producto_publicado_requiere_id_publico" in str(check.value)


def test_tras_el_upgrade_ocultar_una_finalizada_funciona_y_un_borrador_no(db_at_018: Engine) -> None:
    finalizada = _finalizada(db_at_018, "E-001")
    borrador = _elaborar(db_at_018, "E-002", "Galletas")

    _ejecutar(db_at_018, "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:e)", e=finalizada)
    _rechaza(
        db_at_018,
        "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:e)",
        MARCADOR_OCULTAR_NO_FINALIZADA,
        e=borrador,
    )

    assert _ocultas(db_at_018) == [finalizada]


# --- downgrade ---------------------------------------------------------------------------------


def test_downgrade_018_revierte_sin_datos_publicados(db_at_018: Engine, alembic_cfg: Config) -> None:
    command.downgrade(alembic_cfg, REV_017)

    assert _revision(db_at_018) == REV_017
    assert not _existe_tabla(db_at_018, "elaboraciones_ocultas")
    assert not {"publicado", "id_publico", "publicado_en"} & set(_columnas(db_at_018, "productos"))
    assert not _restricciones(db_at_018, "productos", "u").keys() & {"uq_producto_id_publico"}
    assert "ck_producto_publicado_requiere_id_publico" not in _restricciones(db_at_018, "productos", "c")
    assert _triggers(db_at_018) == TRIGGERS_016
    assert not _funcion_existe(db_at_018, FUNCION_018)


def test_downgrade_018_se_niega_si_hay_un_id_publico(db_at_018: Engine, alembic_cfg: Config) -> None:
    _publicar(db_at_018)
    antes = _productos(db_at_018)

    with pytest.raises(RuntimeError, match="018") as error:
        command.downgrade(alembic_cfg, REV_017)

    assert "identificador" in str(error.value)
    assert _revision(db_at_018) == REV_018
    assert _productos(db_at_018) == antes
    assert "id_publico" in _columnas(db_at_018, "productos")
    assert _existe_tabla(db_at_018, "elaboraciones_ocultas")


def test_downgrade_018_se_niega_si_hay_elaboraciones_ocultas(db_at_018: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_018)
    _ejecutar(db_at_018, "INSERT INTO elaboraciones_ocultas (elaboracion_id) VALUES (:e)", e=finalizada)

    with pytest.raises(RuntimeError, match="018") as error:
        command.downgrade(alembic_cfg, REV_017)

    assert "ocultas" in str(error.value)
    assert _revision(db_at_018) == REV_018
    assert _ocultas(db_at_018) == [finalizada]


def test_downgrade_018_no_pierde_datos_de_otras_tablas(db_at_018: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_018, "E-001")
    borrador = _elaborar(db_at_018, "E-002", "Galletas")
    antes = (_productos(db_at_018), _fila(db_at_018, finalizada), _usos(db_at_018, finalizada), _fila(db_at_018, borrador), _conteos(db_at_018))

    command.downgrade(alembic_cfg, REV_017)

    assert (_productos(db_at_018), _fila(db_at_018, finalizada), _usos(db_at_018, finalizada), _fila(db_at_018, borrador), _conteos(db_at_018)) == antes


def test_upgrade_downgrade_upgrade(db_at_017: Engine, alembic_cfg: Config) -> None:
    command.upgrade(alembic_cfg, REV_018)
    command.downgrade(alembic_cfg, REV_017)
    command.upgrade(alembic_cfg, REV_018)

    assert _revision(db_at_017) == REV_018
    assert _triggers(db_at_017) == {**TRIGGERS_016, TRIGGER_018: "elaboraciones_ocultas"}


def test_la_018_se_aplica_con_un_rol_sin_privilegios_de_superusuario(test_url: str, alembic_cfg: Config) -> None:  # noqa: F811
    """As in production: a plain role runs `upgrade head` and 018's trigger is installed and enabled."""
    with rol_sin_superusuario(test_url) as url_rol:
        command.upgrade(alembic_cfg, "head")

        motor_rol = create_engine(url_rol, poolclass=NullPool)
        try:
            with motor_rol.connect() as conn:
                assert conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")).scalar_one() is False
                habilitado = conn.execute(
                    text(
                        "SELECT tgrelid::regclass::text, tgenabled FROM pg_trigger "
                        "WHERE NOT tgisinternal AND tgname = :t"
                    ),
                    {"t": TRIGGER_018},
                ).one()
            assert tuple(habilitado) == ("elaboraciones_ocultas", "O")
            assert _funcion_existe(motor_rol, FUNCION_018)
        finally:
            motor_rol.dispose()
