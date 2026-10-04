"""Migration 012 tests against a real PostgreSQL test database (HU03 / T03-01).

These tests drop and recreate the `public` schema, so they only run when
TEST_DATABASE_URL points to a PostgreSQL database whose name ends in `_test`.
"""

import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from tests.test_migracion_011_alergenos import _require_safe_test_url, _reset_schema

REV_011 = "011_alergenos_obligatorio_chile"
REV_012 = "012_formulacion_versionada_hu03"
BACKEND_DIR = Path(__file__).resolve().parents[1]
FORMULACION = "versiones_producto_formulacion"


@pytest.fixture(scope="module")
def test_url() -> Generator[str, None, None]:
    raw_url = _require_safe_test_url()
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = raw_url
    get_settings.cache_clear()
    try:
        effective = make_url(get_settings().database_url)
        assert (effective.database or "").endswith("_test"), effective
        yield raw_url
    finally:
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        get_settings.cache_clear()


@pytest.fixture(scope="module")
def engine(test_url: str) -> Generator[Engine, None, None]:
    engine = create_engine(test_url, poolclass=NullPool)
    yield engine
    _reset_schema(engine)
    engine.dispose()


@pytest.fixture
def alembic_cfg(test_url: str) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    return cfg


@pytest.fixture
def db_at_011(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_011)
    _seed(engine)
    return engine


def _seed(engine: Engine) -> None:
    """Product with v1 (has a lote, with formulation) and v2 (no lote)."""
    with engine.begin() as conn:
        producto_id = conn.execute(
            text("INSERT INTO productos (nombre, activo) VALUES ('Pan', true) RETURNING id")
        ).scalar_one()
        version_ids = [
            conn.execute(
                text(
                    "INSERT INTO versiones_producto "
                    "(producto_id, numero_version, descripcion, vigente) "
                    "VALUES (:producto_id, :numero, :descripcion, true) RETURNING id"
                ),
                {"producto_id": producto_id, "numero": numero, "descripcion": f"V{numero}"},
            ).scalar_one()
            for numero in (1, 2)
        ]
        conn.execute(
            text(
                "INSERT INTO lotes_producto (codigo_lote, version_producto_id) "
                "VALUES ('LP-012-001', :version_id)"
            ),
            {"version_id": version_ids[0]},
        )
        for nombre in ("Harina", "Agua"):
            conn.execute(
                text("INSERT INTO ingredientes (nombre, activo) VALUES (:nombre, true)"),
                {"nombre": nombre},
            )
        conn.execute(
            text(
                f"INSERT INTO {FORMULACION} "
                "(version_producto_id, ingrediente_id, ingrediente_nombre, porcentaje) "
                "SELECT :version_id, id, nombre, 60 FROM ingredientes WHERE nombre = 'Harina'"
            ),
            {"version_id": version_ids[0]},
        )
        conn.execute(
            text(
                f"INSERT INTO {FORMULACION} "
                "(version_producto_id, ingrediente_id, ingrediente_nombre, cantidad, unidad) "
                "SELECT :version_id, id, nombre, 250, 'ml' FROM ingredientes "
                "WHERE nombre = 'Agua'"
            ),
            {"version_id": version_ids[0]},
        )


def _columnas_versiones(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT column_name, data_type, is_nullable, column_default "
                    "FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'versiones_producto' "
                    "ORDER BY ordinal_position"
                )
            )
        )


def _checks_formulacion(engine: Engine) -> dict[str, str]:
    with engine.connect() as conn:
        return dict(
            conn.execute(
                text(
                    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
                    f"WHERE conrelid = '{FORMULACION}'::regclass AND contype = 'c'"
                )
            )
            .tuples()
            .all()
        )


def _usadas(engine: Engine) -> dict[int, bool]:
    with engine.connect() as conn:
        return dict(
            conn.execute(
                text("SELECT numero_version, usada_en_elaboracion FROM versiones_producto")
            )
            .tuples()
            .all()
        )


def _lineas(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT version_producto_id, ingrediente_nombre, porcentaje, cantidad, unidad "
                    f"FROM {FORMULACION} ORDER BY id"
                )
            )
        )


