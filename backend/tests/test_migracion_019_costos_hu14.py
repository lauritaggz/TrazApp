"""Migration 019 tests against a real PostgreSQL test database (HU14 / T14-02).

These tests drop and recreate the `public` schema, so they only run when TEST_DATABASE_URL points to a
PostgreSQL database whose name ends in `_test`.

While the migration is a proposal it lives as `019_costos_producto_hu14.py.pendiente`, which Alembic
ignores. The tests copy the script directory to a temporary folder and give the file its `.py` name
there, so they exercise the real file in both states (pending or approved).
"""

import shutil
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.engine import Engine

from app.db.base import Base
from tests.test_migracion_011_alergenos import _reset_schema
from tests.test_migracion_015_elaboraciones import (
    _columnas,
    _conteos,
    _existe_tabla,
    _restricciones,
    _revision,
)
from tests.test_migracion_016_elaboracion_inmutable import _semilla, rol_sin_superusuario
from tests.test_migracion_017_alergenos_revisados import engine, test_url  # noqa: F401  (fixtures)
from tests.test_triggers_elaboracion_hu05 import _ejecutar, _finalizada, _fila, _usos

REV_018 = "018_publicacion_producto_hu09"
REV_019 = "019_costos_producto_hu14"
BACKEND_DIR = Path(__file__).resolve().parents[1]
VERSIONES = BACKEND_DIR / "alembic" / "versions"
ARCHIVO_019 = "019_costos_producto_hu14.py"

COLUMNAS_INSUMO = {
    "precio_referencia": ("numeric", "YES"),
    "precio_fuente": ("character varying", "YES"),
    "precio_fecha": ("timestamp with time zone", "YES"),
    "contenido_cantidad": ("numeric", "YES"),
    "contenido_unidad": ("character varying", "YES"),
    "contenido_fuente": ("character varying", "YES"),
}
CHECKS_INSUMO = {
    "ck_insumo_precio_no_negativo",
    "ck_insumo_precio_fuente",
    "ck_insumo_precio_completo",
    "ck_insumo_contenido_positivo",
    "ck_insumo_contenido_unidad",
    "ck_insumo_contenido_fuente",
    "ck_insumo_contenido_completo",
}
CHECKS_CANTIDADES = {"ck_producto_ingrediente_cantidad_positiva", "ck_producto_ingrediente_cantidad_unidad"}
CHECKS_OTROS = {"ck_producto_otro_costo_nombre", "ck_producto_otro_costo_monto", "ck_producto_otro_costo_orden"}
TABLAS_NUEVAS = ("producto_ingrediente_cantidades", "producto_otros_costos")


@pytest.fixture
def alembic_cfg(test_url: str, tmp_path: Path) -> Config:  # noqa: F811
    """A copy of the script directory in which 019 always has its `.py` name."""
    destino = tmp_path / "alembic"
    shutil.copytree(
        BACKEND_DIR / "alembic",
        destino,
        ignore=shutil.ignore_patterns("__pycache__", "*.pendiente"),
    )
    origen = VERSIONES / ARCHIVO_019
    if not origen.exists():
        origen = VERSIONES / f"{ARCHIVO_019}.pendiente"
    assert origen.exists(), "falta la migración 019 (ni .py ni .py.pendiente)"
    shutil.copy(origen, destino / "versions" / ARCHIVO_019)
    cfg = Config()
    cfg.set_main_option("script_location", str(destino))
    return cfg


@pytest.fixture
def db_at_018(engine: Engine, alembic_cfg: Config) -> Engine:  # noqa: F811
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_018)
    _semilla(engine)
    return engine


@pytest.fixture
def db_at_019(db_at_018: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_019)
    return db_at_018


def _estado(engine: Engine) -> dict[str, list[tuple]]:
    """What 019 must never change: the rows of the tables it does not own, in their old columns."""
    consultas = {
        "productos": "SELECT id, productor_id, nombre, activo, publicado, id_publico FROM productos ORDER BY id",
        "insumos": (
            "SELECT id, productor_id, ingrediente_id, nombre, marca_origen, presentacion, fuente, habitual, activo "
            "FROM insumos_comerciales ORDER BY id"
        ),
        "ingredientes": "SELECT id, productor_id, nombre, activo FROM ingredientes ORDER BY id",
        "versiones": "SELECT id, producto_id, numero_version, vigente FROM versiones_producto ORDER BY id",
    }
    with engine.connect() as conn:
        return {clave: [tuple(f) for f in conn.execute(text(sql))] for clave, sql in consultas.items()}


