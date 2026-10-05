"""Persistence of commercial supplies, read from an independent database session (HU04).

The rest of the API tests share ONE session between the request and the assertions, so a
missing `commit` would go unnoticed: the change stays visible in that session. These tests
mimic production instead:

- every request gets its own session, closed when the request ends (an unconfirmed change
  is lost, as it would be in the real application);
- the result is read with a brand new session on a different connection, which only sees
  what was committed.

SQLite uses a temporary file database (the in-memory test database shares a single
connection); PostgreSQL uses the test database with regular, separate connections.
"""

import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

import app.models  # noqa: F401
from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models import Alergeno, InsumoAlergeno, InsumoComercial, Productor

PRODUCTOR = {
    "nombre": "Productor Persistencia",
    "nombre_negocio": "Panaderia P",
    "email": "productor.persistencia.hu04@ejemplo.com",
    "password": "SecretoProductor123!",
}
EAN_13 = "7802910000971"
OTRO_EAN_13 = "4006381333931"


@pytest.fixture
def motor(request, tmp_path) -> Generator[Engine, None, None]:
    if os.getenv("TEST_DATABASE_URL"):
        yield request.getfixturevalue("db_engine")
        return
    engine = create_engine(
        f"sqlite:///{tmp_path / 'persistencia.db'}",
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
    )
    Base.metadata.create_all(engine)
    yield engine
    Base.metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def fabrica(motor) -> sessionmaker:
    return sessionmaker(bind=motor, autocommit=False, autoflush=False)


@pytest.fixture
def api(fabrica) -> Generator[TestClient, None, None]:
    def sesion_por_peticion() -> Generator[Session, None, None]:
        db = fabrica()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = sesion_por_peticion
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def headers(api) -> dict[str, str]:
    assert api.post("/auth/register", json=PRODUCTOR).status_code == 201
    login = api.post("/auth/login", json={"email": PRODUCTOR["email"], "password": PRODUCTOR["password"]})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def leche(api, headers) -> int:
    response = api.post(
        "/gestion/ingredientes", headers=headers, json={"codigo_interno": "LEC-001", "nombre": "Leche"}
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def lacteos(fabrica) -> int:
    with fabrica() as sesion:
        alergeno = Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True)
        sesion.add(alergeno)
        sesion.commit()
        return alergeno.id


