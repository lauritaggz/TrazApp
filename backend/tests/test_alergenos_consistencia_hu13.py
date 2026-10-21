"""The allergen tables only name codes that exist in the catalog (T13-04 / HU13).

If a code of app/core/alergenos_palabras.py were renamed or mistyped, the detection would suggest an
allergen the database does not have. Two checks:

- on every backend: the codes against the catalog that migration 009 seeds (its source of truth);
- on PostgreSQL: the codes against the `alergenos` table that the real migrations leave in the
  database (they drop and recreate the schema of the `_test` database, like the other migration tests).
"""

import importlib.util
import os
from collections.abc import Generator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.pool import NullPool

from app.core import alergenos_palabras as tablas
from app.core.config import get_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _codigos_de_las_tablas() -> dict[str, set[str]]:
    return {
        "ETIQUETAS_OFF": set(tablas.ETIQUETAS_OFF.values()),
        "PALABRAS_CLAVE": set(tablas.PALABRAS_CLAVE),
        "PATRONES_CLAVE": set(tablas.PATRONES_CLAVE),
        "AMBIGUAS": set(tablas.AMBIGUAS.values()),
    }


def _catalogo_de_la_migracion_009() -> set[str]:
    ruta = BACKEND_DIR / "alembic" / "versions" / "009_seed_alergenos.py"
    spec = importlib.util.spec_from_file_location("migracion_009", ruta)
    assert spec is not None and spec.loader is not None
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return {codigo for codigo, _nombre in modulo.ALERGENOS_INICIALES}


def test_el_catalogo_de_la_migracion_tiene_los_catorce_alergenos() -> None:
    assert len(_catalogo_de_la_migracion_009()) == 14


@pytest.mark.parametrize("tabla", sorted(_codigos_de_las_tablas()))
def test_los_codigos_de_cada_tabla_existen_en_el_catalogo(tabla) -> None:
    desconocidos = _codigos_de_las_tablas()[tabla] - _catalogo_de_la_migracion_009()

    assert desconocidos == set(), f"{tabla} nombra códigos que no están en el catálogo"


def test_cada_alergeno_del_catalogo_tiene_etiqueta_y_palabras_clave() -> None:
    catalogo = _catalogo_de_la_migracion_009()

    assert set(tablas.ETIQUETAS_OFF.values()) == catalogo
    assert set(tablas.PALABRAS_CLAVE) == catalogo


def test_las_palabras_clave_estan_normalizadas_y_sin_repetirse() -> None:
    # The matcher compares normalized text: a keyword with accents or capitals would never match.
    from app.services.recuperacion.alergenos import normalizar_texto

    todas = [palabra for palabras in tablas.PALABRAS_CLAVE.values() for palabra in palabras]
    for palabra in todas:
        assert palabra == normalizar_texto(palabra), palabra
    for codigo, palabras in tablas.PALABRAS_CLAVE.items():
        assert len(palabras) == len(set(palabras)), codigo


def test_las_palabras_de_las_excepciones_estan_normalizadas() -> None:
    from app.services.recuperacion.alergenos import normalizar_texto

    for grupo in (
        tablas.CALIFICADORES_LECHE_VEGETAL,
        tablas.CALIFICADORES_CUBIERTOS,
        tablas.CALIFICADORES_A_REVISAR,
        tablas.PALABRAS_LACTEAS_CALIFICABLES,
        tablas.NO_NEGABLES,
        tuple(tablas.AMBIGUAS),
        tuple(tablas.IGNORAR_SI_SIGUE),
    ):
        for palabra in grupo:
            assert palabra == normalizar_texto(palabra), palabra


# --- against the real database (PostgreSQL) ---


def _require_safe_test_url() -> str:
    raw_url = os.getenv("TEST_DATABASE_URL")
    if not raw_url:
        pytest.skip("Requiere TEST_DATABASE_URL apuntando a PostgreSQL (base *_test).")
    url = make_url(raw_url)
    if not url.drivername.startswith("postgresql"):
        pytest.fail(f"Esta prueba requiere PostgreSQL, no {url.drivername}.")
    if not (url.database or "").endswith("_test"):
        pytest.fail(
            f"Me niego a correr: la base '{url.database}' no termina en '_test' "
            "y esta prueba borra el esquema completo."
        )
    return raw_url


def _reset_schema(engine: Engine) -> None:
    assert (engine.url.database or "").endswith("_test"), engine.url
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


@pytest.fixture
def catalogo_real() -> Generator[set[str], None, None]:
    raw_url = _require_safe_test_url()
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = raw_url
    get_settings.cache_clear()
    engine = create_engine(raw_url, poolclass=NullPool)
    try:
        assert (make_url(get_settings().database_url).database or "").endswith("_test")
        _reset_schema(engine)
        cfg = Config()
        cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        command.upgrade(cfg, "head")
        with engine.connect() as conn:
            yield {fila[0] for fila in conn.execute(text("SELECT codigo FROM alergenos"))}
    finally:
        _reset_schema(engine)
        engine.dispose()
        if previous is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = previous
        get_settings.cache_clear()


def test_los_codigos_de_las_tablas_existen_en_el_catalogo_de_la_base_migrada(catalogo_real) -> None:
    for tabla, codigos in _codigos_de_las_tablas().items():
        assert codigos - catalogo_real == set(), tabla
    assert len(catalogo_real) == 14
    assert set(tablas.ETIQUETAS_OFF.values()) == catalogo_real
