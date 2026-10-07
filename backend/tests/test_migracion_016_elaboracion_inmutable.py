"""Migration 016 tests against a real PostgreSQL test database (HU05 / T05-05).

These tests drop and recreate the `public` schema, so they only run when
TEST_DATABASE_URL points to a PostgreSQL database whose name ends in `_test`.
One of them also creates (and drops) a throwaway database and a role WITHOUT superuser
privileges to prove the migration runs as it does in production; its password is generated
at run time and never stored.
"""

import os
import secrets
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
from app.db.triggers_elaboracion import MARCADOR_FINALIZADA, MARCADOR_INCOMPLETA, MARCADOR_NACE_BORRADOR
from tests.test_migracion_011_alergenos import _require_safe_test_url, _reset_schema
from tests.test_migracion_015_elaboraciones import _conteos, _elaborar, _revision, _seed
from tests.test_triggers_elaboracion_hu05 import _finalizada, _fila, _insertar_uso, _usos

REV_015 = "015_elaboraciones_hu05"
REV_016 = "016_elaboracion_inmutable_hu05"
BACKEND_DIR = Path(__file__).resolve().parents[1]
TRIGGERS = {
    "trg_elaboraciones_nacen_borrador": "elaboraciones",
    "trg_elaboraciones_inmutables": "elaboraciones",
    "trg_elaboraciones_finalizacion_completa": "elaboraciones",
    "trg_usos_insumo_elaboracion_abierta": "usos_insumo",
}
FUNCIONES = {
    "fn_elaboraciones_nacen_borrador",
    "fn_elaboraciones_inmutables",
    "fn_elaboraciones_finalizacion_completa",
    "fn_usos_insumo_elaboracion_abierta",
}


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


def _semilla(engine: Engine) -> None:
    _seed(engine)
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO ingredientes (productor_id, nombre, activo) SELECT id, 'Harina', true FROM productores")
        )


@pytest.fixture
def db_at_015(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_015)
    _semilla(engine)
    return engine


@pytest.fixture
def db_at_016(db_at_015: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_016)
    return db_at_015


def _triggers(engine: Engine) -> dict[str, tuple[str, str]]:
    with engine.connect() as conn:
        return {
            fila[0]: (fila[1], fila[2])
            for fila in conn.execute(
                text(
                    "SELECT tgname, tgrelid::regclass::text, tgenabled FROM pg_trigger "
                    "WHERE NOT tgisinternal AND tgname LIKE 'trg\\_%'"
                )
            )
        }


