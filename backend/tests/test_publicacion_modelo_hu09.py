"""HU09 publication state of products and hidden elaboraciones: model tests (T09-01).

Run on SQLite (schema from metadata.create_all) and on PostgreSQL when TEST_DATABASE_URL is set.
SQLite does not enforce foreign keys (nothing in the suite activates PRAGMA foreign_keys), so the
tests that depend on the FK or on the trigger of elaboraciones_ocultas run on PostgreSQL only.
The migration is covered in test_migracion_018_publicacion.py.
"""

import string
from datetime import datetime, timezone

import pytest
from sqlalchemy import insert, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.publicacion import LARGO_COLUMNA_ID_PUBLICO, generar_id_publico
from app.db.triggers_elaboracion import MARCADOR_OCULTAR_NO_FINALIZADA
from app.models import Elaboracion, ElaboracionOculta, Producto
from tests.conftest import USE_POSTGRESQL
from tests.test_elaboracion_model_hu05 import _elaboracion, _guardar, _producto, _productor, _version

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Las claves foráneas y los triggers solo se hacen cumplir en PostgreSQL.",
)

ALFABETO = set(string.ascii_letters + string.digits + "-_")


@pytest.fixture
def escenario(db_session: Session) -> dict:
    productor = _productor(db_session, "publicacion@ejemplo.com")
    producto = _producto(db_session, productor)
    version = _version(db_session, producto)
    return {"productor": productor, "producto": producto, "version": version}


def _elaboracion_guardada(session: Session, escenario: dict, codigo: str = "E-001") -> int:
    """An elaboración as the database allows it to be born: a borrador."""
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"], codigo)
    _guardar(session, elaboracion)
    return elaboracion.id


# --- producto: valores por defecto -----------------------------------------------------------


def test_un_producto_nuevo_nace_no_publicado_y_sin_id_publico(db_session: Session, escenario: dict) -> None:
    db_session.expire_all()
    producto = db_session.get(Producto, escenario["producto"].id)
    assert producto.publicado is False
    assert producto.id_publico is None


def test_publicado_en_nace_vacio(db_session: Session, escenario: dict) -> None:
    db_session.expire_all()
    assert db_session.get(Producto, escenario["producto"].id).publicado_en is None


def test_el_valor_por_defecto_de_publicado_lo_pone_la_base(db_session: Session, escenario: dict) -> None:
    """Without the ORM default: a raw INSERT that does not mention the column is unpublished."""
    db_session.execute(
        text("INSERT INTO productos (productor_id, nombre, activo) VALUES (:p, 'Crudo', true)"),
        {"p": escenario["productor"].id},
    )
    db_session.commit()
    fila = db_session.execute(text("SELECT publicado, id_publico FROM productos WHERE nombre = 'Crudo'")).one()
    assert not fila[0]
    assert fila[1] is None


# --- producto: id_publico ----------------------------------------------------------------------


def test_id_publico_es_unico_entre_productos(db_session: Session, escenario: dict) -> None:
    otro = _producto(db_session, escenario["productor"], "Galletas")
    escenario["producto"].id_publico = "abc123"
    db_session.commit()
    otro.id_publico = "abc123"
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_varios_productos_sin_id_publico_conviven(db_session: Session, escenario: dict) -> None:
    _producto(db_session, escenario["productor"], "Galletas")
    _producto(db_session, escenario["productor"], "Pan")
    sin_id = db_session.scalars(select(Producto.id).where(Producto.id_publico.is_(None))).all()
    assert len(sin_id) == 3


def test_no_se_puede_publicar_sin_id_publico(db_session: Session, escenario: dict) -> None:
    escenario["producto"].publicado = True
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_deshabilitar_conserva_el_id_publico_y_la_fecha(db_session: Session, escenario: dict) -> None:
    producto = escenario["producto"]
    producto.id_publico = generar_id_publico()
    producto.publicado = True
    producto.publicado_en = datetime.now(timezone.utc)
    db_session.commit()
    identificador = producto.id_publico
    producto.publicado = False
    db_session.commit()
    db_session.expire_all()
    recargado = db_session.get(Producto, producto.id)
    assert recargado.id_publico == identificador
    assert recargado.publicado_en is not None


def test_generar_id_publico_largo_alfabeto_y_variedad() -> None:
    ids = {generar_id_publico() for _ in range(200)}
    assert len(ids) == 200
    for valor in ids:
        assert 22 <= len(valor) <= LARGO_COLUMNA_ID_PUBLICO
        assert set(valor) <= ALFABETO


