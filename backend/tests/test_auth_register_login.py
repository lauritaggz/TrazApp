"""Tests for producer registration and credential validation (T12-03)."""

from sqlalchemy import select

from app.core.security import verify_password
from app.models import Productor

REGISTER_PAYLOAD = {
    "nombre": "Productor Demo",
    "email": "productor@ejemplo.com",
    "password": "SecretoProductor123!",
}


def test_register_creates_productor(client) -> None:
    response = client.post("/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["nombre"] == REGISTER_PAYLOAD["nombre"]
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert body["activo"] is True
    assert "created_at" in body


def test_register_stores_password_hash_not_plaintext(client, db_session) -> None:
    response = client.post("/auth/register", json=REGISTER_PAYLOAD)
    assert response.status_code == 201

    productor = db_session.scalar(
        select(Productor).where(Productor.email == REGISTER_PAYLOAD["email"])
    )
    assert productor is not None
    assert productor.password_hash != REGISTER_PAYLOAD["password"]
    assert REGISTER_PAYLOAD["password"] not in productor.password_hash
    assert verify_password(REGISTER_PAYLOAD["password"], productor.password_hash)


def test_register_response_excludes_password_hash(client) -> None:
    response = client.post("/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201
    body = response.json()
    assert "password" not in body
    assert "password_hash" not in body


def test_register_rejects_duplicate_email(client) -> None:
    first = client.post("/auth/register", json=REGISTER_PAYLOAD)
    assert first.status_code == 201

    duplicate = client.post(
        "/auth/register",
        json={
            "nombre": "Otro Productor",
            "email": "Productor@Ejemplo.com",
            "password": "OtraClaveSegura99!",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "El correo ya está registrado"


def test_register_rejects_invalid_payload(client) -> None:
    response = client.post(
        "/auth/register",
        json={
            "nombre": "",
            "email": "no-es-un-email",
            "password": "corta",
        },
    )

    assert response.status_code == 422


def test_login_accepts_valid_credentials(client) -> None:
    client.post("/auth/register", json=REGISTER_PAYLOAD)

    response = client.post(
        "/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["message"] == "Autenticación satisfactoria"
    assert body["productor"]["email"] == REGISTER_PAYLOAD["email"]
    assert "password" not in body
    assert "password_hash" not in body
    assert "password" not in body["productor"]
    assert "password_hash" not in body["productor"]
    assert "access_token" not in body
    assert "token" not in body


def test_login_rejects_incorrect_password(client) -> None:
    client.post("/auth/register", json=REGISTER_PAYLOAD)

    response = client.post(
        "/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": "ClaveIncorrecta999!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"


def test_login_rejects_unknown_productor(client) -> None:
    response = client.post(
        "/auth/login",
        json={
            "email": "inexistente@ejemplo.com",
            "password": "SecretoProductor123!",
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"


def test_login_rejects_inactive_productor(client, db_session) -> None:
    client.post("/auth/register", json=REGISTER_PAYLOAD)

    productor = db_session.scalar(
        select(Productor).where(Productor.email == REGISTER_PAYLOAD["email"])
    )
    assert productor is not None
    productor.activo = False
    db_session.commit()

    response = client.post(
        "/auth/login",
        json={
            "email": REGISTER_PAYLOAD["email"],
            "password": REGISTER_PAYLOAD["password"],
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Credenciales inválidas"