def _fila_cantidad(engine: Engine) -> None:
    _ejecutar(
        engine,
        "INSERT INTO producto_ingrediente_cantidades (producto_id, ingrediente_id, cantidad, unidad) "
        "SELECT p.id, i.id, 250, 'g' FROM productos p, ingredientes i WHERE p.nombre = 'Queque' AND i.nombre = 'Leche'",
    )


def _fila_otro_costo(engine: Engine) -> None:
    _ejecutar(
        engine,
        "INSERT INTO producto_otros_costos (producto_id, nombre, monto, orden) "
        "SELECT id, 'Envases', 1500, 1 FROM productos WHERE nombre = 'Queque'",
    )


def _tablas_y_columnas_nuevas(engine: Engine) -> bool:
    return (
        all(_existe_tabla(engine, tabla) for tabla in TABLAS_NUEVAS)
        or "rendimiento" in _columnas(engine, "productos")
        or bool(set(COLUMNAS_INSUMO) & set(_columnas(engine, "insumos_comerciales")))
    )


# --- cabeza de Alembic -----------------------------------------------------------------------------


def test_la_cabeza_de_alembic_es_la_019_y_cuelga_de_la_018(alembic_cfg: Config) -> None:
    scripts = ScriptDirectory.from_config(alembic_cfg)

    assert scripts.get_heads() == [REV_019]
    assert scripts.get_revision(REV_019).down_revision == REV_018
    assert len(REV_019) <= 32


def test_la_019_esta_en_la_cadena_real_o_pendiente() -> None:
    """Against the real script directory: approved (a `.py` and the head) or still a `.pendiente`."""
    cfg = Config()
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    scripts = ScriptDirectory.from_config(cfg)

    if (VERSIONES / ARCHIVO_019).exists():
        assert scripts.get_heads() == [REV_019]
        assert scripts.get_revision(REV_019).down_revision == REV_018
    else:
        assert (VERSIONES / f"{ARCHIVO_019}.pendiente").exists()
        assert scripts.get_heads() == [REV_018]


# --- upgrade -----------------------------------------------------------------------------------------


def test_upgrade_019_agrega_las_columnas_de_insumos(db_at_018: Engine, alembic_cfg: Config) -> None:
    antes = _columnas(db_at_018, "insumos_comerciales")
    command.upgrade(alembic_cfg, REV_019)
    despues = _columnas(db_at_018, "insumos_comerciales")

    assert set(despues) - set(antes) == set(COLUMNAS_INSUMO)
    for nombre, (tipo, nulo) in COLUMNAS_INSUMO.items():
        assert despues[nombre][:2] == (tipo, nulo)
    assert despues["precio_fuente"][2] == 20
    assert {k: v for k, v in despues.items() if k in antes} == antes
    assert _revision(db_at_018) == REV_019


def test_upgrade_019_agrega_rendimiento_a_productos(db_at_018: Engine, alembic_cfg: Config) -> None:
    antes = _columnas(db_at_018, "productos")
    command.upgrade(alembic_cfg, REV_019)
    despues = _columnas(db_at_018, "productos")

    assert set(despues) - set(antes) == {"rendimiento"}
    assert despues["rendimiento"][:2] == ("integer", "YES")
    assert {k: v for k, v in despues.items() if k in antes} == antes


def test_upgrade_019_crea_las_tablas_nuevas(db_at_019: Engine) -> None:
    cantidades = _columnas(db_at_019, "producto_ingrediente_cantidades")
    otros = _columnas(db_at_019, "producto_otros_costos")

    assert set(cantidades) == {"id", "producto_id", "ingrediente_id", "cantidad", "unidad", "updated_at"}
    assert cantidades["cantidad"][:2] == ("numeric", "NO")
    assert cantidades["unidad"][:2] == ("character varying", "NO")
    assert cantidades["updated_at"][:2] == ("timestamp with time zone", "NO")
    assert set(otros) == {"id", "producto_id", "nombre", "monto", "orden"}
    assert otros["nombre"] == ("character varying", "NO", 100)
    assert otros["monto"][:2] == ("numeric", "NO")
    assert otros["orden"][:2] == ("integer", "NO")


