"""HU03 / T03-03: PUT /gestion/productos/{id}/formulacion API tests."""

import pytest
from sqlalchemy import select

from app.models import VersionProducto
from app.repositories.producto_formulacion_repository import ProductoFormulacionRepository
from tests.test_gestion_ingredientes import PRODUCTOR_A, PRODUCTOR_B, _auth_headers, _register_and_login
from tests.test_producto_formulacion_t02_09 import (
    _create_ingrediente,
    _create_producto,
    _formulacion_url,
    _marcar_usada,
)


def _url(producto_id: int) -> str:
    return f"/gestion/productos/{producto_id}/formulacion"


def _put(client, headers, producto_id: int, lineas: list[dict]):
    return client.put(_url(producto_id), headers=headers, json={"lineas": lineas})


def _versiones(db_session, producto_id: int) -> list[tuple[int, bool]]:
    db_session.expire_all()
    return [
        (v.numero_version, v.vigente)
        for v in db_session.scalars(
            select(VersionProducto)
            .where(VersionProducto.producto_id == producto_id)
            .order_by(VersionProducto.numero_version)
        )
    ]


@pytest.fixture
def ctx(client):
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    return {
        "headers": headers,
        "producto": producto,
        "harina": _create_ingrediente(client, headers, "har-put", "Harina"),
        "agua": _create_ingrediente(client, headers, "agua-put", "Agua"),
    }


def test_rechaza_sin_token(client, ctx) -> None:
    response = client.put(
        _url(ctx["producto"]["id"]),
        json={"lineas": [{"ingrediente_id": ctx["harina"]["id"]}]},
    )

    assert response.status_code == 401


def test_rechaza_token_invalido(client, ctx) -> None:
    response = _put(
        client,
        _auth_headers("token-invalido"),
        ctx["producto"]["id"],
        [{"ingrediente_id": ctx["harina"]["id"]}],
    )

    assert response.status_code == 401


def test_crea_v1(client, ctx, db_session) -> None:
    harina, agua = ctx["harina"], ctx["agua"]

    response = _put(
        client,
        ctx["headers"],
        ctx["producto"]["id"],
        [
            {"ingrediente_id": harina["id"], "cantidad": "500", "unidad": "g", "notas": " Tamizada "},
            {"ingrediente_id": agua["id"]},
        ],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["resultado"] == "version_creada"
    version = body["version"]
    assert version["producto_id"] == ctx["producto"]["id"]
    assert version["numero_version"] == 1
    assert version["descripcion"] == "Versión 1"
    assert version["vigente"] is True
    assert version["usada_en_elaboracion"] is False
    assert [
        (l["ingrediente_id"], l["ingrediente_nombre"], l["cantidad"], l["unidad"], l["orden"], l["notas"])
        for l in version["lineas"]
    ] == [
        (harina["id"], "Harina", "500.000", "g", 1, "Tamizada"),
        (agua["id"], "Agua", None, None, 2, None),
    ]
    assert _versiones(db_session, ctx["producto"]["id"]) == [(1, True)]


def test_modifica_en_el_lugar(client, ctx, db_session) -> None:
    producto_id = ctx["producto"]["id"]
    v1 = _put(client, ctx["headers"], producto_id, [{"ingrediente_id": ctx["harina"]["id"]}]).json()

    response = _put(
        client,
        ctx["headers"],
        producto_id,
        [{"ingrediente_id": ctx["agua"]["id"], "cantidad": "1", "unidad": "L"}],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["resultado"] == "modificada_en_lugar"
    assert body["version"]["id"] == v1["version"]["id"]
    assert [l["ingrediente_id"] for l in body["version"]["lineas"]] == [ctx["agua"]["id"]]
    assert _versiones(db_session, producto_id) == [(1, True)]


def test_crea_nueva_version_si_la_vigente_esta_usada(client, ctx, db_session) -> None:
    producto_id = ctx["producto"]["id"]
    v1 = _put(client, ctx["headers"], producto_id, [{"ingrediente_id": ctx["harina"]["id"]}]).json()
    _marcar_usada(db_session, v1["version"]["id"])

    response = _put(
        client,
        ctx["headers"],
        producto_id,
        [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "2", "unidad": "kg"}],
    )

    assert response.status_code == 200
    body = response.json()
    assert body["resultado"] == "nueva_version"
    assert body["version"]["numero_version"] == 2
    assert body["version"]["descripcion"] == "Versión 2"
    assert _versiones(db_session, producto_id) == [(1, False), (2, True)]
    anterior = client.get(
        _formulacion_url(producto_id, v1["version"]["id"]), headers=ctx["headers"]
    ).json()
    assert [(l["cantidad"], l["unidad"]) for l in anterior] == [(None, None)]


def test_contenido_identico_responde_sin_cambios(client, ctx, db_session) -> None:
    producto_id = ctx["producto"]["id"]
    lineas = [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "1", "unidad": "kg"}]
    v1 = _put(client, ctx["headers"], producto_id, lineas).json()
    _marcar_usada(db_session, v1["version"]["id"])

    response = _put(client, ctx["headers"], producto_id, lineas)

    assert response.status_code == 200
    assert response.json()["resultado"] == "sin_cambios"
    assert response.json()["version"]["id"] == v1["version"]["id"]
    assert _versiones(db_session, producto_id) == [(1, True)]


