"""Tests for authenticated producer profile updates (T12-08)."""

from sqlalchemy import select

from app.models import Productor

REGISTER_PAYLOAD = {
    "nombre": "Ana Perez",
    "nombre_negocio": "Panaderia La Espiga",
    "email": "perfil.productor@ejemplo.com",
    "password": "SecretoProductor123!",
}


def _register_and_login(client) -> dict:
    register_response = client.post("/auth/register", json=REGISTER_PAYLOAD)
    assert register_response.status_code == 201
    login_response = client.post(
        "/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )
    assert login_response.status_code == 200
    return login_response.json()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_register_stores_nombre_negocio(client, db_session) -> None:
    response = client.post("/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["nombre_negocio"] == REGISTER_PAYLOAD["nombre_negocio"]
    assert "password" not in body
    assert "password_hash" not in body

    productor = db_session.scalar(
        select(Productor).where(Productor.email == REGISTER_PAYLOAD["email"])
    )
    assert productor is not None
    assert productor.nombre_negocio == REGISTER_PAYLOAD["nombre_negocio"]


def test_me_returns_nombre_negocio(client) -> None:
    login_body = _register_and_login(client)

    response = client.get(
        "/auth/me",
        headers=_auth_headers(login_body["access_token"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre_negocio"] == REGISTER_PAYLOAD["nombre_negocio"]
    assert "password" not in body
    assert "password_hash" not in body


def test_authenticated_productor_can_update_nombre_and_negocio(
    client,
    db_session,
) -> None:
    login_body = _register_and_login(client)
    token = login_body["access_token"]
    original_id = login_body["productor"]["id"]
    original_email = login_body["productor"]["email"]

    productor_before = db_session.scalar(
        select(Productor).where(Productor.id == original_id)
    )
    assert productor_before is not None
    password_hash_before = productor_before.password_hash

    response = client.patch(
        "/auth/me",
        headers=_auth_headers(token),
        json={
            "nombre": "Ana Maria Perez",
            "nombre_negocio": "Espiga Artesanal",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == original_id
    assert body["email"] == original_email
    assert body["nombre"] == "Ana Maria Perez"
    assert body["nombre_negocio"] == "Espiga Artesanal"
    assert "password" not in body
    assert "password_hash" not in body

    db_session.expire_all()
    productor_after = db_session.scalar(
        select(Productor).where(Productor.id == original_id)
    )
    assert productor_after is not None
    assert productor_after.nombre == "Ana Maria Perez"
    assert productor_after.nombre_negocio == "Espiga Artesanal"
    assert productor_after.email == original_email
    assert productor_after.password_hash == password_hash_before


def test_update_profile_without_jwt_is_rejected(client) -> None:
    response = client.patch(
        "/auth/me",
        json={
            "nombre": "Nombre Nuevo",
            "nombre_negocio": "Negocio Nuevo",
        },
    )

    assert response.status_code == 401


def test_update_profile_with_invalid_jwt_is_rejected(client) -> None:
    response = client.patch(
        "/auth/me",
        headers=_auth_headers("token-invalido"),
        json={
            "nombre": "Nombre Nuevo",
            "nombre_negocio": "Negocio Nuevo",
        },
    )

    assert response.status_code == 401
