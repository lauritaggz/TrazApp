"""Migration 014 tests against a real PostgreSQL test database (HU04 / T04-02).

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

REV_013 = "013_insumos_comerciales"
REV_014 = "014_insumos_alergenos"
BACKEND_DIR = Path(__file__).resolve().parents[1]
TABLA = "insumos_alergenos"
CK_TIPO = "ck_insumos_alergenos_tipo"


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
def db_at_013(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_013)
    _seed(engine)
    return engine


@pytest.fixture
def db_at_014(db_at_013: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_014)
    return db_at_013


def _seed(engine: Engine) -> None:
    """A productor with one ingredient and two supplies (the catalog comes from 009/011)."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO productores (nombre, email, password_hash, activo) "
                "VALUES ('Ana', 'ana@ejemplo.com', 'hash', true)"
            )
        )
        conn.execute(
            text(
                "INSERT INTO ingredientes (productor_id, nombre, activo) "
                "SELECT id, 'Chocolate', true FROM productores"
            )
        )
        for nombre in ("Chocolate A", "Chocolate B"):
            conn.execute(
                text(
                    "INSERT INTO insumos_comerciales "
                    "(productor_id, ingrediente_id, nombre, marca_origen) "
                    "SELECT p.id, i.id, :nombre, 'Marca' FROM productores p "
                    "JOIN ingredientes i ON i.productor_id = p.id"
                ),
                {"nombre": nombre},
            )


def _insumo_id(engine: Engine, nombre: str = "Chocolate A") -> int:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id FROM insumos_comerciales WHERE nombre = :nombre"), {"nombre": nombre}
        ).scalar_one()


def _alergeno_id(engine: Engine, codigo: str = "lacteos") -> int:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id FROM alergenos WHERE codigo = :codigo"), {"codigo": codigo}
        ).scalar_one()


def _declarar(engine: Engine, insumo: str, codigo: str, tipo: str) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(f"INSERT INTO {TABLA} (insumo_id, alergeno_id, tipo) VALUES (:i, :a, :t)"),
            {"i": _insumo_id(engine, insumo), "a": _alergeno_id(engine, codigo), "t": tipo},
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
                "SELECT column_name, data_type, is_nullable, character_maximum_length "
                "FROM information_schema.columns "
                f"WHERE table_schema = 'public' AND table_name = '{TABLA}'"
            )
        ).all()
    return {fila[0]: tuple(fila[1:]) for fila in filas}


def _restricciones(engine: Engine, tipo: str) -> list[str]:
    with engine.connect() as conn:
        return sorted(
            fila[0]
            for fila in conn.execute(
                text(
                    "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                    f"WHERE conrelid = '{TABLA}'::regclass AND contype = :tipo"
                ),
                {"tipo": tipo},
            )
        )


def _conteos(engine: Engine) -> dict[str, int]:
    with engine.connect() as conn:
        return {
            tabla: conn.execute(text(f"SELECT count(*) FROM {tabla}")).scalar_one()
            for tabla in ("productores", "ingredientes", "alergenos", "insumos_comerciales")
        }


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


def test_upgrade_014_crea_la_tabla_con_sus_columnas(db_at_013: Engine, alembic_cfg: Config) -> None:
    assert not _existe_tabla(db_at_013)

    command.upgrade(alembic_cfg, REV_014)

    assert _revision(db_at_013) == REV_014
    assert _columnas(db_at_013) == {
        "insumo_id": ("integer", "NO", None),
        "alergeno_id": ("integer", "NO", None),
        "tipo": ("character varying", "NO", 20),
    }


def test_upgrade_014_sigue_el_patron_de_ingredientes_alergenos(db_at_014: Engine) -> None:
    assert _restricciones(db_at_014, "p") == ["PRIMARY KEY (insumo_id, alergeno_id)"]

    claves = _restricciones(db_at_014, "f")
    assert claves == [
        "FOREIGN KEY (alergeno_id) REFERENCES alergenos(id) ON DELETE RESTRICT",
        "FOREIGN KEY (insumo_id) REFERENCES insumos_comerciales(id) ON DELETE CASCADE",
    ]

    with db_at_014.connect() as conn:
        referencia = conn.execute(
            text(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint "
                "WHERE conrelid = 'ingredientes_alergenos'::regclass AND contype = 'f' "
                "ORDER BY 1"
            )
        ).scalars().all()
    assert [c.split(" REFERENCES ")[1] for c in referencia] == [
        c.split(" REFERENCES ")[1].replace("insumos_comerciales(id)", "ingredientes(id)")
        for c in claves
    ]


def test_upgrade_014_crea_el_check_del_tipo(db_at_014: Engine) -> None:
    checks = _restricciones(db_at_014, "c")

    assert len(checks) == 1
    assert "'contiene'" in checks[0] and "'trazas'" in checks[0]
    with db_at_014.connect() as conn:
        nombre = conn.execute(
            text(f"SELECT conname FROM pg_constraint WHERE conrelid = '{TABLA}'::regclass AND contype = 'c'")
        ).scalar_one()
    assert nombre == CK_TIPO


