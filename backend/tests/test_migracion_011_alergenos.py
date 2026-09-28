"""Migration 011 tests against a real PostgreSQL test database (THT03-06).

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
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

REV_010 = "010_formulacion_version_t02_08"
REV_011 = "011_alergenos_obligatorio_chile"
BACKEND_DIR = Path(__file__).resolve().parents[1]

OBLIGATORIOS = {
    "gluten",
    "crustaceos",
    "huevos",
    "pescado",
    "cacahuetes",
    "soja",
    "lacteos",
    "frutos_cascara",
    "sulfitos",
}
NO_OBLIGATORIOS = {"apio", "mostaza", "sesamo", "altramuces", "moluscos"}
NOMBRES_CHILE = {
    "cacahuetes": "Maní",
    "soja": "Soya",
    "lacteos": "Leche",
    "frutos_cascara": "Nueces",
    "huevos": "Huevo",
}
NOMBRES_009 = {
    "cacahuetes": "Cacahuetes",
    "soja": "Soja",
    "lacteos": "Lácteos",
    "frutos_cascara": "Frutos de cáscara",
    "huevos": "Huevos",
}


def _require_safe_test_url() -> str:
    raw_url = os.getenv("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip("Requiere TEST_DATABASE_URL apuntando a PostgreSQL (base *_test).")
    url = make_url(raw_url)
    if not url.drivername.startswith("postgresql"):
        pytest.fail(f"Las pruebas de migración requieren PostgreSQL, no {url.drivername}.")
    if not (url.database or "").endswith("_test"):
        pytest.fail(
            f"Me niego a correr: la base '{url.database}' no termina en '_test' "
            "y estas pruebas borran el esquema completo."
        )
    return raw_url


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
def db_at_010(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_010)
    _seed_asociaciones(engine)
    return engine


def _reset_schema(engine: Engine) -> None:
    assert (engine.url.database or "").endswith("_test"), engine.url
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


def _seed_asociaciones(engine: Engine) -> None:
    with engine.begin() as conn:
        for nombre, codigo in (
            ("Leche entera", "lacteos"),
            ("Huevo de campo", "huevos"),
            ("Apio fresco", "apio"),
        ):
            ingrediente_id = conn.execute(
                text(
                    "INSERT INTO ingredientes (nombre, activo) "
                    "VALUES (:nombre, true) RETURNING id"
                ),
                {"nombre": nombre},
            ).scalar_one()
            conn.execute(
                text(
                    "INSERT INTO ingredientes_alergenos (ingrediente_id, alergeno_id) "
                    "SELECT :ingrediente_id, id FROM alergenos WHERE codigo = :codigo"
                ),
                {"ingrediente_id": ingrediente_id, "codigo": codigo},
            )


def _columnas(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT column_name, data_type, is_nullable, column_default "
                    "FROM information_schema.columns "
                    "WHERE table_schema = 'public' AND table_name = 'alergenos' "
                    "ORDER BY ordinal_position"
                )
            )
        )


def _alergenos(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return list(conn.execute(text("SELECT id, codigo, nombre FROM alergenos ORDER BY id")))


def _asociaciones(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return list(
            conn.execute(
                text(
                    "SELECT i.nombre, ia.alergeno_id, a.codigo "
                    "FROM ingredientes_alergenos ia "
                    "JOIN ingredientes i ON i.id = ia.ingrediente_id "
                    "JOIN alergenos a ON a.id = ia.alergeno_id "
                    "ORDER BY i.nombre"
                )
            )
        )


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


def test_upgrade_011_agrega_columna_y_marca_obligatorios(
    db_at_010: Engine, alembic_cfg: Config
) -> None:
    antes = _alergenos(db_at_010)

    command.upgrade(alembic_cfg, REV_011)

    columna = next(c for c in _columnas(db_at_010) if c[0] == "obligatorio_chile")
    assert columna[1:3] == ("boolean", "NO")
    assert columna[3] == "false"
    with db_at_010.connect() as conn:
        flags = dict(
            conn.execute(text("SELECT codigo, obligatorio_chile FROM alergenos")).tuples().all()
        )
    assert {c for c, obligatorio in flags.items() if obligatorio} == OBLIGATORIOS
    assert {c for c, obligatorio in flags.items() if not obligatorio} == NO_OBLIGATORIOS

    despues = _alergenos(db_at_010)
    assert [(i, c) for i, c, _ in despues] == [(i, c) for i, c, _ in antes]
    nombres = {codigo: nombre for _, codigo, nombre in despues}
    for codigo, nombre in NOMBRES_CHILE.items():
        assert nombres[codigo] == nombre
    sin_cambio = {c: n for _, c, n in antes if c not in NOMBRES_CHILE}
    assert {c: nombres[c] for c in sin_cambio} == sin_cambio


def test_upgrade_011_conserva_asociaciones(db_at_010: Engine, alembic_cfg: Config) -> None:
    antes = _asociaciones(db_at_010)
    assert len(antes) == 3

    command.upgrade(alembic_cfg, REV_011)

    assert _asociaciones(db_at_010) == antes
    with db_at_010.connect() as conn:
        nombres = dict(
            conn.execute(
                text(
                    "SELECT i.nombre, a.nombre FROM ingredientes_alergenos ia "
                    "JOIN ingredientes i ON i.id = ia.ingrediente_id "
                    "JOIN alergenos a ON a.id = ia.alergeno_id"
                )
            )
            .tuples()
            .all()
        )
    assert nombres == {
        "Leche entera": "Leche",
        "Huevo de campo": "Huevo",
        "Apio fresco": "Apio",
    }


def test_downgrade_011_restaura_estado_original(
    db_at_010: Engine, alembic_cfg: Config
) -> None:
    columnas_010 = _columnas(db_at_010)
    alergenos_010 = _alergenos(db_at_010)
    asociaciones_010 = _asociaciones(db_at_010)

    command.upgrade(alembic_cfg, REV_011)
    command.downgrade(alembic_cfg, REV_010)

    assert _columnas(db_at_010) == columnas_010
    assert _alergenos(db_at_010) == alergenos_010
    assert _asociaciones(db_at_010) == asociaciones_010
    nombres = {codigo: nombre for _, codigo, nombre in _alergenos(db_at_010)}
    for codigo, nombre in NOMBRES_009.items():
        assert nombres[codigo] == nombre

    command.upgrade(alembic_cfg, REV_011)
    assert _asociaciones(db_at_010) == asociaciones_010
