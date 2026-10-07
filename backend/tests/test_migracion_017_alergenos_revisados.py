"""Migration 017 tests against a real PostgreSQL test database (HT06 / HT06-01).

These tests drop and recreate the `public` schema, so they only run when
TEST_DATABASE_URL points to a PostgreSQL database whose name ends in `_test`.
"""

import importlib.machinery
import importlib.util
import os
from collections.abc import Generator
from pathlib import Path
from types import ModuleType

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from tests.test_migracion_011_alergenos import _require_safe_test_url, _reset_schema
from tests.test_migracion_015_elaboraciones import _conteos, _revision
from tests.test_migracion_016_elaboracion_inmutable import _semilla
from tests.test_triggers_elaboracion_hu05 import _finalizada, _fila, _usos

REV_015 = "015_elaboraciones_hu05"
REV_016 = "016_elaboracion_inmutable_hu05"
REV_017 = "017_alergenos_revisados_ht06"
BACKEND_DIR = Path(__file__).resolve().parents[1]
VERSIONES = BACKEND_DIR / "alembic" / "versions"
COLUMNA = "alergenos_revisados_at"


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
def db_at_016(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_016)
    _semilla(engine)
    return engine


# --- ejecución de la migración --------------------------------------------------------------


def _cargar_archivo(ruta: Path) -> ModuleType:
    cargador = importlib.machinery.SourceFileLoader("migracion_017", str(ruta))
    spec = importlib.util.spec_from_loader(cargador.name, cargador)
    modulo = importlib.util.module_from_spec(spec)
    cargador.exec_module(modulo)
    return modulo


def _subir(engine: Engine, cfg: Config) -> None:
    command.upgrade(cfg, REV_017)


def _bajar(engine: Engine, cfg: Config) -> None:
    command.downgrade(cfg, REV_016)


def _revision_esperada(engine: Engine, esperada: str) -> None:
    assert _revision(engine) == esperada


# --- ayudas ------------------------------------------------------------------------------


def _insumo_id(engine: Engine, nombre: str) -> int:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT id FROM insumos_comerciales WHERE nombre = :n"), {"n": nombre}
        ).scalar_one()


def _declarar(engine: Engine, insumo: str, codigo: str, tipo: str = "contiene") -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO insumos_alergenos (insumo_id, alergeno_id, tipo) "
                "SELECT :i, id, :t FROM alergenos WHERE codigo = :c"
            ),
            {"i": _insumo_id(engine, insumo), "c": codigo, "t": tipo},
        )


def _existe_columna(engine: Engine) -> bool:
    with engine.connect() as conn:
        return bool(
            conn.execute(
                text(
                    "SELECT count(*) FROM information_schema.columns "
                    "WHERE table_name = 'insumos_comerciales' AND column_name = :c"
                ),
                {"c": COLUMNA},
            ).scalar_one()
        )


def _columna(engine: Engine) -> tuple:
    with engine.connect() as conn:
        return conn.execute(
            text(
                "SELECT data_type, is_nullable, column_default FROM information_schema.columns "
                "WHERE table_name = 'insumos_comerciales' AND column_name = :c"
            ),
            {"c": COLUMNA},
        ).one()


def _revisiones(engine: Engine) -> dict[str, object]:
    with engine.connect() as conn:
        return {
            fila[0]: fila[1]
            for fila in conn.execute(text(f"SELECT nombre, {COLUMNA} FROM insumos_comerciales ORDER BY nombre"))
        }


def _insumos_sin_la_columna(engine: Engine) -> list[tuple]:
    """Every column of every supply except the new one, to prove the rest is untouched."""
    with engine.connect() as conn:
        columnas = [
            c
            for c in conn.execute(
                text(
                    "SELECT column_name FROM information_schema.columns "
                    "WHERE table_name = 'insumos_comerciales' ORDER BY ordinal_position"
                )
            ).scalars()
            if c != COLUMNA
        ]
        return [tuple(f) for f in conn.execute(text(f"SELECT {', '.join(columnas)} FROM insumos_comerciales ORDER BY id"))]


def _declarados(engine: Engine) -> list[tuple]:
    with engine.connect() as conn:
        return [
            tuple(f)
            for f in conn.execute(
                text("SELECT insumo_id, alergeno_id, tipo FROM insumos_alergenos ORDER BY insumo_id, alergeno_id")
            )
        ]