def _revision(engine: Engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def _insert_linea(engine: Engine, nombre: str, **cuantificacion: object) -> None:
    columnas = ", ".join(cuantificacion)
    valores = ", ".join(f":{c}" for c in cuantificacion)
    extra_cols = f", {columnas}" if columnas else ""
    extra_vals = f", {valores}" if valores else ""
    with engine.begin() as conn:
        ingrediente_id = conn.execute(
            text("INSERT INTO ingredientes (nombre, activo) VALUES (:nombre, true) RETURNING id"),
            {"nombre": nombre},
        ).scalar_one()
        conn.execute(
            text(
                f"INSERT INTO {FORMULACION} "
                f"(version_producto_id, ingrediente_id, ingrediente_nombre{extra_cols}) "
                "SELECT id, :ingrediente_id, :nombre"
                f"{extra_vals} FROM versiones_producto WHERE numero_version = 2"
            ),
            {"ingrediente_id": ingrediente_id, "nombre": nombre, **cuantificacion},
        )


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


def test_upgrade_012_agrega_columna_y_marca_versiones_con_lotes(
    db_at_011: Engine, alembic_cfg: Config
) -> None:
    lineas_011 = _lineas(db_at_011)

    command.upgrade(alembic_cfg, REV_012)

    columna = next(c for c in _columnas_versiones(db_at_011) if c[0] == "usada_en_elaboracion")
    assert columna[1:3] == ("boolean", "NO")
    assert columna[3] == "false"
    assert _usadas(db_at_011) == {1: True, 2: False}
    assert _lineas(db_at_011) == lineas_011

    checks = _checks_formulacion(db_at_011)
    assert "ck_version_producto_formulacion_cuantificacion" not in checks
    assert "ck_version_producto_formulacion_cantidad_unidad" in checks


def test_upgrade_012_permite_linea_sin_cuantificacion_y_exige_cantidad_con_unidad(
    db_at_011: Engine, alembic_cfg: Config
) -> None:
    command.upgrade(alembic_cfg, REV_012)

    _insert_linea(db_at_011, "Sal")
    with pytest.raises(IntegrityError, match="cantidad_unidad"):
        _insert_linea(db_at_011, "Azúcar", cantidad=5)
    with pytest.raises(IntegrityError, match="cantidad_unidad"):
        _insert_linea(db_at_011, "Levadura", unidad="g")

    assert [linea[1] for linea in _lineas(db_at_011)] == ["Harina", "Agua", "Sal"]


def test_downgrade_012_falla_si_hay_lineas_sin_cuantificacion(
    db_at_011: Engine, alembic_cfg: Config
) -> None:
    command.upgrade(alembic_cfg, REV_012)
    _insert_linea(db_at_011, "Sal")
    checks_012 = _checks_formulacion(db_at_011)

    with pytest.raises(RuntimeError, match=r"No se puede revertir .* 1 línea\(s\)"):
        command.downgrade(alembic_cfg, REV_011)

    assert _revision(db_at_011) == REV_012
    assert _checks_formulacion(db_at_011) == checks_012
    assert _usadas(db_at_011) == {1: True, 2: False}
    assert len(_lineas(db_at_011)) == 3


def test_downgrade_012_limpio_y_nuevo_upgrade(db_at_011: Engine, alembic_cfg: Config) -> None:
    columnas_011 = _columnas_versiones(db_at_011)
    checks_011 = _checks_formulacion(db_at_011)
    lineas_011 = _lineas(db_at_011)

    command.upgrade(alembic_cfg, REV_012)
    command.downgrade(alembic_cfg, REV_011)

    assert _revision(db_at_011) == REV_011
    assert _columnas_versiones(db_at_011) == columnas_011
    assert _checks_formulacion(db_at_011) == checks_011
    assert _lineas(db_at_011) == lineas_011

    command.upgrade(alembic_cfg, REV_012)
    assert _revision(db_at_011) == REV_012
    assert _usadas(db_at_011) == {1: True, 2: False}
    assert _lineas(db_at_011) == lineas_011
