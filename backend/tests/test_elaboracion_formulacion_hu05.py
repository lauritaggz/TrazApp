"""Elaboraciones and the versioned formulation (HU05 / T05-02).

PT05-13 closes PT03-09 (modify a used formulation): once an elaboración exists, changing the
recipe creates a new version and the elaboración keeps the one it was made with.
"""

import pytest
from sqlalchemy import select

from app.models import VersionProducto
from tests.escenario_hu05 import (
    crear_elaboracion,
    crear_ingrediente,
    crear_producto,
    formular,
    preparar,
    registrar,
)


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    return {"headers": headers, **preparar(client, headers)}


def _versiones(db_session, producto_id: int) -> list[tuple[int, bool, bool]]:
    db_session.expire_all()
    return [
        (v.numero_version, v.vigente, v.usada_en_elaboracion)
        for v in db_session.scalars(
            select(VersionProducto)
            .where(VersionProducto.producto_id == producto_id)
            .order_by(VersionProducto.numero_version)
        )
    ]


def _ingredientes(elaboracion: dict) -> list[int]:
    return [uso["ingrediente_id"] for uso in elaboracion["usos"]]


def test_pt05_13_modificar_la_formulacion_con_elaboraciones_genera_una_version_nueva(
    client, ctx, db_session
) -> None:
    producto_id = ctx["producto"]["id"]
    elaboracion = crear_elaboracion(client, ctx["headers"], producto_id).json()
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")

    guardada = client.put(
        f"/gestion/productos/{producto_id}/formulacion",
        headers=ctx["headers"],
        json={"lineas": [{"ingrediente_id": ctx["harina"]["id"]}, {"ingrediente_id": azucar["id"]}]},
    )

    assert guardada.status_code == 200
    assert guardada.json()["resultado"] == "nueva_version"
    assert guardada.json()["version"]["numero_version"] == 2
    assert _versiones(db_session, producto_id) == [(1, False, True), (2, True, False)]

    detalle = client.get(f"/gestion/elaboraciones/{elaboracion['id']}", headers=ctx["headers"]).json()
    assert detalle["version"] == {"id": ctx["version"]["id"], "numero_version": 1}
    assert _ingredientes(detalle) == [ctx["harina"]["id"], ctx["leche"]["id"]]
    historica = client.get(
        f"/gestion/productos/{producto_id}/versiones/{ctx['version']['id']}/formulacion",
        headers=ctx["headers"],
    ).json()
    assert [linea["ingrediente_id"] for linea in historica] == [ctx["harina"]["id"], ctx["leche"]["id"]]


def test_sin_elaboraciones_la_misma_modificacion_se_hace_en_el_lugar(client, ctx, db_session) -> None:
    """Contrast with PT05-13: without an elaboración the version is not used and is edited in place."""
    producto_id = ctx["producto"]["id"]
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")

    guardada = client.put(
        f"/gestion/productos/{producto_id}/formulacion",
        headers=ctx["headers"],
        json={"lineas": [{"ingrediente_id": azucar["id"]}]},
    )

    assert guardada.json()["resultado"] == "modificada_en_lugar"
    assert _versiones(db_session, producto_id) == [(1, True, False)]


def test_un_borrador_tambien_conserva_su_version_cuando_cambia_la_receta(client, ctx, db_session) -> None:
    """The version is flagged as used when the borrador is created, not when it is finalized."""
    producto_id = ctx["producto"]["id"]
    borrador = crear_elaboracion(client, ctx["headers"], producto_id).json()

    formular(client, ctx["headers"], producto_id, ctx["harina"])

    assert borrador["estado"] == "borrador"
    assert _versiones(db_session, producto_id) == [(1, False, True), (2, True, False)]
    detalle = client.get(f"/gestion/elaboraciones/{borrador['id']}", headers=ctx["headers"]).json()
    assert detalle["version"]["numero_version"] == 1
    assert len(detalle["usos"]) == 2


def test_una_elaboracion_nueva_usa_la_version_vigente_y_la_anterior_no_cambia(client, ctx, db_session) -> None:
    producto_id = ctx["producto"]["id"]
    primera = crear_elaboracion(client, ctx["headers"], producto_id).json()
    formular(client, ctx["headers"], producto_id, ctx["harina"])

    segunda = crear_elaboracion(client, ctx["headers"], producto_id).json()

    assert (primera["version"]["numero_version"], segunda["version"]["numero_version"]) == (1, 2)
    assert _ingredientes(segunda) == [ctx["harina"]["id"]]
    assert _ingredientes(client.get(f"/gestion/elaboraciones/{primera['id']}", headers=ctx["headers"]).json()) == [
        ctx["harina"]["id"],
        ctx["leche"]["id"],
    ]
    assert _versiones(db_session, producto_id) == [(1, False, True), (2, True, True)]


def test_el_listado_muestra_la_version_de_cada_elaboracion(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]
    crear_elaboracion(client, ctx["headers"], producto_id, codigo="E-001")
    formular(client, ctx["headers"], producto_id, ctx["harina"])
    crear_elaboracion(client, ctx["headers"], producto_id, codigo="E-002")

    lista = client.get(f"/gestion/elaboraciones?producto_id={producto_id}", headers=ctx["headers"]).json()

    assert {item["codigo"]: item["version"]["numero_version"] for item in lista} == {"E-001": 1, "E-002": 2}
    assert {item["codigo"]: item["total_ingredientes"] for item in lista} == {"E-001": 2, "E-002": 1}


def test_un_producto_con_otra_formulacion_no_mezcla_las_versiones(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["leche"])

    de_otro = crear_elaboracion(client, ctx["headers"], otro["id"]).json()
    del_primero = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).json()

    assert _ingredientes(de_otro) == [ctx["leche"]["id"]]
    assert de_otro["version"]["id"] != del_primero["version"]["id"]
