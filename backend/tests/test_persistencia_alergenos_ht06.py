"""Persistence, atomicity and locking of the bulk allergen declaration (HT06-02).

Every request has its own session and the result is read with a brand new one (fixtures `api` and
`fabrica` in conftest.py), so a missing `commit` or a half-applied change is detected. The locking
case runs on PostgreSQL only: the finalization of an elaboración locks the supplies FOR SHARE, and
the replacement of the allergens must wait for it.
"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.main import app
from app.models import Alergeno, InsumoAlergeno, InsumoComercial
from app.repositories.insumo_repository import InsumoRepository
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import en_hilo

PRODUCTOR = {
    "nombre": "Productor Bloque",
    "nombre_negocio": "Panaderia B",
    "email": "productor.bloque.ht06@ejemplo.com",
    "password": "SecretoProductor123!",
}

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Los bloqueos de fila y las conexiones simultáneas requieren PostgreSQL.",
)


@pytest.fixture
def headers(api) -> dict[str, str]:
    assert api.post("/auth/register", json=PRODUCTOR).status_code == 201
    login = api.post("/auth/login", json={"email": PRODUCTOR["email"], "password": PRODUCTOR["password"]})
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def leche(api, headers) -> int:
    respuesta = api.post("/gestion/ingredientes", headers=headers, json={"codigo_interno": "LEC-001", "nombre": "Leche"})
    assert respuesta.status_code == 201
    return respuesta.json()["id"]


@pytest.fixture
def catalogo(fabrica) -> dict[str, int]:
    with fabrica() as sesion:
        filas = {
            "lacteos": Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True),
            "soja": Alergeno(codigo="soja", nombre="Soya", obligatorio_chile=True),
            "apio": Alergeno(codigo="apio", nombre="Apio", obligatorio_chile=False),
        }
        sesion.add_all(filas.values())
        sesion.commit()
        return {codigo: alergeno.id for codigo, alergeno in filas.items()}


def _payload(ingrediente_id: int, **extra) -> dict:
    return {"ingrediente_id": ingrediente_id, "nombre": "Leche Colun 1 L", "marca_origen": "Colun", **extra}


def _lista(catalogo: dict[str, int], *pares: tuple[str, str]) -> list[dict]:
    return [{"alergeno_id": catalogo[codigo], "tipo": tipo} for codigo, tipo in pares]


def _estado(fabrica, insumo_id: int | None = None) -> dict:
    """What a brand new session sees: the supplies (with their review date) and every allergen row."""
    with fabrica() as sesion:
        insumos = sesion.scalars(select(InsumoComercial).order_by(InsumoComercial.id)).all()
        filas = sesion.execute(
            select(InsumoAlergeno.insumo_id, InsumoAlergeno.alergeno_id, InsumoAlergeno.tipo).order_by(
                InsumoAlergeno.insumo_id, InsumoAlergeno.alergeno_id
            )
        ).all()
        return {
            "insumos": [i.id for i in insumos],
            "revisados": {i.id: i.alergenos_revisados_at for i in insumos},
            "filas": [tuple(f) for f in filas],
        }


# --- el alta ------------------------------------------------------------------------------


def test_el_alta_con_alergenos_se_confirma_con_el_insumo_las_filas_y_la_fecha(api, fabrica, headers, leche, catalogo) -> None:
    creado = api.post(
        "/gestion/insumos",
        headers=headers,
        json=_payload(leche, alergenos=_lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas"))),
    )

    assert creado.status_code == 201, creado.text
    estado = _estado(fabrica)
    assert estado["insumos"] == [creado.json()["id"]]
    assert estado["revisados"][creado.json()["id"]] is not None
    assert estado["filas"] == [
        (creado.json()["id"], catalogo["lacteos"], "contiene"),
        (creado.json()["id"], catalogo["soja"], "trazas"),
    ]


def test_el_alta_con_lista_vacia_confirma_la_fecha_sin_filas(api, fabrica, headers, leche, catalogo) -> None:
    creado = api.post("/gestion/insumos", headers=headers, json=_payload(leche, alergenos=[]))

    estado = _estado(fabrica)
    assert estado["revisados"][creado.json()["id"]] is not None
    assert estado["filas"] == []


def test_el_alta_sin_el_campo_confirma_el_insumo_sin_fecha(api, fabrica, headers, leche, catalogo) -> None:
    creado = api.post("/gestion/insumos", headers=headers, json=_payload(leche))

    assert _estado(fabrica)["revisados"] == {creado.json()["id"]: None}


def test_un_fallo_al_confirmar_el_alta_no_deja_ni_el_insumo_ni_las_filas(api, fabrica, headers, leche, catalogo, monkeypatch) -> None:
    def falla_al_confirmar(self) -> None:
        self.db.rollback()
        raise IntegrityError("COMMIT", {}, Exception("fallo simulado"))

    with monkeypatch.context() as m:
        m.setattr(InsumoRepository, "commit", falla_al_confirmar)
        respuesta = api.post(
            "/gestion/insumos",
            headers=headers,
            json=_payload(leche, alergenos=_lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas"))),
        )

    assert respuesta.status_code == 409
    assert _estado(fabrica) == {"insumos": [], "revisados": {}, "filas": []}


def test_un_alergeno_invalido_en_el_alta_no_deja_nada_en_la_base(api, fabrica, headers, leche, catalogo) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=headers,
        json=_payload(leche, alergenos=_lista(catalogo, ("lacteos", "contiene")) + [{"alergeno_id": 99999, "tipo": "trazas"}]),
    )

    assert respuesta.status_code == 422
    assert _estado(fabrica) == {"insumos": [], "revisados": {}, "filas": []}


# --- el PUT ---------------------------------------------------------------------------------


def _insumo_con(api, headers, leche, catalogo, *pares: tuple[str, str]) -> int:
    creado = api.post("/gestion/insumos", headers=headers, json=_payload(leche, alergenos=_lista(catalogo, *pares)))
    assert creado.status_code == 201, creado.text
    return creado.json()["id"]


def test_el_put_se_confirma_y_otra_sesion_ve_la_lista_nueva_y_la_fecha(api, fabrica, headers, leche, catalogo) -> None:
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"))
    fecha_anterior = _estado(fabrica)["revisados"][insumo]

    respuesta = api.put(
        f"/gestion/insumos/{insumo}/alergenos",
        headers=headers,
        json={"alergenos": _lista(catalogo, ("soja", "contiene"), ("apio", "trazas"))},
    )

    assert respuesta.status_code == 200, respuesta.text
    estado = _estado(fabrica)
    assert sorted(estado["filas"]) == sorted(
        [(insumo, catalogo["soja"], "contiene"), (insumo, catalogo["apio"], "trazas")]
    )
    assert estado["revisados"][insumo] >= fecha_anterior


def test_un_put_que_vacia_la_lista_se_confirma_con_la_fecha_y_sin_filas(api, fabrica, headers, leche, catalogo) -> None:
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"), ("soja", "trazas"))

    api.put(f"/gestion/insumos/{insumo}/alergenos", headers=headers, json={"alergenos": []})

    estado = _estado(fabrica)
    assert estado["filas"] == []
    assert estado["revisados"][insumo] is not None


def test_un_put_invalido_no_cambia_nada_en_la_base(api, fabrica, headers, leche, catalogo) -> None:
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"), ("soja", "trazas"))
    antes = _estado(fabrica)

    for lista in (
        _lista(catalogo, ("apio", "contiene")) + [{"alergeno_id": 99999, "tipo": "trazas"}],
        _lista(catalogo, ("apio", "contiene"), ("apio", "trazas")),
    ):
        respuesta = api.put(f"/gestion/insumos/{insumo}/alergenos", headers=headers, json={"alergenos": lista})
        assert respuesta.status_code == 422

    assert _estado(fabrica) == antes


def test_un_fallo_al_confirmar_el_put_deja_la_lista_y_la_fecha_anteriores(api, fabrica, headers, leche, catalogo, monkeypatch) -> None:
    """The replacement removes, changes and adds rows: either all of it is saved or none of it."""
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"), ("soja", "trazas"))
    antes = _estado(fabrica)

    def falla_al_confirmar(self) -> None:
        self.db.rollback()
        raise IntegrityError("COMMIT", {}, Exception("fallo simulado"))

    with monkeypatch.context() as m:
        m.setattr(InsumoRepository, "commit", falla_al_confirmar)
        respuesta = api.put(
            f"/gestion/insumos/{insumo}/alergenos",
            headers=headers,
            json={"alergenos": _lista(catalogo, ("soja", "contiene"), ("apio", "contiene"))},
        )

    assert respuesta.status_code == 409
    assert _estado(fabrica) == antes


def test_el_put_de_un_insumo_ajeno_no_toca_la_base(api, fabrica, headers, leche, catalogo) -> None:
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"))
    otro = {**PRODUCTOR, "email": "otro.bloque.ht06@ejemplo.com"}
    api.post("/auth/register", json=otro)
    token = api.post("/auth/login", json={"email": otro["email"], "password": otro["password"]}).json()["access_token"]
    antes = _estado(fabrica)

    respuesta = api.put(
        f"/gestion/insumos/{insumo}/alergenos",
        headers={"Authorization": f"Bearer {token}"},
        json={"alergenos": []},
    )

    assert respuesta.status_code == 404
    assert _estado(fabrica) == antes


# --- endpoints individuales, vistos desde otra sesión ---------------------------------------


def test_los_endpoints_individuales_confirman_la_fecha_de_revision(api, fabrica, headers, leche, catalogo) -> None:
    insumo = api.post("/gestion/insumos", headers=headers, json=_payload(leche)).json()["id"]
    assert _estado(fabrica)["revisados"][insumo] is None

    api.post(f"/gestion/insumos/{insumo}/alergenos", headers=headers, json={"alergeno_id": catalogo["lacteos"], "tipo": "contiene"})
    assert _estado(fabrica)["revisados"][insumo] is not None

    api.delete(f"/gestion/insumos/{insumo}/alergenos/{catalogo['lacteos']}", headers=headers)
    estado = _estado(fabrica)
    assert estado["filas"] == [] and estado["revisados"][insumo] is not None


# --- bloqueo (PostgreSQL) -------------------------------------------------------------------


@solo_postgresql
def test_el_put_espera_a_quien_retiene_el_insumo_con_for_share_como_la_finalizacion(api, fabrica, headers, leche, catalogo) -> None:
    """The finalization locks the supplies FOR SHARE. The replacement takes FOR UPDATE, so it waits
    until that transaction ends and never rewrites the list in the middle of a copy."""
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"))
    resultados: list = []

    with fabrica() as retenedora:
        retenedora.execute(select(InsumoComercial.id).where(InsumoComercial.id == insumo).with_for_update(read=True))
        hilo = en_hilo(
            resultados,
            "put",
            lambda: TestClient(app).put(
                f"/gestion/insumos/{insumo}/alergenos",
                headers=headers,
                json={"alergenos": _lista(catalogo, ("soja", "contiene"))},
            ),
        )
        time.sleep(1.0)
        termino_durante_la_retencion = bool(resultados)
        filas_durante_la_retencion = _estado(fabrica)["filas"]
        retenedora.rollback()

    hilo.join(timeout=30)

    assert termino_durante_la_retencion is False, "el PUT no debió terminar mientras otro retenía el insumo"
    assert filas_durante_la_retencion == [(insumo, catalogo["lacteos"], "contiene")]
    assert resultados[0][1].status_code == 200
    assert _estado(fabrica)["filas"] == [(insumo, catalogo["soja"], "contiene")]


@solo_postgresql
def test_dos_put_simultaneos_dejan_una_de_las_dos_listas_completa(api, fabrica, headers, leche, catalogo) -> None:
    """Never a mix of both: the second waits for the first and replaces it as a whole."""
    insumo = _insumo_con(api, headers, leche, catalogo, ("lacteos", "contiene"))
    primera = _lista(catalogo, ("soja", "contiene"), ("apio", "contiene"))
    segunda = _lista(catalogo, ("lacteos", "trazas"))
    resultados: list = []

    hilos = [
        en_hilo(
            resultados,
            nombre,
            lambda lista=lista: TestClient(app).put(
                f"/gestion/insumos/{insumo}/alergenos", headers=headers, json={"alergenos": lista}
            ),
        )
        for nombre, lista in (("primera", primera), ("segunda", segunda))
    ]
    for hilo in hilos:
        hilo.join(timeout=30)

    assert sorted(r.status_code for _, r in resultados) == [200, 200]
    filas = {(a, t) for _, a, t in _estado(fabrica)["filas"]}
    assert filas in (
        {(catalogo["soja"], "contiene"), (catalogo["apio"], "contiene")},
        {(catalogo["lacteos"], "trazas")},
    )