def _crear(api, headers, ingrediente_id: int, **extra) -> dict:
    response = api.post(
        "/gestion/insumos",
        headers=headers,
        json={"ingrediente_id": ingrediente_id, "nombre": "Leche Colun Semidescremada 1 L", "marca_origen": "Colun", **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _leer_insumo(fabrica, insumo_id: int) -> InsumoComercial | None:
    """Read with a brand new session: only committed data is visible."""
    with fabrica() as sesion:
        insumo = sesion.get(InsumoComercial, insumo_id)
        if insumo is not None:
            sesion.expunge(insumo)
        return insumo


def _leer_alergenos(fabrica, insumo_id: int) -> list[tuple[int, str]]:
    with fabrica() as sesion:
        filas = sesion.execute(
            select(InsumoAlergeno.alergeno_id, InsumoAlergeno.tipo).where(InsumoAlergeno.insumo_id == insumo_id)
        ).all()
    return [(fila[0], fila[1]) for fila in filas]


def test_el_lector_independiente_no_ve_lo_que_no_se_confirmo(fabrica) -> None:
    """Control of the harness: a change flushed but not committed is invisible to a new session."""
    with fabrica() as escritor:
        productor = Productor(nombre="X", email="control@ejemplo.com", password_hash="h")
        escritor.add(productor)
        escritor.flush()
        with fabrica() as lector:
            assert lector.scalars(select(Productor)).all() == []
        escritor.rollback()


def test_crear_un_insumo_persiste(api, headers, fabrica, leche) -> None:
    creado = _crear(
        api, headers, leche,
        presentacion="1 L", codigo_barras=EAN_13, advertencias="Contiene leche", habitual=True,
    )

    guardado = _leer_insumo(fabrica, creado["id"])

    assert guardado is not None
    assert (guardado.nombre, guardado.marca_origen, guardado.presentacion) == ("Leche Colun Semidescremada 1 L", "Colun", "1 L")
    assert (guardado.codigo_barras, guardado.advertencias) == (EAN_13, "Contiene leche")
    assert (guardado.ingrediente_id, guardado.productor_id) == (leche, creado["productor_id"])
    assert (guardado.activo, guardado.habitual, guardado.fuente) == (True, True, "manual")


def test_modificar_un_insumo_persiste(api, headers, fabrica, leche) -> None:
    creado = _crear(api, headers, leche, presentacion="1 L", codigo_barras=EAN_13)

    response = api.patch(
        f"/gestion/insumos/{creado['id']}",
        headers=headers,
        json={"nombre": "Leche Colun Entera 1 L", "presentacion": None, "codigo_barras": OTRO_EAN_13, "advertencias": "Contiene leche"},
    )

    assert response.status_code == 200
    guardado = _leer_insumo(fabrica, creado["id"])
    assert guardado.nombre == "Leche Colun Entera 1 L"
    assert guardado.presentacion is None
    assert guardado.codigo_barras == OTRO_EAN_13
    assert guardado.advertencias == "Contiene leche"
    assert guardado.marca_origen == "Colun"


def test_desactivar_un_insumo_persiste_y_le_quita_la_marca_de_habitual(api, headers, fabrica, leche) -> None:
    creado = _crear(api, headers, leche, habitual=True)

    assert api.delete(f"/gestion/insumos/{creado['id']}", headers=headers).status_code == 204

    guardado = _leer_insumo(fabrica, creado["id"])
    assert (guardado.activo, guardado.habitual) == (False, False)


def test_reactivar_un_insumo_persiste(api, headers, fabrica, leche) -> None:
    creado = _crear(api, headers, leche)
    api.delete(f"/gestion/insumos/{creado['id']}", headers=headers)
    assert _leer_insumo(fabrica, creado["id"]).activo is False

    response = api.patch(f"/gestion/insumos/{creado['id']}", headers=headers, json={"activo": True})

    assert response.status_code == 200
    guardado = _leer_insumo(fabrica, creado["id"])
    assert (guardado.activo, guardado.habitual) == (True, False)


def test_marcar_un_habitual_persiste_el_cambio_de_las_dos_filas(api, headers, fabrica, leche) -> None:
    anterior = _crear(api, headers, leche, nombre="A", habitual=True)
    nuevo = _crear(api, headers, leche, nombre="B")

    assert api.patch(f"/gestion/insumos/{nuevo['id']}", headers=headers, json={"habitual": True}).status_code == 200

    assert _leer_insumo(fabrica, anterior["id"]).habitual is False
    assert _leer_insumo(fabrica, nuevo["id"]).habitual is True


def test_asociar_un_alergeno_persiste(api, headers, fabrica, leche, lacteos) -> None:
    creado = _crear(api, headers, leche)

    response = api.post(
        f"/gestion/insumos/{creado['id']}/alergenos", headers=headers, json={"alergeno_id": lacteos, "tipo": "contiene"}
    )

    assert response.status_code == 201
    assert _leer_alergenos(fabrica, creado["id"]) == [(lacteos, "contiene")]


def test_cambiar_el_tipo_de_un_alergeno_persiste(api, headers, fabrica, leche, lacteos) -> None:
    creado = _crear(api, headers, leche)
    api.post(f"/gestion/insumos/{creado['id']}/alergenos", headers=headers, json={"alergeno_id": lacteos, "tipo": "contiene"})

    response = api.patch(f"/gestion/insumos/{creado['id']}/alergenos/{lacteos}", headers=headers, json={"tipo": "trazas"})

    assert response.status_code == 200
    assert _leer_alergenos(fabrica, creado["id"]) == [(lacteos, "trazas")]


def test_quitar_un_alergeno_persiste(api, headers, fabrica, leche, lacteos) -> None:
    creado = _crear(api, headers, leche)
    api.post(f"/gestion/insumos/{creado['id']}/alergenos", headers=headers, json={"alergeno_id": lacteos, "tipo": "trazas"})
    assert _leer_alergenos(fabrica, creado["id"]) == [(lacteos, "trazas")]

    assert api.delete(f"/gestion/insumos/{creado['id']}/alergenos/{lacteos}", headers=headers).status_code == 204

    assert _leer_alergenos(fabrica, creado["id"]) == []


def test_las_operaciones_de_alergenos_renuevan_updated_at_tambien_al_leer_con_otra_sesion(api, headers, fabrica, leche, lacteos) -> None:
    creado = _crear(api, headers, leche)
    inicial = _leer_insumo(fabrica, creado["id"]).updated_at

    api.post(f"/gestion/insumos/{creado['id']}/alergenos", headers=headers, json={"alergeno_id": lacteos, "tipo": "contiene"})

    renovado = _leer_insumo(fabrica, creado["id"]).updated_at
    assert renovado >= inicial
