"""HU04 allergens declared by a commercial supply: model tests (T04-02).

Run on SQLite (schema from metadata.create_all) and on PostgreSQL when
TEST_DATABASE_URL is set. The migration itself is covered in
test_migracion_014_insumos_alergenos.py.
"""

import pytest
from sqlalchemy import MetaData, create_engine, delete, inspect, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Alergeno, Ingrediente, InsumoAlergeno, InsumoComercial, Productor
from app.models.insumo import TIPO_CONTIENE, TIPO_TRAZAS, TIPOS_DECLARACION


def _productor(session: Session) -> Productor:
    productor = Productor(nombre="Productora HU04", email="alergenos@ejemplo.com", password_hash="hash")
    session.add(productor)
    session.commit()
    return productor


def _insumo(session: Session, productor: Productor, nombre: str = "Chocolate Ambrosoli 500 g") -> InsumoComercial:
    ingrediente = Ingrediente(productor_id=productor.id, nombre=f"Ingrediente de {nombre}", activo=True)
    session.add(ingrediente)
    session.flush()
    insumo = InsumoComercial(
        productor_id=productor.id,
        ingrediente_id=ingrediente.id,
        nombre=nombre,
        marca_origen="Ambrosoli",
    )
    session.add(insumo)
    session.commit()
    return insumo


def _alergenos(session: Session) -> dict[str, Alergeno]:
    catalogo = {
        "lacteos": Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True),
        "cacahuetes": Alergeno(codigo="cacahuetes", nombre="Maní", obligatorio_chile=True),
        "sesamo": Alergeno(codigo="sesamo", nombre="Sésamo", obligatorio_chile=False),
    }
    session.add_all(catalogo.values())
    session.commit()
    return catalogo


def test_los_tipos_permitidos_son_contiene_y_trazas() -> None:
    assert TIPOS_DECLARACION == ("contiene", "trazas")
    assert (TIPO_CONTIENE, TIPO_TRAZAS) == ("contiene", "trazas")


def test_asocia_un_alergeno_que_el_insumo_contiene(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]

    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo="contiene"))
    db_session.commit()
    db_session.refresh(insumo)

    assert [(a.alergeno.codigo, a.tipo) for a in insumo.alergenos_declarados] == [("lacteos", "contiene")]


def test_asocia_un_alergeno_que_el_insumo_puede_contener_como_trazas(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    mani = _alergenos(db_session)["cacahuetes"]

    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=mani.id, tipo="trazas"))
    db_session.commit()
    db_session.refresh(insumo)

    assert [(a.alergeno.codigo, a.tipo) for a in insumo.alergenos_declarados] == [("cacahuetes", "trazas")]


def test_un_insumo_declara_varios_alergenos_con_tipos_distintos(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    catalogo = _alergenos(db_session)
    insumo.alergenos_declarados = [
        InsumoAlergeno(alergeno_id=catalogo["lacteos"].id, tipo="contiene"),
        InsumoAlergeno(alergeno_id=catalogo["cacahuetes"].id, tipo="trazas"),
    ]
    db_session.commit()
    db_session.expire_all()

    declarados = {a.alergeno.codigo: a.tipo for a in db_session.get(InsumoComercial, insumo.id).alergenos_declarados}
    assert declarados == {"lacteos": "contiene", "cacahuetes": "trazas"}


@pytest.mark.parametrize("tipo", ["puede_contener", "contienen", "TRAZAS", "", " contiene"])
def test_rechaza_un_tipo_no_permitido(db_session: Session, tipo: str) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]

    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo=tipo))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_el_tipo_es_obligatorio(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]

    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo=None))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


@pytest.mark.parametrize(
    ("primero", "segundo"),
    [("contiene", "contiene"), ("trazas", "trazas"), ("contiene", "trazas"), ("trazas", "contiene")],
)
def test_rechaza_el_mismo_alergeno_dos_veces_en_un_insumo_aunque_cambie_el_tipo(
    db_session: Session, primero: str, segundo: str
) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]
    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo=primero))
    db_session.commit()

    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo=segundo))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    assert db_session.scalars(select(InsumoAlergeno)).all()[0].tipo == primero
    assert len(db_session.scalars(select(InsumoAlergeno)).all()) == 1