def _funciones(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return {fila[0] for fila in conn.execute(text("SELECT proname FROM pg_proc WHERE proname LIKE 'fn\\_%'"))}


def _definicion(engine: Engine, trigger: str) -> str:
    with engine.connect() as conn:
        return conn.execute(
            text("SELECT pg_get_triggerdef(oid) FROM pg_trigger WHERE tgname = :t"), {"t": trigger}
        ).scalar_one()


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


# --- upgrade -----------------------------------------------------------------------------


def test_upgrade_016_crea_las_funciones_y_los_triggers(db_at_015: Engine, alembic_cfg: Config) -> None:
    assert _triggers(db_at_015) == {} and _funciones(db_at_015) == set()

    command.upgrade(alembic_cfg, REV_016)

    assert _revision(db_at_015) == REV_016
    assert _triggers(db_at_015) == {nombre: (tabla, "O") for nombre, tabla in TRIGGERS.items()}
    assert _funciones(db_at_015) == FUNCIONES


def test_los_triggers_tienen_el_momento_y_la_condicion_aprobados(db_at_016: Engine) -> None:
    nace = _definicion(db_at_016, "trg_elaboraciones_nacen_borrador")
    assert "BEFORE INSERT ON public.elaboraciones" in nace
    assert "FOR EACH ROW" in nace

    inmutables = _definicion(db_at_016, "trg_elaboraciones_inmutables")
    assert "BEFORE DELETE OR UPDATE ON public.elaboraciones" in inmutables
    assert "FOR EACH ROW" in inmutables

    completa = _definicion(db_at_016, "trg_elaboraciones_finalizacion_completa")
    assert "BEFORE UPDATE ON public.elaboraciones" in completa
    assert "finalizada" in completa and "WHEN" in completa

    usos = _definicion(db_at_016, "trg_usos_insumo_elaboracion_abierta")
    assert "BEFORE INSERT OR DELETE OR UPDATE ON public.usos_insumo" in usos


def test_upgrade_016_no_altera_los_datos_y_protege_lo_que_ya_estaba_finalizado(
    db_at_015: Engine, alembic_cfg: Config
) -> None:
    """A finalized elaboración created before the triggers (the schema at 015 has none) becomes
    protected, untouched."""
    elaboracion = _finalizada(db_at_015)
    antes = (_conteos(db_at_015), _fila(db_at_015, elaboracion), _usos(db_at_015, elaboracion))

    command.upgrade(alembic_cfg, REV_016)

    assert (_conteos(db_at_015), _fila(db_at_015, elaboracion), _usos(db_at_015, elaboracion)) == antes
    with pytest.raises(IntegrityError) as error:
        with db_at_015.begin() as conn:
            conn.execute(text("UPDATE elaboraciones SET codigo = 'OTRO' WHERE id = :e"), {"e": elaboracion})
    assert MARCADOR_FINALIZADA in str(error.value.orig)


def test_las_reglas_se_cumplen_con_el_esquema_de_la_migracion(db_at_016: Engine) -> None:
    """The migration installs the same rules as `create_all` (covered in detail in the triggers tests)."""
    elaboracion = _finalizada(db_at_016)
    for sentencia in (
        "UPDATE elaboraciones SET codigo = 'OTRO' WHERE id = :e",
        "DELETE FROM elaboraciones WHERE id = :e",
        "UPDATE usos_insumo SET sin_lote = false WHERE elaboracion_id = :e",
        "DELETE FROM usos_insumo WHERE elaboracion_id = :e",
    ):
        with pytest.raises(IntegrityError) as error:
            with db_at_016.begin() as conn:
                conn.execute(text(sentencia), {"e": elaboracion})
        assert MARCADOR_FINALIZADA in str(error.value.orig)

    with pytest.raises(IntegrityError) as error:
        with db_at_016.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO elaboraciones (productor_id, producto_id, version_producto_id, codigo, "
                    "fecha_elaboracion, estado, finalizada_at) "
                    "SELECT p.productor_id, p.id, v.id, 'E-009', DATE '2026-10-06', 'finalizada', now() "
                    "FROM productos p JOIN versiones_producto v ON v.producto_id = p.id WHERE p.nombre = 'Queque'"
                )
            )
    assert MARCADOR_NACE_BORRADOR in str(error.value.orig)

    sin_copias = _elaborar(db_at_016, "E-002")
    _insertar_uso(db_at_016, sin_copias, "Leche", "Leche A", con_copia=False)
    with pytest.raises(IntegrityError) as error:
        with db_at_016.begin() as conn:
            conn.execute(
                text("UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e"),
                {"e": sin_copias},
            )
    assert MARCADOR_INCOMPLETA in str(error.value.orig)

    borrador = _elaborar(db_at_016, "E-003")
    _insertar_uso(db_at_016, borrador, "Leche", "Leche A")
    with db_at_016.begin() as conn:
        conn.execute(text("DELETE FROM elaboraciones WHERE id = :e"), {"e": borrador})


# --- downgrade ---------------------------------------------------------------------------


