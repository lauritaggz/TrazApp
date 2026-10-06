"""Migration 015 tests against a real PostgreSQL test database (HU05 / T05-01).

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

REV_014 = "014_insumos_alergenos"
REV_015 = "015_elaboraciones_hu05"
BACKEND_DIR = Path(__file__).resolve().parents[1]
TABLAS = ("elaboraciones", "lotes_insumo", "usos_insumo")
UQ_VERSION = "uq_version_producto_id_producto"


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
def db_at_014(engine: Engine, alembic_cfg: Config) -> Engine:
    _reset_schema(engine)
    command.upgrade(alembic_cfg, REV_014)
    _seed(engine)
    return engine


@pytest.fixture
def db_at_015(db_at_014: Engine, alembic_cfg: Config) -> Engine:
    command.upgrade(alembic_cfg, REV_015)
    return db_at_014


def _seed(engine: Engine) -> None:
    """One productor with two products (one version each), an ingredient and two supplies."""
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
                "SELECT id, 'Leche', true FROM productores"
            )
        )
        for nombre in ("Queque", "Galletas"):
            conn.execute(
                text("INSERT INTO productos (productor_id, nombre, activo) SELECT id, :n, true FROM productores"),
                {"n": nombre},
            )
        conn.execute(
            text(
                "INSERT INTO versiones_producto (producto_id, numero_version, descripcion, vigente) "
                "SELECT id, 1, 'Versión 1', true FROM productos"
            )
        )
        for nombre in ("Leche A", "Leche B"):
            conn.execute(
                text(
                    "INSERT INTO insumos_comerciales "
                    "(productor_id, ingrediente_id, nombre, marca_origen) "
                    "SELECT p.id, i.id, :nombre, 'Marca' FROM productores p "
                    "JOIN ingredientes i ON i.productor_id = p.id"
                ),
                {"nombre": nombre},
            )


def _id(engine: Engine, tabla: str, columna: str, valor: str) -> int:
    with engine.connect() as conn:
        return conn.execute(
            text(f"SELECT id FROM {tabla} WHERE {columna} = :v"), {"v": valor}
        ).scalar_one()


def _version_de(engine: Engine, producto: str) -> int:
    with engine.connect() as conn:
        return conn.execute(
            text(
                "SELECT v.id FROM versiones_producto v JOIN productos p ON p.id = v.producto_id "
                "WHERE p.nombre = :n"
            ),
            {"n": producto},
        ).scalar_one()


def _elaborar(engine: Engine, codigo: str = "E-001", producto: str = "Queque", **extra: object) -> int:
    """Insert an elaboración of the product (with its own version) and return its id."""
    columnas = {"estado": "borrador", **extra}
    nombres = ", ".join(columnas)
    valores = ", ".join(f":{c}" for c in columnas)
    with engine.begin() as conn:
        return conn.execute(
            text(
                "INSERT INTO elaboraciones "
                "(productor_id, producto_id, version_producto_id, codigo, fecha_elaboracion"
                f", {nombres}) "
                "SELECT p.productor_id, p.id, v.id, :codigo, DATE '2026-10-06'"
                f", {valores} "
                "FROM productos p JOIN versiones_producto v ON v.producto_id = p.id "
                "WHERE p.nombre = :producto RETURNING id"
            ),
            {"codigo": codigo, "producto": producto, **columnas},
        ).scalar_one()


def _lotear(engine: Engine, insumo: str = "Leche A", codigo: str = "X123") -> int:
    with engine.begin() as conn:
        return conn.execute(
            text(
                "INSERT INTO lotes_insumo (insumo_id, codigo) "
                "SELECT id, :codigo FROM insumos_comerciales WHERE nombre = :insumo RETURNING id"
            ),
            {"codigo": codigo, "insumo": insumo},
        ).scalar_one()


def _usar(engine: Engine, elaboracion_id: int, **extra: object) -> int:
    campos = {
        "elaboracion_id": elaboracion_id,
        "ingrediente_id": _id(engine, "ingredientes", "nombre", "Leche"),
        **extra,
    }
    nombres = ", ".join(campos)
    valores = ", ".join(f":{c}" for c in campos)
    with engine.begin() as conn:
        return conn.execute(
            text(f"INSERT INTO usos_insumo ({nombres}) VALUES ({valores}) RETURNING id"), campos
        ).scalar_one()


def _revision(engine: Engine) -> str:
    with engine.connect() as conn:
        return conn.execute(text("SELECT version_num FROM alembic_version")).scalar_one()


def _existe_tabla(engine: Engine, tabla: str) -> bool:
    with engine.connect() as conn:
        return bool(conn.execute(text(f"SELECT to_regclass('public.{tabla}')")).scalar_one())


def _columnas(engine: Engine, tabla: str) -> dict[str, tuple]:
    with engine.connect() as conn:
        filas = conn.execute(
            text(
                "SELECT column_name, data_type, is_nullable, character_maximum_length "
                "FROM information_schema.columns "
                f"WHERE table_schema = 'public' AND table_name = '{tabla}'"
            )
        ).all()
    return {fila[0]: tuple(fila[1:]) for fila in filas}


def _restricciones(engine: Engine, tabla: str, tipo: str) -> dict[str, str]:
    with engine.connect() as conn:
        return {
            fila[0]: fila[1]
            for fila in conn.execute(
                text(
                    "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint "
                    f"WHERE conrelid = '{tabla}'::regclass AND contype = :tipo"
                ),
                {"tipo": tipo},
            )
        }


def _indices(engine: Engine, tabla: str) -> dict[str, str]:
    with engine.connect() as conn:
        return {
            fila[0]: fila[1]
            for fila in conn.execute(
                text("SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = :t"),
                {"t": tabla},
            )
        }


def _conteos(engine: Engine) -> dict[str, int]:
    with engine.connect() as conn:
        return {
            tabla: conn.execute(text(f"SELECT count(*) FROM {tabla}")).scalar_one()
            for tabla in (
                "productores",
                "ingredientes",
                "productos",
                "versiones_producto",
                "insumos_comerciales",
            )
        }


def _rechaza(engine: Engine, accion) -> None:
    with pytest.raises(IntegrityError):
        accion()


def test_se_niega_a_correr_si_la_base_no_termina_en_test(monkeypatch) -> None:
    monkeypatch.setenv(
        "TEST_DATABASE_URL",
        "postgresql+psycopg2://trazapp:x@localhost:5432/trazapp",
    )

    with pytest.raises(pytest.fail.Exception, match="no termina en '_test'"):
        _require_safe_test_url()


# --- upgrade: estructura -----------------------------------------------------------------


def test_upgrade_015_crea_las_tablas_con_sus_columnas(db_at_014: Engine, alembic_cfg: Config) -> None:
    assert not any(_existe_tabla(db_at_014, tabla) for tabla in TABLAS)

    command.upgrade(alembic_cfg, REV_015)

    assert _revision(db_at_014) == REV_015
    assert _columnas(db_at_014, "elaboraciones") == {
        "id": ("integer", "NO", None),
        "productor_id": ("integer", "NO", None),
        "producto_id": ("integer", "NO", None),
        "version_producto_id": ("integer", "NO", None),
        "codigo": ("character varying", "NO", 100),
        "fecha_elaboracion": ("date", "NO", None),
        "estado": ("character varying", "NO", 20),
        "finalizada_at": ("timestamp with time zone", "YES", None),
        "created_at": ("timestamp with time zone", "NO", None),
        "updated_at": ("timestamp with time zone", "NO", None),
    }
    assert _columnas(db_at_014, "lotes_insumo") == {
        "id": ("integer", "NO", None),
        "insumo_id": ("integer", "NO", None),
        "codigo": ("character varying", "NO", 100),
        "fecha_vencimiento": ("date", "YES", None),
        "created_at": ("timestamp with time zone", "NO", None),
    }
    assert _columnas(db_at_014, "usos_insumo") == {
        "id": ("integer", "NO", None),
        "elaboracion_id": ("integer", "NO", None),
        "ingrediente_id": ("integer", "NO", None),
        "insumo_id": ("integer", "YES", None),
        "lote_id": ("integer", "YES", None),
        "sin_lote": ("boolean", "NO", None),
        "informacion_conservada": ("jsonb", "YES", None),
        "created_at": ("timestamp with time zone", "NO", None),
        "updated_at": ("timestamp with time zone", "NO", None),
    }


def test_upgrade_015_agrega_el_unique_de_la_version_y_el_producto(db_at_014: Engine, alembic_cfg: Config) -> None:
    assert UQ_VERSION not in _restricciones(db_at_014, "versiones_producto", "u")

    command.upgrade(alembic_cfg, REV_015)

    assert _restricciones(db_at_014, "versiones_producto", "u")[UQ_VERSION] == "UNIQUE (id, producto_id)"


def test_upgrade_015_crea_las_claves_foraneas(db_at_015: Engine) -> None:
    assert sorted(_restricciones(db_at_015, "elaboraciones", "f").values()) == [
        "FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE RESTRICT",
        "FOREIGN KEY (productor_id) REFERENCES productores(id) ON DELETE RESTRICT",
        "FOREIGN KEY (version_producto_id, producto_id) "
        "REFERENCES versiones_producto(id, producto_id) ON DELETE RESTRICT",
    ]
    assert sorted(_restricciones(db_at_015, "lotes_insumo", "f").values()) == [
        "FOREIGN KEY (insumo_id) REFERENCES insumos_comerciales(id) ON DELETE RESTRICT",
    ]
    assert sorted(_restricciones(db_at_015, "usos_insumo", "f").values()) == [
        "FOREIGN KEY (elaboracion_id) REFERENCES elaboraciones(id) ON DELETE CASCADE",
        "FOREIGN KEY (ingrediente_id) REFERENCES ingredientes(id) ON DELETE RESTRICT",
        "FOREIGN KEY (insumo_id) REFERENCES insumos_comerciales(id) ON DELETE RESTRICT",
        "FOREIGN KEY (lote_id, insumo_id) REFERENCES lotes_insumo(id, insumo_id) ON DELETE RESTRICT",
    ]
    assert "fk_elaboraciones_version_producto" in _restricciones(db_at_015, "elaboraciones", "f")
    assert "fk_usos_insumo_lote_del_insumo" in _restricciones(db_at_015, "usos_insumo", "f")


def test_upgrade_015_crea_las_restricciones_unicas_y_los_checks(db_at_015: Engine) -> None:
    assert _restricciones(db_at_015, "lotes_insumo", "u") == {
        "uq_lotes_insumo_id_insumo": "UNIQUE (id, insumo_id)"
    }
    assert _restricciones(db_at_015, "usos_insumo", "u") == {
        "uq_usos_insumo_elaboracion_ingrediente": "UNIQUE (elaboracion_id, ingrediente_id)"
    }
    assert set(_restricciones(db_at_015, "elaboraciones", "c")) == {
        "ck_elaboraciones_estado",
        "ck_elaboraciones_finalizada_at",
        "ck_elaboraciones_codigo_no_vacio",
    }
    assert set(_restricciones(db_at_015, "lotes_insumo", "c")) == {"ck_lotes_insumo_codigo_no_vacio"}
    assert set(_restricciones(db_at_015, "usos_insumo", "c")) == {
        "ck_usos_insumo_lote_requiere_insumo",
        "ck_usos_insumo_sin_lote_excluye_lote",
    }


def test_upgrade_015_crea_los_indices(db_at_015: Engine) -> None:
    elaboraciones = _indices(db_at_015, "elaboraciones")
    assert "(producto_id, lower((codigo)::text))" in elaboraciones["uq_elaboraciones_producto_codigo"]
    assert "UNIQUE" in elaboraciones["uq_elaboraciones_producto_codigo"]
    assert "(productor_id, fecha_elaboracion DESC)" in elaboraciones["ix_elaboraciones_productor_fecha"]
    assert "(version_producto_id)" in elaboraciones["ix_elaboraciones_version_producto_id"]

    lotes = _indices(db_at_015, "lotes_insumo")
    assert "UNIQUE" in lotes["uq_lotes_insumo_insumo_codigo"]
    assert "(insumo_id, lower((codigo)::text))" in lotes["uq_lotes_insumo_insumo_codigo"]

    usos = _indices(db_at_015, "usos_insumo")
    assert "(insumo_id)" in usos["ix_usos_insumo_insumo_id"]
    assert "(lote_id)" in usos["ix_usos_insumo_lote_id"]


def test_upgrade_015_no_altera_los_datos_existentes(db_at_014: Engine, alembic_cfg: Config) -> None:
    antes = _conteos(db_at_014)

    command.upgrade(alembic_cfg, REV_015)

    assert _conteos(db_at_014) == antes


# --- upgrade: comportamiento de las restricciones ----------------------------------------


def test_los_valores_por_defecto_se_aplican_en_la_base(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    uso = _usar(db_at_015, elaboracion)

    with db_at_015.connect() as conn:
        estado, finalizada, creada = conn.execute(
            text("SELECT estado, finalizada_at, created_at FROM elaboraciones WHERE id = :i"),
            {"i": elaboracion},
        ).one()
        sin_lote, insumo, lote, conservada = conn.execute(
            text("SELECT sin_lote, insumo_id, lote_id, informacion_conservada FROM usos_insumo WHERE id = :i"),
            {"i": uso},
        ).one()

    assert (estado, finalizada) == ("borrador", None)
    assert creada is not None
    assert (sin_lote, insumo, lote, conservada) == (False, None, None, None)


@pytest.mark.parametrize("variante", ["E-001", "e-001"])
def test_el_codigo_de_elaboracion_es_unico_por_producto_sin_distinguir_mayusculas(
    db_at_015: Engine, variante: str
) -> None:
    _elaborar(db_at_015, "E-001")

    _rechaza(db_at_015, lambda: _elaborar(db_at_015, variante))


def test_el_mismo_codigo_de_elaboracion_en_otro_producto_se_permite(db_at_015: Engine) -> None:
    _elaborar(db_at_015, "E-001", producto="Queque")

    _elaborar(db_at_015, "E-001", producto="Galletas")


@pytest.mark.parametrize("variante", ["X123", "x123"])
def test_el_codigo_de_lote_es_unico_por_insumo_sin_distinguir_mayusculas(db_at_015: Engine, variante: str) -> None:
    _lotear(db_at_015, "Leche A", "X123")

    _rechaza(db_at_015, lambda: _lotear(db_at_015, "Leche A", variante))


def test_el_mismo_codigo_de_lote_en_otro_insumo_se_permite(db_at_015: Engine) -> None:
    _lotear(db_at_015, "Leche A", "X123")

    _lotear(db_at_015, "Leche B", "X123")


@pytest.mark.parametrize("estado", ["", "Borrador", "cancelada"])
def test_el_estado_solo_admite_borrador_o_finalizada(db_at_015: Engine, estado: str) -> None:
    _rechaza(db_at_015, lambda: _elaborar(db_at_015, estado=estado))


def test_finalizada_at_esta_ligada_al_estado_finalizada(db_at_015: Engine) -> None:
    _rechaza(db_at_015, lambda: _elaborar(db_at_015, "E-001", estado="finalizada"))
    _rechaza(db_at_015, lambda: _elaborar(db_at_015, "E-002", finalizada_at="2026-10-06 12:00+00"))

    _elaborar(db_at_015, "E-003", estado="finalizada", finalizada_at="2026-10-06 12:00+00")


@pytest.mark.parametrize("codigo", ["", "   "])
def test_los_codigos_vacios_se_rechazan(db_at_015: Engine, codigo: str) -> None:
    _rechaza(db_at_015, lambda: _elaborar(db_at_015, codigo))
    _rechaza(db_at_015, lambda: _lotear(db_at_015, "Leche A", codigo))


def test_un_uso_por_ingrediente_en_cada_elaboracion(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    _usar(db_at_015, elaboracion)

    _rechaza(db_at_015, lambda: _usar(db_at_015, elaboracion))


def test_sin_lote_excluye_un_lote_y_un_lote_exige_insumo(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    insumo = _id(db_at_015, "insumos_comerciales", "nombre", "Leche A")
    lote = _lotear(db_at_015, "Leche A")

    _rechaza(db_at_015, lambda: _usar(db_at_015, elaboracion, insumo_id=insumo, lote_id=lote, sin_lote=True))
    _rechaza(db_at_015, lambda: _usar(db_at_015, elaboracion, lote_id=lote))

    _usar(db_at_015, elaboracion, insumo_id=insumo, lote_id=lote)


def test_una_elaboracion_no_puede_usar_la_version_de_otro_producto(db_at_015: Engine) -> None:
    version_galletas = _version_de(db_at_015, "Galletas")
    producto_queque = _id(db_at_015, "productos", "nombre", "Queque")
    productor = _id(db_at_015, "productores", "email", "ana@ejemplo.com")

    def insertar() -> None:
        with db_at_015.begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO elaboraciones (productor_id, producto_id, version_producto_id, codigo, "
                    "fecha_elaboracion) VALUES (:pr, :p, :v, 'E-001', DATE '2026-10-06')"
                ),
                {"pr": productor, "p": producto_queque, "v": version_galletas},
            )

    _rechaza(db_at_015, insertar)


def test_un_uso_no_puede_apuntar_al_lote_de_otro_insumo(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    insumo_a = _id(db_at_015, "insumos_comerciales", "nombre", "Leche A")
    lote_de_b = _lotear(db_at_015, "Leche B")

    _rechaza(db_at_015, lambda: _usar(db_at_015, elaboracion, insumo_id=insumo_a, lote_id=lote_de_b))


def test_eliminar_una_elaboracion_elimina_sus_usos(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    _usar(db_at_015, elaboracion)

    with db_at_015.begin() as conn:
        conn.execute(text("DELETE FROM elaboraciones WHERE id = :i"), {"i": elaboracion})

    with db_at_015.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM usos_insumo")).scalar_one() == 0


def test_no_se_puede_eliminar_lo_que_una_elaboracion_o_un_uso_referencian(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    insumo = _id(db_at_015, "insumos_comerciales", "nombre", "Leche A")
    lote = _lotear(db_at_015, "Leche A")
    _usar(db_at_015, elaboracion, insumo_id=insumo, lote_id=lote)

    for tabla, id_ in (
        ("versiones_producto", _version_de(db_at_015, "Queque")),
        ("productos", _id(db_at_015, "productos", "nombre", "Queque")),
        ("insumos_comerciales", insumo),
        ("ingredientes", _id(db_at_015, "ingredientes", "nombre", "Leche")),
        ("lotes_insumo", lote),
    ):
        with pytest.raises(IntegrityError):
            with db_at_015.begin() as conn:
                conn.execute(text(f"DELETE FROM {tabla} WHERE id = :i"), {"i": id_})


def test_la_informacion_conservada_guarda_un_documento_jsonb(db_at_015: Engine) -> None:
    elaboracion = _elaborar(db_at_015)
    uso = _usar(db_at_015, elaboracion)

    with db_at_015.begin() as conn:
        conn.execute(
            text("UPDATE usos_insumo SET informacion_conservada = CAST(:doc AS jsonb) WHERE id = :i"),
            {"doc": '{"esquema": 1, "insumo": {"nombre": "Leche con ñ"}}', "i": uso},
        )

    with db_at_015.connect() as conn:
        nombre = conn.execute(
            text("SELECT informacion_conservada -> 'insumo' ->> 'nombre' FROM usos_insumo WHERE id = :i"),
            {"i": uso},
        ).scalar_one()
    assert nombre == "Leche con ñ"


# --- downgrade ---------------------------------------------------------------------------


def test_downgrade_015_con_las_tablas_vacias_las_elimina_y_conserva_lo_anterior(
    db_at_015: Engine, alembic_cfg: Config
) -> None:
    antes = _conteos(db_at_015)

    command.downgrade(alembic_cfg, REV_014)

    assert _revision(db_at_015) == REV_014
    assert not any(_existe_tabla(db_at_015, tabla) for tabla in TABLAS)
    assert UQ_VERSION not in _restricciones(db_at_015, "versiones_producto", "u")
    assert _conteos(db_at_015) == antes


def test_downgrade_015_se_niega_si_hay_elaboraciones_y_no_pierde_datos(
    db_at_015: Engine, alembic_cfg: Config
) -> None:
    elaboracion = _elaborar(db_at_015)
    _usar(db_at_015, elaboracion)

    with pytest.raises(RuntimeError, match="No se puede revertir la migración 015"):
        command.downgrade(alembic_cfg, REV_014)

    assert _revision(db_at_015) == REV_015
    assert all(_existe_tabla(db_at_015, tabla) for tabla in TABLAS)
    assert _restricciones(db_at_015, "versiones_producto", "u")[UQ_VERSION]
    with db_at_015.connect() as conn:
        assert conn.execute(text("SELECT count(*) FROM elaboraciones")).scalar_one() == 1
        assert conn.execute(text("SELECT count(*) FROM usos_insumo")).scalar_one() == 1


def test_downgrade_015_se_niega_tambien_si_solo_hay_lotes(db_at_015: Engine, alembic_cfg: Config) -> None:
    _lotear(db_at_015)

    with pytest.raises(RuntimeError, match="lotes_insumo: 1"):
        command.downgrade(alembic_cfg, REV_014)

    assert _revision(db_at_015) == REV_015


def test_downgrade_015_y_nuevo_upgrade_son_reversibles(db_at_015: Engine, alembic_cfg: Config) -> None:
    estructura = {
        tabla: (
            _columnas(db_at_015, tabla),
            _restricciones(db_at_015, tabla, "f"),
            _restricciones(db_at_015, tabla, "c"),
            _restricciones(db_at_015, tabla, "u"),
            _indices(db_at_015, tabla),
        )
        for tabla in TABLAS
    }

    command.downgrade(alembic_cfg, REV_014)
    command.upgrade(alembic_cfg, REV_015)

    assert _revision(db_at_015) == REV_015
    assert {
        tabla: (
            _columnas(db_at_015, tabla),
            _restricciones(db_at_015, tabla, "f"),
            _restricciones(db_at_015, tabla, "c"),
            _restricciones(db_at_015, tabla, "u"),
            _indices(db_at_015, tabla),
        )
        for tabla in TABLAS
    } == estructura
    assert _restricciones(db_at_015, "versiones_producto", "u")[UQ_VERSION]
