"""Ingredient type business rules tests (T02-03 / HU02)."""

from decimal import Decimal

from app.models import ComposicionIngrediente, Ingrediente
from tests.test_gestion_ingredientes import (
    INGREDIENTE_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _register_and_login,
)


def _create_ingrediente(client, headers, payload: dict | None = None) -> dict:
    response = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=payload or INGREDIENTE_BASE,
    )
    assert response.status_code == 201
    return response.json()


def test_crear_ingrediente_simple_correctamente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = _create_ingrediente(
        client,
        headers,
        {
            **INGREDIENTE_BASE,
            "codigo_interno": "azu-001",
            "nombre": "Azúcar",
            "tipo": "simple",
        },
    )

    assert created["tipo"] == "simple"
    assert created["nombre"] == "Azúcar"


def test_crear_ingrediente_compuesto_correctamente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = _create_ingrediente(
        client,
        headers,
        {
            **INGREDIENTE_BASE,
            "codigo_interno": "mas-001",
            "nombre": "Masa base",
            "tipo": "compuesto",
        },
    )

    assert created["tipo"] == "compuesto"
    assert created["nombre"] == "Masa base"


def test_creacion_rechaza_tipo_invalido(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login["access_token"]),
        json={**INGREDIENTE_BASE, "tipo": "mezcla"},
    )

    assert response.status_code == 422


def test_actualizar_de_simple_a_compuesto(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = _create_ingrediente(client, headers)

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
        json={"tipo": "compuesto"},
    )

    assert response.status_code == 200
    assert response.json()["tipo"] == "compuesto"


def test_actualizar_de_compuesto_a_simple_sin_componentes(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "mas-002", "tipo": "compuesto"},
    )

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
        json={"tipo": "simple"},
    )

    assert response.status_code == 200
    assert response.json()["tipo"] == "simple"


def test_actualizar_de_compuesto_a_simple_con_componentes_devuelve_422(
    client,
    db_session,
) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    compuesto = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "mas-003", "tipo": "compuesto"},
    )
    componente = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "har-003", "nombre": "Harina"},
    )

    db_session.add(
        ComposicionIngrediente(
            ingrediente_compuesto_id=compuesto["id"],
            ingrediente_componente_id=componente["id"],
            porcentaje=Decimal("100.000"),
        )
    )
    db_session.commit()

    response = client.patch(
        f"/gestion/ingredientes/{compuesto['id']}",
        headers=headers,
        json={"tipo": "simple"},
    )

    assert response.status_code == 422
    assert "componentes asociados" in response.json()["detail"]


def test_tipo_ajeno_no_afecta_ingredientes_de_otro_productor(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    created_a = _create_ingrediente(
        client,
        headers_a,
        {**INGREDIENTE_BASE, "codigo_interno": "har-a", "tipo": "simple"},
    )
    created_b = _create_ingrediente(
        client,
        headers_b,
        {**INGREDIENTE_BASE, "codigo_interno": "har-b", "tipo": "compuesto"},
    )

    patch_b = client.patch(
        f"/gestion/ingredientes/{created_b['id']}",
        headers=headers_b,
        json={"tipo": "simple"},
    )
    assert patch_b.status_code == 200

    detail_a = client.get(
        f"/gestion/ingredientes/{created_a['id']}",
        headers=headers_a,
    )
    assert detail_a.status_code == 200
    assert detail_a.json()["tipo"] == "simple"

    patch_ajeno = client.patch(
        f"/gestion/ingredientes/{created_a['id']}",
        headers=headers_b,
        json={"tipo": "compuesto"},
    )
    assert patch_ajeno.status_code == 404


def test_rt01_sigue_funcionando_con_ingredientes_legacy(client) -> None:
    legacy = client.post("/ingredientes", json={"nombre": "Chocolate RT01"}).json()
    assert legacy["activo"] is True

    version = client.post(
        f"/ingredientes/{legacy['id']}/versiones",
        json={
            "composicion_declarada": "Cacao, azúcar",
            "alergenos_declarados": "Leche",
        },
    )
    assert version.status_code == 201
    assert version.json()["numero_version"] == 1


def test_ingrediente_hu02_no_interfiere_con_rt01_legacy(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    legacy = Ingrediente(nombre="Mantequilla legacy", activo=True)
    db_session.add(legacy)
    db_session.commit()
    db_session.refresh(legacy)

    created = _create_ingrediente(
        client,
        headers,
        {**INGREDIENTE_BASE, "codigo_interno": "man-001", "tipo": "simple"},
    )

    legacy_version = client.post(
        f"/ingredientes/{legacy.id}/versiones",
        json={"composicion_declarada": "Leche", "alergenos_declarados": "Leche"},
    )
    assert legacy_version.status_code == 201

    owned_version = client.post(
        f"/ingredientes/{created['id']}/versiones",
        json={"composicion_declarada": "Intento", "alergenos_declarados": ""},
    )
    assert owned_version.status_code == 404