def test_producto_inexistente(client, ctx) -> None:
    response = _put(client, ctx["headers"], 999_999, [{"ingrediente_id": ctx["harina"]["id"]}])

    assert response.status_code == 404
    assert response.json()["detail"] == "Producto no encontrado"


def test_producto_ajeno(client, ctx, db_session) -> None:
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_b = _auth_headers(login_b["access_token"])
    harina_b = _create_ingrediente(client, headers_b, "har-b", "Harina B")

    response = _put(client, headers_b, ctx["producto"]["id"], [{"ingrediente_id": harina_b["id"]}])

    assert response.status_code == 404
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_ingrediente_inexistente(client, ctx, db_session) -> None:
    response = _put(client, ctx["headers"], ctx["producto"]["id"], [{"ingrediente_id": 999_999}])

    assert response.status_code == 422
    assert response.json()["detail"] == "Ingrediente no encontrado"
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_ingrediente_de_otro_productor(client, ctx, db_session) -> None:
    login_b = _register_and_login(client, PRODUCTOR_B)
    harina_b = _create_ingrediente(
        client, _auth_headers(login_b["access_token"]), "har-ajena", "Harina ajena"
    )

    response = _put(client, ctx["headers"], ctx["producto"]["id"], [{"ingrediente_id": harina_b["id"]}])

    assert response.status_code == 422
    assert response.json()["detail"] == "Ingrediente no encontrado"
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_ingrediente_inactivo(client, ctx, db_session) -> None:
    harina = ctx["harina"]
    assert client.delete(f"/gestion/ingredientes/{harina['id']}", headers=ctx["headers"]).status_code == 204

    response = _put(client, ctx["headers"], ctx["producto"]["id"], [{"ingrediente_id": harina["id"]}])

    assert response.status_code == 422
    assert response.json()["detail"] == "No se pueden usar ingredientes inactivos en la formulación."
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_ingrediente_repetido(client, ctx, db_session) -> None:
    harina_id = ctx["harina"]["id"]

    response = _put(
        client,
        ctx["headers"],
        ctx["producto"]["id"],
        [{"ingrediente_id": harina_id}, {"ingrediente_id": harina_id, "cantidad": "1", "unidad": "kg"}],
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Un ingrediente no puede repetirse en la formulación."
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_ingrediente_desactivado_en_la_vigente(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]
    harina, agua = ctx["harina"], ctx["agua"]
    v1 = _put(
        client, ctx["headers"], producto_id, [{"ingrediente_id": harina["id"]}, {"ingrediente_id": agua["id"]}]
    ).json()
    assert client.delete(f"/gestion/ingredientes/{harina['id']}", headers=ctx["headers"]).status_code == 204

    bloqueado = _put(
        client,
        ctx["headers"],
        producto_id,
        [{"ingrediente_id": harina["id"]}, {"ingrediente_id": agua["id"], "cantidad": "1", "unidad": "L"}],
    )

    assert bloqueado.status_code == 422
    assert bloqueado.json()["detail"] == (
        "El ingrediente «Harina» está desactivado. Quítelo de la formulación para poder guardar."
    )
    lineas = client.get(_formulacion_url(producto_id, v1["version"]["id"]), headers=ctx["headers"]).json()
    assert [l["ingrediente_id"] for l in lineas] == [harina["id"], agua["id"]]

    sin_harina = _put(client, ctx["headers"], producto_id, [{"ingrediente_id": agua["id"]}])
    assert sin_harina.status_code == 200
    assert sin_harina.json()["resultado"] == "modificada_en_lugar"


@pytest.mark.parametrize(
    "payload",
    [
        {"lineas": []},
        {"lineas": [{"ingrediente_id": 1, "cantidad": "5"}]},
        {"lineas": [{"ingrediente_id": 1, "unidad": "g"}]},
        {"lineas": [{"ingrediente_id": 1, "cantidad": "0", "unidad": "g"}]},
        {"lineas": [{"ingrediente_id": 1, "cantidad": "5", "unidad": "taza"}]},
        {"lineas": [{"ingrediente_id": 1, "porcentaje": "50"}]},
        {"lineas": [{"ingrediente_id": 1}], "version_id": 1},
        {},
    ],
)
def test_rechaza_payload_invalido(client, ctx, db_session, payload: dict) -> None:
    response = client.put(_url(ctx["producto"]["id"]), headers=ctx["headers"], json=payload)

    assert response.status_code == 422
    assert _versiones(db_session, ctx["producto"]["id"]) == []


def test_conflicto_de_numero_de_version(client, ctx, db_session, monkeypatch) -> None:
    producto_id = ctx["producto"]["id"]
    v1 = _put(client, ctx["headers"], producto_id, [{"ingrediente_id": ctx["harina"]["id"]}]).json()
    _marcar_usada(db_session, v1["version"]["id"])
    monkeypatch.setattr(ProductoFormulacionRepository, "next_numero_version", lambda self, _: 1)

    response = _put(
        client,
        ctx["headers"],
        producto_id,
        [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "1", "unidad": "kg"}],
    )

    assert response.status_code == 409
    assert "al mismo tiempo" in response.json()["detail"]
    assert _versiones(db_session, producto_id) == [(1, True)]