def _con_datos_de_los_tres_casos(engine: Engine) -> None:
    """Leche A: two allergens; Leche B: none (never reviewed); Leche C: one trace allergen."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO insumos_comerciales (productor_id, ingrediente_id, nombre, marca_origen) "
                "SELECT productor_id, ingrediente_id, 'Leche C', 'Marca' FROM insumos_comerciales WHERE nombre = 'Leche A'"
            )
        )
    _declarar(engine, "Leche A", "lacteos")
    _declarar(engine, "Leche A", "huevos", "trazas")
    _declarar(engine, "Leche C", "soja", "trazas")


# --- seguridad de las pruebas ------------------------------------------------------------


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


# --- cadena de revisiones ----------------------------------------------------------------


def test_la_cabeza_de_alembic_es_la_revision_esperada() -> None:
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))

    assert ScriptDirectory.from_config(cfg).get_heads() == [REV_017]


def test_la_017_cuelga_de_la_016() -> None:
    modulo = _cargar_archivo(VERSIONES / f"{REV_017}.py")
    assert modulo.revision == REV_017
    assert modulo.down_revision == REV_016


# --- upgrade -----------------------------------------------------------------------------


def test_upgrade_agrega_la_columna_nula_y_sin_valor_por_defecto(db_at_016: Engine, alembic_cfg: Config) -> None:
    assert not _existe_columna(db_at_016)

    _subir(db_at_016, alembic_cfg)

    assert _existe_columna(db_at_016)
    tipo, nulable, por_defecto = _columna(db_at_016)
    assert (tipo, nulable, por_defecto) == ("timestamp with time zone", "YES", None)
    _revision_esperada(db_at_016, REV_017)


def test_upgrade_marca_revisado_solo_el_insumo_con_alergenos_y_no_toca_nada_mas(
    db_at_016: Engine, alembic_cfg: Config
) -> None:
    _con_datos_de_los_tres_casos(db_at_016)
    antes = (_conteos(db_at_016), _insumos_sin_la_columna(db_at_016), _declarados(db_at_016))
    with db_at_016.connect() as conn:
        desde = conn.execute(text("SELECT clock_timestamp()")).scalar_one()

    _subir(db_at_016, alembic_cfg)

    with db_at_016.connect() as conn:
        hasta = conn.execute(text("SELECT clock_timestamp()")).scalar_one()
    revisiones = _revisiones(db_at_016)
    assert revisiones["Leche B"] is None
    assert desde <= revisiones["Leche A"] <= hasta
    assert desde <= revisiones["Leche C"] <= hasta
    # The time of the migration, one single value for every migrated row (not each row's updated_at).
    assert revisiones["Leche A"] == revisiones["Leche C"]
    assert (_conteos(db_at_016), _insumos_sin_la_columna(db_at_016), _declarados(db_at_016)) == antes


def test_upgrade_no_usa_updated_at_como_fecha_de_revision(db_at_016: Engine, alembic_cfg: Config) -> None:
    _con_datos_de_los_tres_casos(db_at_016)
    with db_at_016.begin() as conn:
        conn.execute(text("UPDATE insumos_comerciales SET updated_at = TIMESTAMPTZ '2020-01-01 00:00:00+00'"))

    _subir(db_at_016, alembic_cfg)

    revisiones = _revisiones(db_at_016)
    assert revisiones["Leche A"].year != 2020
    assert revisiones["Leche C"].year != 2020


def test_upgrade_sobre_una_base_sin_insumos_funciona(engine: Engine, alembic_cfg: Config) -> None:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_016)

    _subir(engine, alembic_cfg)

    assert _existe_columna(engine)
    assert _revisiones(engine) == {}


# --- downgrade ---------------------------------------------------------------------------


def test_downgrade_sin_revisados_sin_alergenos_no_pierde_nada(db_at_016: Engine, alembic_cfg: Config) -> None:
    """Revisado-with-rows and never-reviewed are rebuilt by the upgrade rule: nothing is lost."""
    _con_datos_de_los_tres_casos(db_at_016)
    elaboracion = _finalizada(db_at_016)
    antes = (
        _conteos(db_at_016),
        _insumos_sin_la_columna(db_at_016),
        _declarados(db_at_016),
        _fila(db_at_016, elaboracion),
        _usos(db_at_016, elaboracion),
    )
    _subir(db_at_016, alembic_cfg)

    _bajar(db_at_016, alembic_cfg)

    assert not _existe_columna(db_at_016)
    _revision_esperada(db_at_016, REV_016)
    assert (
        _conteos(db_at_016),
        _insumos_sin_la_columna(db_at_016),
        _declarados(db_at_016),
        _fila(db_at_016, elaboracion),
        _usos(db_at_016, elaboracion),
    ) == antes


def test_downgrade_se_niega_si_hay_un_insumo_revisado_sin_alergenos(db_at_016: Engine, alembic_cfg: Config) -> None:
    _con_datos_de_los_tres_casos(db_at_016)
    _subir(db_at_016, alembic_cfg)
    with db_at_016.begin() as conn:  # "Leche B" reviewed: no allergens, with a date
        conn.execute(text(f"UPDATE insumos_comerciales SET {COLUMNA} = now() WHERE nombre = 'Leche B'"))
    antes = (_revisiones(db_at_016), _insumos_sin_la_columna(db_at_016), _declarados(db_at_016))
    id_b = _insumo_id(db_at_016, "Leche B")

    with pytest.raises(RuntimeError) as error:
        _bajar(db_at_016, alembic_cfg)

    mensaje = str(error.value)
    assert "No se puede revertir la migración 017" in mensaje
    assert "revisados sin alérgenos" in mensaje
    assert str(id_b) in mensaje
    assert "no se modificó nada" in mensaje
    # Nothing changed: the column, its values and the revision are intact.
    assert _existe_columna(db_at_016)
    assert (_revisiones(db_at_016), _insumos_sin_la_columna(db_at_016), _declarados(db_at_016)) == antes
    _revision_esperada(db_at_016, REV_017)


def test_el_mensaje_de_la_negativa_cuenta_los_insumos_y_abrevia_la_lista(
    db_at_016: Engine, alembic_cfg: Config
) -> None:
    _subir(db_at_016, alembic_cfg)
    with db_at_016.begin() as conn:
        for numero in range(12):
            conn.execute(
                text(
                    f"INSERT INTO insumos_comerciales (productor_id, ingrediente_id, nombre, marca_origen, {COLUMNA}) "
                    "SELECT productor_id, ingrediente_id, :n, 'Marca', now() FROM insumos_comerciales WHERE nombre = 'Leche A'"
                ),
                {"n": f"Revisado {numero:02d}"},
            )

    with pytest.raises(RuntimeError) as error:
        _bajar(db_at_016, alembic_cfg)

    assert "12 insumo(s)" in str(error.value)
    assert str(error.value).count(",") >= 10 and ", ..." in str(error.value)


def test_downgrade_vuelve_a_poder_hacerse_cuando_el_insumo_declara_un_alergeno(
    db_at_016: Engine, alembic_cfg: Config
) -> None:
    _subir(db_at_016, alembic_cfg)
    with db_at_016.begin() as conn:
        conn.execute(text(f"UPDATE insumos_comerciales SET {COLUMNA} = now() WHERE nombre = 'Leche B'"))
    with pytest.raises(RuntimeError):
        _bajar(db_at_016, alembic_cfg)

    _declarar(db_at_016, "Leche B", "lacteos")
    _bajar(db_at_016, alembic_cfg)

    assert not _existe_columna(db_at_016)
    _revision_esperada(db_at_016, REV_016)


def test_un_insumo_sin_revisar_y_sin_alergenos_no_impide_el_downgrade(
    db_at_016: Engine, alembic_cfg: Config
) -> None:
    _subir(db_at_016, alembic_cfg)
    assert set(_revisiones(db_at_016).values()) == {None}

    _bajar(db_at_016, alembic_cfg)

    assert not _existe_columna(db_at_016)


# --- reversibilidad ----------------------------------------------------------------------


def test_upgrade_downgrade_y_nuevo_upgrade_son_reversibles(db_at_016: Engine, alembic_cfg: Config) -> None:
    _con_datos_de_los_tres_casos(db_at_016)
    _subir(db_at_016, alembic_cfg)
    forma = _columna(db_at_016)
    marcados = {nombre: fecha is not None for nombre, fecha in _revisiones(db_at_016).items()}
    resto = _insumos_sin_la_columna(db_at_016)

    _bajar(db_at_016, alembic_cfg)
    _subir(db_at_016, alembic_cfg)

    assert _columna(db_at_016) == forma
    assert {nombre: fecha is not None for nombre, fecha in _revisiones(db_at_016).items()} == marcados
    assert _insumos_sin_la_columna(db_at_016) == resto
    _revision_esperada(db_at_016, REV_017)


# --- el esquema de create_all coincide con el de la migración ----------------------------


def test_el_modelo_declara_la_misma_columna_que_crea_la_migracion(db_at_016: Engine, alembic_cfg: Config) -> None:
    from app.models.insumo import InsumoComercial

    _subir(db_at_016, alembic_cfg)
    columna = InsumoComercial.__table__.columns[COLUMNA]

    assert columna.nullable is True
    assert columna.server_default is None
    assert columna.type.timezone is True
    assert _columna(db_at_016)[:2] == ("timestamp with time zone", "YES")
