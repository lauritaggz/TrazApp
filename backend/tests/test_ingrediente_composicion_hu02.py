"""Declared composition management tests (T02-04 / HU02)."""

from app.models import Ingrediente
from tests.test_gestion_ingredientes import (
    INGREDIENTE_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _register_and_login,
)


def _create_ingrediente(client, headers, payload: dict) -> dict:
    response = client.post("/gestion/ingredientes", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()


def _create_compuesto(client, headers, codigo: str, nombre: str) -> dict:
    return _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": codigo, "nombre": nombre, "tipo": "compuesto"},
    )


def _create_simple(client, headers, codigo: str, nombre: str) -> dict:
    return _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": codigo, "nombre": nombre, "tipo": "simple"},
    )


def _add_componente(
    client,
    headers,
    compuesto_id: int,
    componente_id: int,
    porcentaje: str = "50",
    orden: int | None = None,
) -> dict:
    payload: dict = {
        "ingrediente_componente_id": componente_id,
        "porcentaje": porcentaje,
    }
    if orden is not None:
        payload["orden"] = orden
    response = client.post(
        f"/gestion/ingredientes/{compuesto_id}/composicion",
        headers=headers,
        json=payload,
    )
    return response


def test_crear_composicion_valida(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-100", "Masa")
    harina = _create_simple(client, headers, "har-100", "Harina")
    agua = _create_simple(client, headers, "agua-100", "Agua")

    response_harina = _add_componente(
        client, headers, compuesto["id"], harina["id"], "60", orden=1
    )
    assert response_harina.status_code == 201
    body_harina = response_harina.json()
    assert body_harina["ingrediente_componente_id"] == harina["id"]
    assert body_harina["codigo_interno"] == "HAR-100"
    assert body_harina["nombre"] == "Harina"
    assert body_harina["tipo"] == "simple"
    assert body_harina["porcentaje"] == "60.000"
    assert body_harina["orden"] == 1

    response_agua = _add_componente(
        client, headers, compuesto["id"], agua["id"], "40", orden=2
    )
    assert response_agua.status_code == 201


def test_consultar_composicion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-101", "Masa consulta")
    harina = _create_simple(client, headers, "har-101", "Harina consulta")
    _add_componente(client, headers, compuesto["id"], harina["id"], "100", orden=1)

    response = client.get(
        f"/gestion/ingredientes/{compuesto['id']}/composicion",
        headers=headers,
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 1
    assert items[0]["ingrediente_componente_id"] == harina["id"]
    assert items[0]["porcentaje"] == "100.000"


def test_modificar_composicion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-102", "Masa update")
    harina = _create_simple(client, headers, "har-102", "Harina update")
    created = _add_componente(
        client, headers, compuesto["id"], harina["id"], "50", orden=1
    ).json()

    response = client.patch(
        f"/gestion/ingredientes/{compuesto['id']}/composicion/{created['id']}",
        headers=headers,
        json={"porcentaje": "75", "orden": 3},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["porcentaje"] == "75.000"
    assert body["orden"] == 3


def test_eliminar_componente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-103", "Masa delete")
    harina = _create_simple(client, headers, "har-103", "Harina delete")
    created = _add_componente(
        client, headers, compuesto["id"], harina["id"], "100"
    ).json()

    delete_response = client.delete(
        f"/gestion/ingredientes/{compuesto['id']}/composicion/{created['id']}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_response = client.get(
        f"/gestion/ingredientes/{compuesto['id']}/composicion",
        headers=headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_ingrediente_simple_rechaza_composicion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    simple = _create_simple(client, headers, "sim-104", "Solo simple")
    componente = _create_simple(client, headers, "har-104", "Harina simple")

    response = _add_componente(client, headers, simple["id"], componente["id"], "100")
    assert response.status_code == 422
    assert "compuestos" in response.json()["detail"]


def test_componente_inexistente_devuelve_error(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-105", "Masa inexistente")

    response = _add_componente(client, headers, compuesto["id"], 999999, "100")
    assert response.status_code == 404


def test_componente_de_otro_productor_devuelve_error(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    compuesto_a = _create_compuesto(client, headers_a, "mas-106", "Masa A")
    componente_b = _create_simple(client, headers_b, "har-106", "Harina B")

    response = _add_componente(
        client, headers_a, compuesto_a["id"], componente_b["id"], "100"
    )
    assert response.status_code == 404


def test_autorreferencia_devuelve_error(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-107", "Masa auto")

    response = _add_componente(client, headers, compuesto["id"], compuesto["id"], "100")
    assert response.status_code == 422
    assert "sí mismo" in response.json()["detail"]


def test_ciclo_composicion_directo_devuelve_error(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto_a = _create_compuesto(client, headers, "mas-108a", "Masa A ciclo")
    compuesto_b = _create_compuesto(client, headers, "mas-108b", "Masa B ciclo")

    assert _add_componente(
        client, headers, compuesto_a["id"], compuesto_b["id"], "100"
    ).status_code == 201

    response = _add_componente(
        client, headers, compuesto_b["id"], compuesto_a["id"], "100"
    )
    assert response.status_code == 422
    assert "ciclo" in response.json()["detail"]


def test_ciclo_composicion_indirecto_devuelve_error(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    a = _create_compuesto(client, headers, "mas-109a", "Nivel A")
    b = _create_compuesto(client, headers, "mas-109b", "Nivel B")
    c = _create_compuesto(client, headers, "mas-109c", "Nivel C")

    assert _add_componente(client, headers, a["id"], b["id"], "50").status_code == 201
    assert _add_componente(client, headers, b["id"], c["id"], "50").status_code == 201

    response = _add_componente(client, headers, c["id"], a["id"], "50")
    assert response.status_code == 422
    assert "ciclo" in response.json()["detail"]


def test_porcentaje_invalido_rechazado(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-110", "Masa porcentaje")
    harina = _create_simple(client, headers, "har-110", "Harina porcentaje")

    for invalid in ("0", "0.0", "100.1", "-5"):
        response = client.post(
            f"/gestion/ingredientes/{compuesto['id']}/composicion",
            headers=headers,
            json={
                "ingrediente_componente_id": harina["id"],
                "porcentaje": invalid,
            },
        )
        assert response.status_code == 422


def test_componente_duplicado_rechazado(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-111", "Masa duplicado")
    harina = _create_simple(client, headers, "har-111", "Harina duplicado")

    assert _add_componente(
        client, headers, compuesto["id"], harina["id"], "50"
    ).status_code == 201

    response = _add_componente(client, headers, compuesto["id"], harina["id"], "25")
    assert response.status_code == 422
    assert "composición" in response.json()["detail"].lower()


def test_componente_inactivo_rechazado(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_compuesto(client, headers, "mas-112", "Masa inactivo")
    harina = _create_simple(client, headers, "har-112", "Harina inactiva")

    ingrediente = db_session.get(Ingrediente, harina["id"])
    assert ingrediente is not None
    ingrediente.activo = False
    db_session.add(ingrediente)
    db_session.commit()

    response = _add_componente(
        client, headers, compuesto["id"], harina["id"], "100"
    )
    assert response.status_code == 404


def test_aislamiento_por_productor_en_composicion(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    compuesto_a = _create_compuesto(client, headers_a, "mas-113", "Masa privada")
    harina_a = _create_simple(client, headers_a, "har-113", "Harina privada")
    created = _add_componente(
        client, headers_a, compuesto_a["id"], harina_a["id"], "100"
    ).json()

    list_ajeno = client.get(
        f"/gestion/ingredientes/{compuesto_a['id']}/composicion",
        headers=headers_b,
    )
    assert list_ajeno.status_code == 404

    patch_ajeno = client.patch(
        f"/gestion/ingredientes/{compuesto_a['id']}/composicion/{created['id']}",
        headers=headers_b,
        json={"porcentaje": "50"},
    )
    assert patch_ajeno.status_code == 404

    delete_ajeno = client.delete(
        f"/gestion/ingredientes/{compuesto_a['id']}/composicion/{created['id']}",
        headers=headers_b,
    )
    assert delete_ajeno.status_code == 404


def test_rt01_sigue_funcionando_con_composicion_hu02(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    legacy = client.post("/ingredientes", json={"nombre": "Cacao RT01 comp"}).json()
    version = client.post(
        f"/ingredientes/{legacy['id']}/versiones",
        json={
            "composicion_declarada": "Cacao puro",
            "alergenos_declarados": "",
        },
    )
    assert version.status_code == 201

    compuesto = _create_compuesto(client, headers, "mas-114", "Masa RT01")
    harina = _create_simple(client, headers, "har-114", "Harina RT01")
    assert _add_componente(
        client, headers, compuesto["id"], harina["id"], "100"
    ).status_code == 201

    legacy_db = db_session.get(Ingrediente, legacy["id"])
    assert legacy_db is not None
    assert legacy_db.productor_id is None
    assert len(legacy_db.versiones) == 1

    hu02_version = client.post(
        f"/ingredientes/{compuesto['id']}/versiones",
        json={"composicion_declarada": "Intento", "alergenos_declarados": ""},
    )
    assert hu02_version.status_code == 404