def test_downgrade_016_elimina_solo_los_triggers_y_las_funciones_y_conserva_los_datos(
    db_at_016: Engine, alembic_cfg: Config
) -> None:
    elaboracion = _finalizada(db_at_016)
    antes = (_conteos(db_at_016), _fila(db_at_016, elaboracion), _usos(db_at_016, elaboracion))

    command.downgrade(alembic_cfg, REV_015)

    assert _revision(db_at_016) == REV_015
    assert _triggers(db_at_016) == {} and _funciones(db_at_016) == set()
    assert (_conteos(db_at_016), _fila(db_at_016, elaboracion), _usos(db_at_016, elaboracion)) == antes
    # Without the triggers the protection is gone, but nothing was deleted.
    with db_at_016.begin() as conn:
        conn.execute(text("UPDATE elaboraciones SET codigo = 'LIBRE' WHERE id = :e"), {"e": elaboracion})


def test_downgrade_016_y_nuevo_upgrade_son_reversibles(db_at_016: Engine, alembic_cfg: Config) -> None:
    triggers = _triggers(db_at_016)
    funciones = _funciones(db_at_016)
    definiciones = {nombre: _definicion(db_at_016, nombre) for nombre in TRIGGERS}

    command.downgrade(alembic_cfg, REV_015)
    command.upgrade(alembic_cfg, REV_016)

    assert _revision(db_at_016) == REV_016
    assert _triggers(db_at_016) == triggers
    assert _funciones(db_at_016) == funciones
    assert {nombre: _definicion(db_at_016, nombre) for nombre in TRIGGERS} == definiciones


# --- sin privilegios de superusuario -----------------------------------------------------


def test_la_migracion_se_aplica_con_un_rol_sin_privilegios_de_superusuario(test_url: str, alembic_cfg: Config) -> None:
    """As in production: a plain role that owns its database runs every migration, 016 included."""
    admin_url = make_url(test_url)
    base = admin_url.database
    nombre_bd = f"{base[: -len('_test')]}_nosuperuser_test"
    rol = "trazapp_nosuperuser_test"
    clave = secrets.token_urlsafe(24)  # generated now, never stored
    admin = create_engine(admin_url.set(database="postgres"), isolation_level="AUTOCOMMIT", poolclass=NullPool)
    previous = os.environ.get("DATABASE_URL")
    motor_rol = None

    def limpiar() -> None:
        with admin.connect() as conn:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{nombre_bd}" WITH (FORCE)'))
            conn.execute(text(f'DROP ROLE IF EXISTS "{rol}"'))

    try:
        limpiar()
        with admin.connect() as conn:
            conn.execute(
                text(f"CREATE ROLE \"{rol}\" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '{clave}'")
            )
            conn.execute(text(f'CREATE DATABASE "{nombre_bd}" OWNER "{rol}"'))
        url_rol = admin_url.set(username=rol, password=clave, database=nombre_bd)
        os.environ["DATABASE_URL"] = url_rol.render_as_string(hide_password=False)
        get_settings.cache_clear()

        command.upgrade(alembic_cfg, "head")

        motor_rol = create_engine(url_rol, poolclass=NullPool)
        with motor_rol.connect() as conn:
            assert conn.execute(text("SELECT rolsuper FROM pg_roles WHERE rolname = current_user")).scalar_one() is False
            assert conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one() == REV_016
        assert _triggers(motor_rol) == {nombre: (tabla, "O") for nombre, tabla in TRIGGERS.items()}
        assert _funciones(motor_rol) == FUNCIONES
        _semilla(motor_rol)
        elaboracion = _finalizada(motor_rol)
        with pytest.raises(IntegrityError) as error:
            with motor_rol.begin() as conn:
                conn.execute(text("DELETE FROM elaboraciones WHERE id = :e"), {"e": elaboracion})
        assert MARCADOR_FINALIZADA in str(error.value.orig)
        # And back down: dropping the triggers does not need superuser either.
        command.downgrade(alembic_cfg, REV_015)
        assert _triggers(motor_rol) == {} and _funciones(motor_rol) == set()
    finally:
        if motor_rol is not None:
            motor_rol.dispose()
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        get_settings.cache_clear()
        limpiar()
        admin.dispose()
