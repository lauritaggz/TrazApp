"""Ingredient allergen association tests (T02-05 / HU02)."""

from app.models import Alergeno, Ingrediente
from tests.test_gestion_ingredientes import (
    INGREDIENTE_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _register_and_login,
)


def _seed_alergeno(db_session, codigo: str, nombre: str) -> Alergeno:
    alergeno = Alergeno(codigo=codigo, nombre=nombre)
    db_session.add(alergeno)
    db_session.commit()
    db_session.refresh(alergeno)
    return alergeno


def _create_ingrediente(client, headers, payload: dict) -> dict:
    response = client.post("/gestion/ingredientes", headers=headers, json=payload)
    assert response.status_code == 201
    return response.json()


def _add_alergeno(client, headers, ingrediente_id: int, alergeno_id: int):
    return client.post(
        f"/gestion/ingredientes/{ingrediente_id}/alergenos",
        headers=headers,
        json={"alergeno_id": alergeno_id},
    )


def test_listar_alergenos_asociados(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten", "Gluten")
    lacteos = _seed_alergeno(db_session, "lacteos", "Lácteos")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-200", "nombre": "Galleta"},
    )

    assert _add_alergeno(client, headers, ingrediente["id"], gluten.id).status_code == 201
    assert _add_alergeno(client, headers, ingrediente["id"], lacteos.id).status_code == 201

    response = client.get(
        f"/gestion/ingredientes/{ingrediente['id']}/alergenos",
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    assert {item["codigo"] for item in body} == {"gluten", "lacteos"}
    assert body[0]["codigo"] == "gluten"
    assert body[1]["codigo"] == "lacteos"


def test_agregar_alergeno_valido(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_add", "Gluten add")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-201", "nombre": "Galleta add"},
    )

    response = _add_alergeno(client, headers, ingrediente["id"], gluten.id)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == gluten.id
    assert body["codigo"] == "gluten_add"
    assert body["nombre"] == "Gluten add"


def test_eliminar_asociacion_alergeno(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_del", "Gluten del")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-202", "nombre": "Galleta del"},
    )
    assert _add_alergeno(client, headers, ingrediente["id"], gluten.id).status_code == 201

    delete_response = client.delete(
        f"/gestion/ingredientes/{ingrediente['id']}/alergenos/{gluten.id}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_response = client.get(
        f"/gestion/ingredientes/{ingrediente['id']}/alergenos",
        headers=headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_rechazar_alergeno_inexistente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-203", "nombre": "Galleta sin alergeno"},
    )

    response = _add_alergeno(client, headers, ingrediente["id"], 999999)
    assert response.status_code == 404


def test_rechazar_asociacion_duplicada(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_dup", "Gluten dup")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-204", "nombre": "Galleta dup"},
    )

    assert _add_alergeno(client, headers, ingrediente["id"], gluten.id).status_code == 201
    response = _add_alergeno(client, headers, ingrediente["id"], gluten.id)
    assert response.status_code == 422
    assert "asociado" in response.json()["detail"].lower()


def test_ingrediente_ajeno_devuelve_404(client, db_session) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_ajeno", "Gluten ajeno")
    ingrediente_a = _create_ingrediente(
        client,
        headers_a,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-a", "nombre": "Galleta A"},
    )

    list_ajeno = client.get(
        f"/gestion/ingredientes/{ingrediente_a['id']}/alergenos",
        headers=headers_b,
    )
    assert list_ajeno.status_code == 404

    add_ajeno = _add_alergeno(client, headers_b, ingrediente_a["id"], gluten.id)
    assert add_ajeno.status_code == 404

    delete_ajeno = client.delete(
        f"/gestion/ingredientes/{ingrediente_a['id']}/alergenos/{gluten.id}",
        headers=headers_b,
    )
    assert delete_ajeno.status_code == 404


def test_ingrediente_inactivo_devuelve_error(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_inact", "Gluten inact")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-205", "nombre": "Galleta inact"},
    )

    stored = db_session.get(Ingrediente, ingrediente["id"])
    assert stored is not None
    stored.activo = False
    db_session.add(stored)
    db_session.commit()

    list_response = client.get(
        f"/gestion/ingredientes/{ingrediente['id']}/alergenos",
        headers=headers,
    )
    assert list_response.status_code == 404

    add_response = _add_alergeno(client, headers, ingrediente["id"], gluten.id)
    assert add_response.status_code == 404


def test_aislamiento_entre_productores(client, db_session) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_iso", "Gluten iso")
    ingrediente_a = _create_ingrediente(
        client,
        headers_a,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-iso-a", "nombre": "Galleta iso A"},
    )
    ingrediente_b = _create_ingrediente(
        client,
        headers_b,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-iso-b", "nombre": "Galleta iso B"},
    )

    assert _add_alergeno(client, headers_a, ingrediente_a["id"], gluten.id).status_code == 201
    assert _add_alergeno(client, headers_b, ingrediente_b["id"], gluten.id).status_code == 201

    list_a = client.get(
        f"/gestion/ingredientes/{ingrediente_a['id']}/alergenos",
        headers=headers_a,
    )
    list_b = client.get(
        f"/gestion/ingredientes/{ingrediente_b['id']}/alergenos",
        headers=headers_b,
    )

    assert list_a.status_code == 200
    assert list_b.status_code == 200
    assert len(list_a.json()) == 1
    assert len(list_b.json()) == 1
    assert list_a.json()[0]["id"] == gluten.id
    assert list_b.json()[0]["id"] == gluten.id


def test_eliminar_asociacion_inexistente_devuelve_404(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_no_assoc", "Gluten no assoc")
    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "gal-206", "nombre": "Galleta no assoc"},
    )

    response = client.delete(
        f"/gestion/ingredientes/{ingrediente['id']}/alergenos/{gluten.id}",
        headers=headers,
    )
    assert response.status_code == 404


def test_rt01_sigue_funcionando_con_alergenos_hu02(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    gluten = _seed_alergeno(db_session, "gluten_rt01", "Gluten RT01")
    legacy = client.post("/ingredientes", json={"nombre": "Chocolate RT01 alerg"}).json()
    version = client.post(
        f"/ingredientes/{legacy['id']}/versiones",
        json={
            "composicion_declarada": "Cacao",
            "alergenos_declarados": "Leche",
        },
    )
    assert version.status_code == 201

    ingrediente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "cho-hu02", "nombre": "Chocolate HU02"},
    )
    assert _add_alergeno(client, headers, ingrediente["id"], gluten.id).status_code == 201

    legacy_db = db_session.get(Ingrediente, legacy["id"])
    assert legacy_db is not None
    assert legacy_db.productor_id is None
    assert len(legacy_db.versiones) == 1
    assert len(legacy_db.alergenos) == 0

    hu02_version = client.post(
        f"/ingredientes/{ingrediente['id']}/versiones",
        json={"composicion_declarada": "Intento", "alergenos_declarados": ""},
    )
    assert hu02_version.status_code == 404
