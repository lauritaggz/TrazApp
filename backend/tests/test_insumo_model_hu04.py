"""HU04 commercial supply model tests (T04-01).

Run on SQLite (schema from metadata.create_all) and on PostgreSQL when
TEST_DATABASE_URL is set. The migration itself is covered in test_migracion_013_insumos.py.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import MetaData, create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import Ingrediente, InsumoComercial, Productor


def _productor(session: Session, email: str = "insumos@ejemplo.com") -> Productor:
    productor = Productor(nombre="Productora HU04", email=email, password_hash="hash")
    session.add(productor)
    session.commit()
    return productor


def _ingrediente(session: Session, productor: Productor, nombre: str = "Leche") -> Ingrediente:
    ingrediente = Ingrediente(productor_id=productor.id, nombre=nombre, activo=True)
    session.add(ingrediente)
    session.commit()
    return ingrediente


def _insumo(
    productor: Productor,
    ingrediente: Ingrediente,
    nombre: str = "Leche Colun Semidescremada 1 L",
    **extra: object,
) -> InsumoComercial:
    return InsumoComercial(
        productor_id=productor.id,
        ingrediente_id=ingrediente.id,
        nombre=nombre,
        marca_origen="Colun",
        **extra,
    )


def test_registra_insumo_con_los_datos_obligatorios(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)

    insumo = _insumo(productor, ingrediente)
    db_session.add(insumo)
    db_session.commit()
    db_session.refresh(insumo)

    assert insumo.id is not None
    assert insumo.productor_id == productor.id
    assert insumo.ingrediente_id == ingrediente.id
    assert insumo.nombre == "Leche Colun Semidescremada 1 L"
    assert insumo.marca_origen == "Colun"
    assert insumo.presentacion is None
    assert insumo.codigo_barras is None
    assert insumo.ingredientes_declarados is None
    assert insumo.advertencias is None
    assert insumo.ficha is None
    assert insumo.fecha_recuperacion is None
    assert insumo.created_at is not None
    assert insumo.updated_at is not None
    assert insumo.ingrediente is ingrediente
    assert insumo.productor is productor
    assert ingrediente.insumos == [insumo]
    assert productor.insumos == [insumo]


def test_persiste_los_campos_opcionales_y_la_ficha_de_la_fuente(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor, "Chocolate")
    recuperado = datetime(2026, 10, 4, 15, 30, tzinfo=timezone.utc)
    ficha = {"product_name": "Chocolate Ambrosoli", "ingredients": ["azúcar", "cacao"], "n": 2}

    insumo = _insumo(
        productor,
        ingrediente,
        nombre="Chocolate Ambrosoli 500 g",
        presentacion="Barra de 500 g",
        codigo_barras="7802200000017",
        ingredientes_declarados="Azúcar, pasta de cacao, leche en polvo",
        advertencias="Puede contener trazas de maní",
        ficha=ficha,
        fuente="open_food_facts",
        fecha_recuperacion=recuperado,
    )
    db_session.add(insumo)
    db_session.commit()
    db_session.expire_all()

    guardado = db_session.get(InsumoComercial, insumo.id)
    assert guardado.presentacion == "Barra de 500 g"
    assert guardado.codigo_barras == "7802200000017"
    assert guardado.ingredientes_declarados == "Azúcar, pasta de cacao, leche en polvo"
    assert guardado.advertencias == "Puede contener trazas de maní"
    assert guardado.ficha == ficha
    assert guardado.fuente == "open_food_facts"
    assert guardado.fecha_recuperacion.replace(tzinfo=timezone.utc) == recuperado


def test_valores_por_defecto_de_fuente_habitual_y_activo(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)

    insumo = _insumo(productor, ingrediente)
    db_session.add(insumo)
    db_session.commit()
    db_session.refresh(insumo)

    assert insumo.fuente == "manual"
    assert insumo.habitual is False
    assert insumo.activo is True


@pytest.mark.parametrize("campo", ["nombre", "marca_origen", "productor_id", "ingrediente_id"])
def test_los_campos_obligatorios_no_admiten_nulo(db_session: Session, campo: str) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)
    insumo = _insumo(productor, ingrediente)
    setattr(insumo, campo, None)
    db_session.add(insumo)

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_el_ingrediente_y_el_productor_deben_existir(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)
    huerfano = _insumo(productor, ingrediente)
    huerfano.ingrediente_id = 99999
    db_session.add(huerfano)

    # SQLite only enforces foreign keys with PRAGMA foreign_keys=ON; PostgreSQL always does.
    if db_session.get_bind().dialect.name != "postgresql":
        pytest.skip("Las claves foráneas solo se hacen cumplir en PostgreSQL.")
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_codigo_de_barras_repetido_para_el_mismo_productor_se_rechaza(
    db_session: Session,
) -> None:
    productor = _productor(db_session)
    leche = _ingrediente(db_session, productor, "Leche")
    harina = _ingrediente(db_session, productor, "Harina")
    db_session.add(_insumo(productor, leche, codigo_barras="7801234567890"))
    db_session.commit()

    db_session.add(_insumo(productor, harina, nombre="Otra", codigo_barras="7801234567890"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_mismo_codigo_de_barras_en_productores_distintos_se_permite(
    db_session: Session,
) -> None:
    ana = _productor(db_session, "ana@ejemplo.com")
    beto = _productor(db_session, "beto@ejemplo.com")
    db_session.add_all(
        [
            _insumo(ana, _ingrediente(db_session, ana), codigo_barras="7801234567890"),
            _insumo(beto, _ingrediente(db_session, beto), codigo_barras="7801234567890"),
        ]
    )
    db_session.commit()

    assert db_session.query(InsumoComercial).filter_by(codigo_barras="7801234567890").count() == 2


def test_varios_insumos_sin_codigo_de_barras_se_permiten(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor, "Huevo")
    db_session.add_all(
        [
            _insumo(productor, ingrediente, nombre="Huevos de campo, feria local"),
            _insumo(productor, ingrediente, nombre="Huevos blancos, supermercado"),
            _insumo(productor, ingrediente, nombre="Huevos de codorniz"),
        ]
    )
    db_session.commit()

    assert db_session.query(InsumoComercial).filter(InsumoComercial.codigo_barras.is_(None)).count() == 3


def test_dos_insumos_habituales_para_el_mismo_ingrediente_se_rechazan(
    db_session: Session,
) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)
    db_session.add(_insumo(productor, ingrediente, nombre="Leche A", habitual=True))
    db_session.commit()

    db_session.add(_insumo(productor, ingrediente, nombre="Leche B", habitual=True))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_varios_no_habituales_para_el_mismo_ingrediente_se_permiten(
    db_session: Session,
) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)
    db_session.add_all(
        [
            _insumo(productor, ingrediente, nombre="Leche A", habitual=True),
            _insumo(productor, ingrediente, nombre="Leche B"),
            _insumo(productor, ingrediente, nombre="Leche C"),
            _insumo(productor, ingrediente, nombre="Leche D", habitual=False),
        ]
    )
    db_session.commit()

    assert db_session.query(InsumoComercial).filter_by(ingrediente_id=ingrediente.id).count() == 4


def test_cada_ingrediente_puede_tener_su_propio_habitual(db_session: Session) -> None:
    productor = _productor(db_session)
    leche = _ingrediente(db_session, productor, "Leche")
    harina = _ingrediente(db_session, productor, "Harina")
    db_session.add_all(
        [
            _insumo(productor, leche, nombre="Leche A", habitual=True),
            _insumo(productor, harina, nombre="Harina A", habitual=True),
        ]
    )
    db_session.commit()

    assert db_session.query(InsumoComercial).filter_by(habitual=True).count() == 2


def test_actualizar_un_insumo_renueva_updated_at(db_session: Session) -> None:
    productor = _productor(db_session)
    ingrediente = _ingrediente(db_session, productor)
    insumo = _insumo(productor, ingrediente)
    db_session.add(insumo)
    db_session.commit()
    inicial = insumo.updated_at

    insumo.nombre = "Leche Colun Entera 1 L"
    db_session.commit()
    db_session.refresh(insumo)

    assert insumo.nombre == "Leche Colun Entera 1 L"
    assert insumo.updated_at >= inicial


def test_los_indices_parciales_estan_definidos_en_el_modelo() -> None:
    indices = {ix.name: ix for ix in InsumoComercial.__table__.indexes}

    codigo = indices["uq_insumos_productor_codigo_barras"]
    assert codigo.unique
    assert [c.name for c in codigo.columns] == ["productor_id", "codigo_barras"]
    assert "codigo_barras IS NOT NULL" in str(codigo.dialect_options["postgresql"]["where"])
    assert "codigo_barras IS NOT NULL" in str(codigo.dialect_options["sqlite"]["where"])

    habitual = indices["uq_insumos_habitual_por_ingrediente"]
    assert habitual.unique
    assert [c.name for c in habitual.columns] == ["ingrediente_id"]
    assert "habitual" in str(habitual.dialect_options["postgresql"]["where"])
    assert "habitual" in str(habitual.dialect_options["sqlite"]["where"])


def test_los_indices_simples_de_las_claves_foraneas_estan_en_el_modelo() -> None:
    indices = {ix.name: ix for ix in InsumoComercial.__table__.indexes}

    for nombre, columna in (
        ("ix_insumos_comerciales_productor_id", "productor_id"),
        ("ix_insumos_comerciales_ingrediente_id", "ingrediente_id"),
    ):
        assert not indices[nombre].unique
        assert [c.name for c in indices[nombre].columns] == [columna]
        assert indices[nombre].dialect_options["postgresql"]["where"] is None


def test_sin_los_indices_los_duplicados_pasan() -> None:
    """Control: demuestra que las pruebas de unicidad dependen de los índices parciales.

    Copia la tabla sin índices a una base SQLite aparte. Si la protección saliera del
    modelo, las pruebas de arriba dejarían de fallar ante duplicados; aquí se ve el caso
    contrario y por qué esas pruebas detectarían su ausencia.
    """
    metadata = MetaData()
    for tabla_modelo in Base.metadata.sorted_tables:
        tabla_modelo.to_metadata(metadata)
    tabla = metadata.tables["insumos_comerciales"]
    for indice in list(tabla.indexes):
        tabla.indexes.discard(indice)
    engine = create_engine("sqlite://")
    # SQLite does not enforce foreign keys by default, so no parent rows are needed.
    metadata.create_all(engine)
    assert inspect(engine).get_indexes("insumos_comerciales") == []

    fila = {
        "productor_id": 1,
        "ingrediente_id": 1,
        "nombre": "Leche",
        "marca_origen": "Colun",
        "codigo_barras": "7801234567890",
        "habitual": True,
        "fuente": "manual",
        "activo": True,
    }
    with engine.begin() as conn:
        conn.execute(tabla.insert(), [fila, fila])
        total = conn.execute(tabla.select()).fetchall()
    assert len(total) == 2