def test_un_id_generado_cabe_en_la_columna(db_session: Session, escenario: dict) -> None:
    escenario["producto"].id_publico = generar_id_publico()
    db_session.commit()


# --- elaboraciones ocultas ---------------------------------------------------------------------


def test_una_oculta_se_crea_y_se_elimina_sin_tocar_la_elaboracion(db_session: Session, escenario: dict) -> None:
    """On SQLite the borrador check is not enforced (no trigger): only the row's life is proven."""
    elaboracion_id = _elaboracion_guardada(db_session, escenario)
    consulta = text("SELECT codigo, estado, finalizada_at, fecha_elaboracion, updated_at FROM elaboraciones")
    antes = db_session.execute(consulta).all()

    if USE_POSTGRESQL:
        _finalizar_en_postgresql(db_session, elaboracion_id)
        antes = db_session.execute(consulta).all()

    db_session.add(ElaboracionOculta(elaboracion_id=elaboracion_id))
    db_session.commit()
    assert db_session.get(ElaboracionOculta, elaboracion_id).oculta_at is not None

    db_session.delete(db_session.get(ElaboracionOculta, elaboracion_id))
    db_session.commit()
    assert db_session.get(ElaboracionOculta, elaboracion_id) is None
    assert db_session.execute(consulta).all() == antes


def _finalizar_en_postgresql(session: Session, elaboracion_id: int) -> None:
    """Finalize through the legal path: a use with its conserved copy, then the state."""
    session.execute(
        text(
            "INSERT INTO ingredientes (productor_id, nombre, activo) "
            "SELECT productor_id, 'Leche', true FROM elaboraciones WHERE id = :e"
        ),
        {"e": elaboracion_id},
    )
    session.execute(
        text(
            "INSERT INTO insumos_comerciales (productor_id, ingrediente_id, nombre, marca_origen) "
            "SELECT e.productor_id, i.id, 'Leche A', 'Marca' FROM elaboraciones e "
            "JOIN ingredientes i ON i.productor_id = e.productor_id WHERE e.id = :e"
        ),
        {"e": elaboracion_id},
    )
    session.execute(
        text(
            "INSERT INTO usos_insumo (elaboracion_id, ingrediente_id, insumo_id, informacion_conservada) "
            "SELECT :e, i.id, c.id, CAST('{\"esquema\": 1}' AS jsonb) FROM ingredientes i, insumos_comerciales c "
            "WHERE c.nombre = 'Leche A' AND i.nombre = 'Leche'"
        ),
        {"e": elaboracion_id},
    )
    session.execute(
        text("UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e"),
        {"e": elaboracion_id},
    )
    session.commit()


def test_la_tabla_de_ocultas_no_duplica_una_elaboracion(db_session: Session, escenario: dict) -> None:
    elaboracion_id = _elaboracion_guardada(db_session, escenario)
    if USE_POSTGRESQL:
        _finalizar_en_postgresql(db_session, elaboracion_id)
    db_session.add(ElaboracionOculta(elaboracion_id=elaboracion_id))
    db_session.commit()
    with pytest.raises(IntegrityError):
        db_session.execute(insert(ElaboracionOculta).values(elaboracion_id=elaboracion_id))
        db_session.commit()
    db_session.rollback()


@solo_postgresql
def test_no_se_puede_ocultar_una_elaboracion_inexistente(db_session: Session, escenario: dict) -> None:
    db_session.add(ElaboracionOculta(elaboracion_id=999999))
    with pytest.raises(IntegrityError) as error:
        db_session.commit()
    db_session.rollback()
    assert error.value.orig.pgcode == "23503"  # foreign_key_violation: the FK, not the trigger


@solo_postgresql
def test_el_trigger_rechaza_ocultar_un_borrador(db_session: Session, escenario: dict) -> None:
    elaboracion_id = _elaboracion_guardada(db_session, escenario)
    assert db_session.get(Elaboracion, elaboracion_id).estado == "borrador"
    db_session.add(ElaboracionOculta(elaboracion_id=elaboracion_id))
    with pytest.raises(IntegrityError) as error:
        db_session.commit()
    db_session.rollback()
    assert MARCADOR_OCULTAR_NO_FINALIZADA in str(error.value.orig)
    assert error.value.orig.pgcode == "23000"
    assert db_session.get(ElaboracionOculta, elaboracion_id) is None


def test_la_clave_foranea_de_ocultas_es_on_delete_cascade() -> None:
    assert {fk.ondelete for fk in ElaboracionOculta.__table__.foreign_keys} == {"CASCADE"}