def test_permite_el_mismo_alergeno_en_insumos_distintos(db_session: Session) -> None:
    productor = _productor(db_session)
    chocolate = _insumo(db_session, productor, "Chocolate A")
    galleta = _insumo(db_session, productor, "Galleta B")
    leche = _alergenos(db_session)["lacteos"]

    db_session.add_all(
        [
            InsumoAlergeno(insumo_id=chocolate.id, alergeno_id=leche.id, tipo="contiene"),
            InsumoAlergeno(insumo_id=galleta.id, alergeno_id=leche.id, tipo="trazas"),
        ]
    )
    db_session.commit()
    db_session.refresh(leche)

    assert {(a.insumo.nombre, a.tipo) for a in leche.insumos} == {
        ("Chocolate A", "contiene"),
        ("Galleta B", "trazas"),
    }


def test_eliminar_el_insumo_elimina_sus_asociaciones(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]
    insumo.alergenos_declarados = [InsumoAlergeno(alergeno_id=leche.id, tipo="contiene")]
    db_session.commit()

    db_session.delete(insumo)
    db_session.commit()

    assert db_session.scalars(select(InsumoAlergeno)).all() == []
    assert db_session.get(Alergeno, leche.id) is not None


def test_un_alergeno_del_catalogo_en_uso_no_se_puede_eliminar(db_session: Session) -> None:
    insumo = _insumo(db_session, _productor(db_session))
    leche = _alergenos(db_session)["lacteos"]
    db_session.add(InsumoAlergeno(insumo_id=insumo.id, alergeno_id=leche.id, tipo="contiene"))
    db_session.commit()

    # SQLite only enforces foreign keys with PRAGMA foreign_keys=ON; PostgreSQL always does.
    if db_session.get_bind().dialect.name != "postgresql":
        pytest.skip("Las claves foráneas solo se hacen cumplir en PostgreSQL.")
    with pytest.raises(IntegrityError):
        db_session.execute(delete(Alergeno).where(Alergeno.id == leche.id))
        db_session.commit()
    db_session.rollback()


def test_la_estructura_sigue_el_patron_de_ingredientes_alergenos() -> None:
    tabla = InsumoAlergeno.__table__

    assert [c.name for c in tabla.primary_key.columns] == ["insumo_id", "alergeno_id"]
    claves = {fk.parent.name: fk.ondelete for fk in tabla.foreign_keys}
    assert claves == {"insumo_id": "CASCADE", "alergeno_id": "RESTRICT"}
    assert tabla.c.tipo.nullable is False
    checks = {c.name: str(c.sqltext) for c in tabla.constraints if c.__class__.__name__ == "CheckConstraint"}
    assert checks == {"ck_insumos_alergenos_tipo": "tipo IN ('contiene', 'trazas')"}


def test_sin_la_restriccion_check_un_tipo_invalido_pasaria() -> None:
    """Control: demuestra que el rechazo de tipos no permitidos viene del CHECK de la tabla."""
    metadata = MetaData()
    for tabla_modelo in Base.metadata.sorted_tables:
        tabla_modelo.to_metadata(metadata)
    tabla = metadata.tables["insumos_alergenos"]
    for restriccion in [c for c in tabla.constraints if c.__class__.__name__ == "CheckConstraint"]:
        tabla.constraints.discard(restriccion)
    engine = create_engine("sqlite://")
    metadata.create_all(engine)
    assert inspect(engine).get_check_constraints("insumos_alergenos") == []

    with engine.begin() as conn:
        conn.execute(tabla.insert(), {"insumo_id": 1, "alergeno_id": 1, "tipo": "puede_contener"})
        assert len(conn.execute(tabla.select()).fetchall()) == 1