def test_upgrade_019_crea_los_check_y_la_unicidad(db_at_019: Engine) -> None:
    assert CHECKS_INSUMO <= set(_restricciones(db_at_019, "insumos_comerciales", "c"))
    assert "ck_producto_rendimiento_positivo" in _restricciones(db_at_019, "productos", "c")
    assert set(_restricciones(db_at_019, "producto_ingrediente_cantidades", "c")) == CHECKS_CANTIDADES
    assert set(_restricciones(db_at_019, "producto_otros_costos", "c")) == CHECKS_OTROS
    assert _restricciones(db_at_019, "producto_ingrediente_cantidades", "u") == {
        "uq_producto_ingrediente_cantidad": "UNIQUE (producto_id, ingrediente_id)"
    }
    assert _restricciones(db_at_019, "producto_ingrediente_cantidades", "f").keys() and all(
        "ON DELETE RESTRICT" in definicion
        for definicion in _restricciones(db_at_019, "producto_ingrediente_cantidades", "f").values()
    )


def test_las_restricciones_del_modelo_coinciden_con_las_de_la_migracion(db_at_019: Engine) -> None:
    """A rule changed only in the model or only in the migration would make the two schemas drift."""
    esperado = {
        "insumos_comerciales": CHECKS_INSUMO,
        "productos": {"ck_producto_rendimiento_positivo"},
        "producto_ingrediente_cantidades": CHECKS_CANTIDADES,
        "producto_otros_costos": CHECKS_OTROS,
    }
    for tabla, nombres in esperado.items():
        en_modelo = {c.name for c in Base.metadata.tables[tabla].constraints if c.name}
        en_base = set(_restricciones(db_at_019, tabla, "c"))
        assert nombres <= en_modelo, (tabla, nombres - en_modelo)
        assert nombres <= en_base, (tabla, nombres - en_base)
    assert "uq_producto_ingrediente_cantidad" in {
        c.name for c in Base.metadata.tables["producto_ingrediente_cantidades"].constraints
    }
    modelo_insumo = set(Base.metadata.tables["insumos_comerciales"].columns.keys())
    assert set(COLUMNAS_INSUMO) <= modelo_insumo
    assert set(COLUMNAS_INSUMO) <= set(_columnas(db_at_019, "insumos_comerciales"))
    for tabla in TABLAS_NUEVAS:
        assert set(Base.metadata.tables[tabla].columns.keys()) == set(_columnas(db_at_019, tabla))


def test_upgrade_019_deja_los_insumos_y_productos_existentes_intactos_y_sin_precio(
    db_at_018: Engine, alembic_cfg: Config
) -> None:
    antes = _estado(db_at_018)
    assert antes["insumos"] and antes["productos"]

    command.upgrade(alembic_cfg, REV_019)

    assert _estado(db_at_018) == antes
    with db_at_018.connect() as conn:
        insumos = conn.execute(
            text(
                "SELECT precio_referencia, precio_fuente, precio_fecha, "
                "contenido_cantidad, contenido_unidad, contenido_fuente FROM insumos_comerciales"
            )
        ).all()
        rendimientos = conn.execute(text("SELECT rendimiento FROM productos")).scalars().all()
        tablas = [conn.execute(text(f"SELECT count(*) FROM {t}")).scalar_one() for t in TABLAS_NUEVAS]
    assert insumos and all(set(fila) == {None} for fila in insumos)
    assert rendimientos and set(rendimientos) == {None}
    assert tablas == [0, 0]


def test_upgrade_019_no_toca_las_elaboraciones_ni_sus_usos(db_at_018: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_018, "E-001")
    antes = (_fila(db_at_018, finalizada), _usos(db_at_018, finalizada), _conteos(db_at_018))

    command.upgrade(alembic_cfg, REV_019)

    assert (_fila(db_at_018, finalizada), _usos(db_at_018, finalizada), _conteos(db_at_018)) == antes


# --- downgrade -----------------------------------------------------------------------------------------


def _se_niega(engine: Engine, cfg: Config, antes: dict, fragmento: str) -> None:
    with pytest.raises(RuntimeError, match="019") as error:
        command.downgrade(cfg, REV_018)

    assert fragmento in str(error.value)
    assert _revision(engine) == REV_019
    assert _estado(engine) == antes
    assert _tablas_y_columnas_nuevas(engine)
    assert all(_existe_tabla(engine, tabla) for tabla in TABLAS_NUEVAS)
    assert "rendimiento" in _columnas(engine, "productos")