def test_upgrade_014_no_altera_los_datos_existentes(db_at_013: Engine, alembic_cfg: Config) -> None:
    antes = _conteos(db_at_013)

    command.upgrade(alembic_cfg, REV_014)

    assert _conteos(db_at_013) == antes
    assert antes["insumos_comerciales"] == 2
    with db_at_013.connect() as conn:
        assert conn.execute(text(f"SELECT count(*) FROM {TABLA}")).scalar_one() == 0


@pytest.mark.parametrize("tipo", ["contiene", "trazas"])
def test_acepta_los_dos_tipos_permitidos(db_at_014: Engine, tipo: str) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", tipo)

    with db_at_014.connect() as conn:
        assert conn.execute(text(f"SELECT tipo FROM {TABLA}")).scalar_one() == tipo


@pytest.mark.parametrize("tipo", ["puede_contener", "contienen", "TRAZAS", "", " contiene"])
def test_el_check_rechaza_un_tipo_no_permitido(db_at_014: Engine, tipo: str) -> None:
    with pytest.raises(IntegrityError, match=CK_TIPO):
        _declarar(db_at_014, "Chocolate A", "lacteos", tipo)


def test_el_tipo_es_obligatorio(db_at_014: Engine) -> None:
    with pytest.raises(IntegrityError, match="null value"):
        with db_at_014.begin() as conn:
            conn.execute(
                text(f"INSERT INTO {TABLA} (insumo_id, alergeno_id) VALUES (:i, :a)"),
                {"i": _insumo_id(db_at_014), "a": _alergeno_id(db_at_014)},
            )


@pytest.mark.parametrize(
    ("primero", "segundo"),
    [("contiene", "contiene"), ("contiene", "trazas"), ("trazas", "contiene")],
)
def test_la_clave_primaria_rechaza_el_mismo_alergeno_dos_veces_en_un_insumo(
    db_at_014: Engine, primero: str, segundo: str
) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", primero)

    with pytest.raises(IntegrityError, match=f"{TABLA}_pkey"):
        _declarar(db_at_014, "Chocolate A", "lacteos", segundo)

    with db_at_014.connect() as conn:
        assert conn.execute(text(f"SELECT tipo FROM {TABLA}")).scalars().all() == [primero]


def test_permite_el_mismo_alergeno_en_insumos_distintos_y_varios_en_uno(db_at_014: Engine) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", "contiene")
    _declarar(db_at_014, "Chocolate B", "lacteos", "trazas")
    _declarar(db_at_014, "Chocolate A", "cacahuetes", "trazas")

    with db_at_014.connect() as conn:
        assert conn.execute(text(f"SELECT count(*) FROM {TABLA}")).scalar_one() == 3


def test_las_claves_foraneas_exigen_insumo_y_alergeno_existentes(db_at_014: Engine) -> None:
    with pytest.raises(IntegrityError):
        with db_at_014.begin() as conn:
            conn.execute(
                text(f"INSERT INTO {TABLA} (insumo_id, alergeno_id, tipo) VALUES (99999, 99999, 'contiene')")
            )


def test_eliminar_un_insumo_elimina_sus_alergenos_declarados(db_at_014: Engine) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", "contiene")
    _declarar(db_at_014, "Chocolate B", "lacteos", "trazas")

    with db_at_014.begin() as conn:
        conn.execute(text("DELETE FROM insumos_comerciales WHERE nombre = 'Chocolate A'"))

    with db_at_014.connect() as conn:
        assert conn.execute(text(f"SELECT tipo FROM {TABLA}")).scalars().all() == ["trazas"]


def test_un_alergeno_del_catalogo_en_uso_no_se_puede_eliminar(db_at_014: Engine) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", "contiene")

    with pytest.raises(IntegrityError):
        with db_at_014.begin() as conn:
            conn.execute(text("DELETE FROM alergenos WHERE codigo = 'lacteos'"))


def test_downgrade_014_elimina_la_tabla_y_conserva_lo_anterior(db_at_014: Engine, alembic_cfg: Config) -> None:
    _declarar(db_at_014, "Chocolate A", "lacteos", "contiene")
    antes = _conteos(db_at_014)

    command.downgrade(alembic_cfg, REV_013)

    assert _revision(db_at_014) == REV_013
    assert not _existe_tabla(db_at_014)
    assert _conteos(db_at_014) == antes


def test_downgrade_014_y_nuevo_upgrade_son_reversibles(db_at_014: Engine, alembic_cfg: Config) -> None:
    columnas = _columnas(db_at_014)
    primaria = _restricciones(db_at_014, "p")
    foraneas = _restricciones(db_at_014, "f")
    checks = _restricciones(db_at_014, "c")

    command.downgrade(alembic_cfg, REV_013)
    command.upgrade(alembic_cfg, REV_014)

    assert _revision(db_at_014) == REV_014
    assert _columnas(db_at_014) == columnas
    assert _restricciones(db_at_014, "p") == primaria
    assert _restricciones(db_at_014, "f") == foraneas
    assert _restricciones(db_at_014, "c") == checks
