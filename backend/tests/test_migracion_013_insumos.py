"""Migration 013 tests against a real PostgreSQL test database (HU04 / T04-01).

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

REV_012 = "012_formulacion_versionada_hu03"
REV_013 = "013_insumos_comerciales"
BACKEND_DIR = Path(__file__).resolve().parents[1]
TABLA = "insumos_comerciales"
IX_PRODUCTOR = "ix_insumos_comerciales_productor_id"
IX_INGREDIENTE = "ix_insumos_comerciales_ingrediente_id"
IX_CODIGO = "uq_insumos_productor_codigo_barras"
IX_HABITUAL = "uq_insumos_habitual_por_ingrediente"


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
def db_at_012(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_012)
    _seed(engine)
    return engine


@pytest.fixture
def db_at_013(db_at_012: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_013)
    return db_at_012


def _seed(engine: Engine) -> None:
    """Two productores, each with one ingredient, plus an extra ingredient for Ana."""
    with engine.begin() as conn:
        for email in ("ana@ejemplo.com", "beto@ejemplo.com"):
            conn.execute(
                text(
                    "INSERT INTO productores (nombre, email, password_hash, activo) "
                    "VALUES (:nombre, :email, 'hash', true)"
                ),
                {"nombre": email.split("@")[0], "email": email},
            )
        conn.execute(
            text(
                "INSERT INTO ingredientes (productor_id, nombre, activo) "
                "SELECT id, 'Leche', true FROM productores"
            )
        )
        conn.execute(
            text(
                "INSERT INTO ingredientes (productor_id, nombre, activo) "
                "SELECT id, 'Harina', true FROM productores WHERE email = 'ana@ejemplo.com'"
            )
        )


def _ids(engine: Engine, email: str = "ana@ejemplo.com", ingrediente: str = "Leche") -> tuple[int, int]:
    with engine.connect() as conn:
        return conn.execute(
            text(
                "SELECT p.id, i.id FROM productores p JOIN ingredientes i "
                "ON i.productor_id = p.id WHERE p.email = :email AND i.nombre = :ingrediente"
            ),
            {"email": email, "ingrediente": ingrediente},
        ).one()


def _insertar(engine: Engine, nombre: str, **extra: object) -> None:
    datos = {
        "email": "ana@ejemplo.com",
        "ingrediente": "Leche",
        "codigo_barras": None,
        "habitual": False,
        **extra,
    }
    productor_id, ingrediente_id = _ids(engine, datos["email"], datos["ingrediente"])
    with engine.begin() as conn:
        conn.execute(
            text(
                f"INSERT INTO {TABLA} "
                "(productor_id, ingrediente_id, nombre, marca_origen, codigo_barras, habitual) "
                "VALUES (:productor_id, :ingrediente_id, :nombre, 'Marca', :codigo_barras, :habitual)"
            ),
            {
                "productor_id": productor_id,
                "ingrediente_id": ingrediente_id,
                "nombre": nombre,
                "codigo_barras": datos["codigo_barras"],
                "habitual": datos["habitual"],
            },
        )


def _revision(engine: Engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def _existe_tabla(engine: Engine) -> bool:
    with engine.connect() as conn:
        return bool(conn.execute(text(f"SELECT to_regclass('public.{TABLA}')")).scalar_one())


def _columnas(engine: Engine) -> dict[str, tuple]:
    with engine.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT column_name, data_type, is_nullable, column_default, character_maximum_length "
                "FROM information_schema.columns "
                f"WHERE table_schema = 'public' AND table_name = '{TABLA}'"
            )
        ).all()
    return {fila[0]: tuple(fila[1:]) for fila in filas}


def _indices(engine: Engine) -> dict[str, str]:
    with engine.connect() as conn:
        return dict(
            conn.execute(
                text(
                    "SELECT indexname, indexdef FROM pg_indexes "
                    f"WHERE schemaname = 'public' AND tablename = '{TABLA}'"
                )
            )
            .tuples()
            .all()
        )


def _claves_foraneas(engine: Engine) -> dict[str, str]:
    with engine.connect() as conn:
        return dict(
            conn.execute(
                text(
                    "SELECT conkey::text, pg_get_constraintdef(oid) FROM pg_constraint "
                    f"WHERE conrelid = '{TABLA}'::regclass AND contype = 'f'"
                )
            )
            .tuples()
            .all()
        )


def _conteos(engine: Engine) -> dict[str, int]:
    with engine.connect() as conn:
        return {
            tabla: conn.execute(text(f"SELECT count(*) FROM {tabla}")).scalar_one()
            for tabla in ("productores", "ingredientes", "alergenos", "versiones_producto")
        }


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


def test_upgrade_013_crea_la_tabla_con_sus_columnas(db_at_012: Engine, alembic_cfg: Config) -> None:
    assert not _existe_tabla(db_at_012)

    command.upgrade(alembic_cfg, REV_013)

    assert _revision(db_at_012) == REV_013
    columnas = _columnas(db_at_012)
    assert set(columnas) == {
        "id",
        "productor_id",
        "ingrediente_id",
        "nombre",
        "marca_origen",
        "presentacion",
        "codigo_barras",
        "ingredientes_declarados",
        "advertencias",
        "ficha",
        "fuente",
        "fecha_recuperacion",
        "habitual",
        "activo",
        "created_at",
        "updated_at",
    }
    obligatorias = {"id", "productor_id", "ingrediente_id", "nombre", "marca_origen", "fuente",
                    "habitual", "activo", "created_at", "updated_at"}
    for nombre, (_tipo, nulable, _defecto, _largo) in columnas.items():
        assert (nulable == "NO") == (nombre in obligatorias), nombre

    assert columnas["ficha"][0] == "jsonb"
    assert columnas["ingredientes_declarados"][0] == "text"
    assert columnas["advertencias"][0] == "text"
    assert columnas["fecha_recuperacion"][0] == "timestamp with time zone"
    assert columnas["created_at"][0] == "timestamp with time zone"
    assert columnas["codigo_barras"][3] is not None
    assert "manual" in columnas["fuente"][2]
    assert columnas["habitual"][2] == "false"
    assert columnas["activo"][2] == "true"


def test_upgrade_013_crea_las_claves_foraneas(db_at_013: Engine) -> None:
    definiciones = " ".join(_claves_foraneas(db_at_013).values())

    assert "REFERENCES productores(id) ON DELETE RESTRICT" in definiciones
    assert "REFERENCES ingredientes(id) ON DELETE RESTRICT" in definiciones
    assert len(_claves_foraneas(db_at_013)) == 2


def test_upgrade_013_crea_los_indices_simples_de_las_claves_foraneas(db_at_013: Engine) -> None:
    indices = _indices(db_at_013)

    productor = indices[IX_PRODUCTOR]
    assert "UNIQUE" not in productor
    assert "(productor_id)" in productor
    assert "WHERE" not in productor

    ingrediente = indices[IX_INGREDIENTE]
    assert "UNIQUE" not in ingrediente
    assert "(ingrediente_id)" in ingrediente
    assert "WHERE" not in ingrediente


def test_upgrade_013_deja_exactamente_cuatro_indices_mas_la_clave_primaria(db_at_013: Engine) -> None:
    assert set(_indices(db_at_013)) == {
        f"{TABLA}_pkey",
        IX_PRODUCTOR,
        IX_INGREDIENTE,
        IX_CODIGO,
        IX_HABITUAL,
    }


def test_upgrade_013_crea_los_indices_parciales(db_at_013: Engine) -> None:
    indices = _indices(db_at_013)

    codigo = indices[IX_CODIGO]
    assert "UNIQUE" in codigo
    assert "(productor_id, codigo_barras)" in codigo
    assert "WHERE (codigo_barras IS NOT NULL)" in codigo

    habitual = indices[IX_HABITUAL]
    assert "UNIQUE" in habitual
    assert "(ingrediente_id)" in habitual
    assert "WHERE (habitual = true)" in habitual


def test_upgrade_013_no_altera_los_datos_existentes(db_at_012: Engine, alembic_cfg: Config) -> None:
    antes = _conteos(db_at_012)

    command.upgrade(alembic_cfg, REV_013)

    assert _conteos(db_at_012) == antes
    assert antes["productores"] == 2 and antes["ingredientes"] == 3


def test_indice_de_codigo_de_barras_rechaza_repetidos_del_mismo_productor(db_at_013: Engine) -> None:
    _insertar(db_at_013, "Leche A", codigo_barras="7801234567890")

    with pytest.raises(IntegrityError, match=IX_CODIGO):
        _insertar(db_at_013, "Leche B", codigo_barras="7801234567890", ingrediente="Harina")


def test_indice_de_codigo_de_barras_permite_otro_productor_y_nulos(db_at_013: Engine) -> None:
    _insertar(db_at_013, "Leche Ana", codigo_barras="7801234567890")
    _insertar(db_at_013, "Leche Beto", codigo_barras="7801234567890", email="beto@ejemplo.com")
    for numero in range(3):
        _insertar(db_at_013, f"Sin código {numero}")

    with db_at_013.connect() as conn:
        total = conn.execute(text(f"SELECT count(*) FROM {TABLA}")).scalar_one()
    assert total == 5


def test_indice_de_habitual_rechaza_un_segundo_habitual_por_ingrediente(db_at_013: Engine) -> None:
    _insertar(db_at_013, "Leche A", habitual=True)

    with pytest.raises(IntegrityError, match=IX_HABITUAL):
        _insertar(db_at_013, "Leche B", habitual=True)


def test_indice_de_habitual_permite_no_habituales_y_otro_ingrediente(db_at_013: Engine) -> None:
    _insertar(db_at_013, "Leche A", habitual=True)
    _insertar(db_at_013, "Leche B")
    _insertar(db_at_013, "Leche C")
    _insertar(db_at_013, "Harina A", ingrediente="Harina", habitual=True)

    with db_at_013.connect() as conn:
        habituales = conn.execute(
            text(f"SELECT count(*) FROM {TABLA} WHERE habitual")
        ).scalar_one()
    assert habituales == 2


def test_la_tabla_exige_productor_e_ingrediente_existentes(db_at_013: Engine) -> None:
    with pytest.raises(IntegrityError):
        with db_at_013.begin() as conn:
            conn.execute(
                text(
                    f"INSERT INTO {TABLA} (productor_id, ingrediente_id, nombre, marca_origen) "
                    "VALUES (99999, 99999, 'Fantasma', 'Nadie')"
                )
            )


def test_los_valores_por_defecto_se_aplican_en_la_base(db_at_013: Engine) -> None:
    _insertar(db_at_013, "Leche A")

    with db_at_013.connect() as conn:
        fila = conn.execute(
            text(f"SELECT fuente, habitual, activo, ficha, created_at, updated_at FROM {TABLA}")
        ).one()
    assert fila[:4] == ("manual", False, True, None)
    assert fila[4] is not None and fila[5] is not None


def test_downgrade_013_elimina_la_tabla_y_sus_indices(db_at_013: Engine, alembic_cfg: Config) -> None:
    _insertar(db_at_013, "Leche A", codigo_barras="7801234567890", habitual=True)
    antes = _conteos(db_at_013)

    command.downgrade(alembic_cfg, REV_012)

    assert _revision(db_at_013) == REV_012
    assert not _existe_tabla(db_at_013)
    with db_at_013.connect() as conn:
        restantes = conn.execute(
            text("SELECT indexname FROM pg_indexes WHERE indexname = ANY(:nombres)"),
            {"nombres": [IX_PRODUCTOR, IX_INGREDIENTE, IX_CODIGO, IX_HABITUAL]},
        ).all()
    assert restantes == []
    assert _conteos(db_at_013) == antes


def test_downgrade_013_y_nuevo_upgrade_son_reversibles(db_at_013: Engine, alembic_cfg: Config) -> None:
    columnas = _columnas(db_at_013)
    indices = _indices(db_at_013)

    command.downgrade(alembic_cfg, REV_012)
    command.upgrade(alembic_cfg, REV_013)

    assert _revision(db_at_013) == REV_013
    assert _columnas(db_at_013) == columnas
    assert _indices(db_at_013) == indices