def test_downgrade_019_revierte_sin_datos_nuevos(db_at_019: Engine, alembic_cfg: Config) -> None:
    command.downgrade(alembic_cfg, REV_018)

    assert _revision(db_at_019) == REV_018
    assert not any(_existe_tabla(db_at_019, tabla) for tabla in TABLAS_NUEVAS)
    assert "rendimiento" not in _columnas(db_at_019, "productos")
    assert not set(COLUMNAS_INSUMO) & set(_columnas(db_at_019, "insumos_comerciales"))
    assert not CHECKS_INSUMO & set(_restricciones(db_at_019, "insumos_comerciales", "c"))
    assert "ck_producto_rendimiento_positivo" not in _restricciones(db_at_019, "productos", "c")


def test_downgrade_019_se_niega_si_hay_precio_de_insumo(db_at_019: Engine, alembic_cfg: Config) -> None:
    _ejecutar(
        db_at_019,
        "UPDATE insumos_comerciales SET precio_referencia = 990, precio_fuente = 'manual', precio_fecha = now() "
        "WHERE nombre = 'Leche A'",
    )

    _se_niega(db_at_019, alembic_cfg, _estado(db_at_019), "1 insumo(s)")


def test_downgrade_019_se_niega_si_hay_contenido(db_at_019: Engine, alembic_cfg: Config) -> None:
    _ejecutar(
        db_at_019,
        "UPDATE insumos_comerciales SET contenido_cantidad = 1, contenido_unidad = 'L', contenido_fuente = 'manual' "
        "WHERE nombre = 'Leche B'",
    )

    _se_niega(db_at_019, alembic_cfg, _estado(db_at_019), "1 insumo(s)")


def test_downgrade_019_se_niega_si_hay_rendimiento(db_at_019: Engine, alembic_cfg: Config) -> None:
    _ejecutar(db_at_019, "UPDATE productos SET rendimiento = 8 WHERE nombre = 'Queque'")

    _se_niega(db_at_019, alembic_cfg, _estado(db_at_019), "1 producto(s) con rendimiento")


def test_downgrade_019_se_niega_si_hay_cantidades(db_at_019: Engine, alembic_cfg: Config) -> None:
    _fila_cantidad(db_at_019)

    _se_niega(db_at_019, alembic_cfg, _estado(db_at_019), "1 cantidad(es)")
    with db_at_019.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM producto_ingrediente_cantidades")).scalar_one() == 1


def test_downgrade_019_se_niega_si_hay_otros_costos(db_at_019: Engine, alembic_cfg: Config) -> None:
    _fila_otro_costo(db_at_019)

    _se_niega(db_at_019, alembic_cfg, _estado(db_at_019), "1 otro(s) costo(s)")
    with db_at_019.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM producto_otros_costos")).scalar_one() == 1


def test_downgrade_019_no_pierde_datos_de_otras_tablas(db_at_019: Engine, alembic_cfg: Config) -> None:
    finalizada = _finalizada(db_at_019, "E-001")
    antes = (_estado(db_at_019), _fila(db_at_019, finalizada), _usos(db_at_019, finalizada), _conteos(db_at_019))

    command.downgrade(alembic_cfg, REV_018)

    assert (_estado(db_at_019), _fila(db_at_019, finalizada), _usos(db_at_019, finalizada), _conteos(db_at_019)) == antes


def test_upgrade_downgrade_upgrade(db_at_018: Engine, alembic_cfg: Config) -> None:
    command.upgrade(alembic_cfg, REV_019)
    command.downgrade(alembic_cfg, REV_018)
    command.upgrade(alembic_cfg, REV_019)

    assert _revision(db_at_018) == REV_019
    assert all(_existe_tabla(db_at_018, tabla) for tabla in TABLAS_NUEVAS)


def test_la_019_se_aplica_con_un_rol_sin_privilegios_de_superusuario(test_url: str, alembic_cfg: Config) -> None:  # noqa: F811
    """As in production: a plain role runs `upgrade head`, and goes back down to 018 while it is empty."""
    with rol_sin_superusuario(test_url):
        command.upgrade(alembic_cfg, "head")
        command.downgrade(alembic_cfg, REV_018)
        command.upgrade(alembic_cfg, "head")
