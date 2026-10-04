"""HU03 / T03-04: current formulation and version history query endpoints."""

import pytest

from tests.test_gestion_ingredientes import PRODUCTOR_B, _auth_headers, _register_and_login
from tests.test_gestion_formulacion_hu03 import _put, ctx  # noqa: F401  (fixture)
from tests.test_producto_formulacion_t02_09 import _formulacion_url, _marcar_usada


def _vigente_url(producto_id: int) -> str:
    return f"/gestion/productos/{producto_id}/formulacion"


def _versiones_url(producto_id: int) -> str:
    return f"/gestion/productos/{producto_id}/versiones"


def test_producto_sin_formulacion(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]

    vigente = client.get(_vigente_url(producto_id), headers=ctx["headers"])
    versiones = client.get(_versiones_url(producto_id), headers=ctx["headers"])

    assert vigente.status_code == 200
    assert vigente.json() == {"existe": False, "version": None}
    assert versiones.status_code == 200
    assert versiones.json() == []


def test_producto_con_una_version(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]
    harina, agua = ctx["harina"], ctx["agua"]
    guardada = _put(
        client,
        ctx["headers"],
        producto_id,
        [{"ingrediente_id": harina["id"], "cantidad": "500", "unidad": "g"}, {"ingrediente_id": agua["id"]}],
    ).json()["version"]

    vigente = client.get(_vigente_url(producto_id), headers=ctx["headers"])
    versiones = client.get(_versiones_url(producto_id), headers=ctx["headers"])

    assert vigente.status_code == 200
    body = vigente.json()
    assert body["existe"] is True
    assert body["version"] == guardada
    assert body["version"]["numero_version"] == 1
    assert [
        (l["ingrediente_nombre"], l["cantidad"], l["unidad"], l["orden"], l["ingrediente_desactivado"])
        for l in body["version"]["lineas"]
    ] == [("Harina", "500.000", "g", 1, False), ("Agua", None, None, 2, False)]

    assert versiones.status_code == 200
    (unica,) = versiones.json()
    assert unica == {
        "id": guardada["id"],
        "numero_version": 1,
        "descripcion": "Versión 1",
        "fecha_creacion": guardada["fecha_creacion"],
        "vigente": True,
        "usada_en_elaboracion": False,
        "cantidad_lineas": 2,
    }


def test_producto_con_varias_versiones(client, ctx, db_session) -> None:
    producto_id = ctx["producto"]["id"]
    harina, agua = ctx["harina"], ctx["agua"]
    v1 = _put(client, ctx["headers"], producto_id, [{"ingrediente_id": harina["id"]}]).json()["version"]
    _marcar_usada(db_session, v1["id"])
    v2 = _put(
        client, ctx["headers"], producto_id, [{"ingrediente_id": harina["id"]}, {"ingrediente_id": agua["id"]}]
    ).json()["version"]
    _marcar_usada(db_session, v2["id"])
    v3 = _put(
        client,
        ctx["headers"],
        producto_id,
        [
            {"ingrediente_id": agua["id"], "cantidad": "1", "unidad": "L"},
            {"ingrediente_id": harina["id"], "cantidad": "2", "unidad": "kg"},
        ],
    ).json()["version"]

    vigente = client.get(_vigente_url(producto_id), headers=ctx["headers"]).json()
    versiones = client.get(_versiones_url(producto_id), headers=ctx["headers"]).json()

    assert vigente["existe"] is True
    assert vigente["version"]["id"] == v3["id"]
    assert [
        (v["id"], v["numero_version"], v["descripcion"], v["vigente"], v["usada_en_elaboracion"], v["cantidad_lineas"])
        for v in versiones
    ] == [
        (v3["id"], 3, "Versión 3", True, False, 2),
        (v2["id"], 2, "Versión 2", False, True, 2),
        (v1["id"], 1, "Versión 1", False, True, 1),
    ]

    detalle_v1 = client.get(_formulacion_url(producto_id, v1["id"]), headers=ctx["headers"])
    assert detalle_v1.status_code == 200
    assert [l["ingrediente_id"] for l in detalle_v1.json()] == [harina["id"]]


def test_linea_indica_ingrediente_desactivado(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]
    harina, agua = ctx["harina"], ctx["agua"]
    version = _put(
        client, ctx["headers"], producto_id, [{"ingrediente_id": harina["id"]}, {"ingrediente_id": agua["id"]}]
    ).json()["version"]
    assert client.delete(f"/gestion/ingredientes/{harina['id']}", headers=ctx["headers"]).status_code == 204

    vigente = client.get(_vigente_url(producto_id), headers=ctx["headers"]).json()
    detalle = client.get(_formulacion_url(producto_id, version["id"]), headers=ctx["headers"]).json()

    esperado = [(harina["id"], True), (agua["id"], False)]
    assert [(l["ingrediente_id"], l["ingrediente_desactivado"]) for l in vigente["version"]["lineas"]] == esperado
    assert [(l["ingrediente_id"], l["ingrediente_desactivado"]) for l in detalle] == esperado


@pytest.mark.parametrize("url", [_vigente_url, _versiones_url])
def test_producto_ajeno(client, ctx, url) -> None:
    producto_id = ctx["producto"]["id"]
    _put(client, ctx["headers"], producto_id, [{"ingrediente_id": ctx["harina"]["id"]}])
    login_b = _register_and_login(client, PRODUCTOR_B)

    response = client.get(url(producto_id), headers=_auth_headers(login_b["access_token"]))

    assert response.status_code == 404
    assert response.json()["detail"] == "Producto no encontrado"


@pytest.mark.parametrize("url", [_vigente_url, _versiones_url])
def test_producto_inexistente(client, ctx, url) -> None:
    response = client.get(url(999_999), headers=ctx["headers"])

    assert response.status_code == 404


@pytest.mark.parametrize("url", [_vigente_url, _versiones_url])
@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer token-invalido"}])
def test_requiere_autenticacion(client, ctx, url, headers) -> None:
    response = client.get(url(ctx["producto"]["id"]), headers=headers)

    assert response.status_code == 401
