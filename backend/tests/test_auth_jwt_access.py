"""Tests for JWT access control and private auth routes (T12-04)."""

from datetime import timedelta

from sqlalchemy import select

from app.core.security import create_access_token, decode_access_token
from app.models import Productor

REGISTER_PAYLOAD = {
    "nombre": "Productor Demo",
    "email": "jwt.productor@ejemplo.com",
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


def test_login_returns_bearer_access_token(client) -> None:
    body = _register_and_login(client)

    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert "password" not in body
    assert "password_hash" not in body
    assert "password" not in body["productor"]
    assert "password_hash" not in body["productor"]


def test_access_token_identifies_productor_and_has_expiration(client) -> None:
    body = _register_and_login(client)

    payload = decode_access_token(body["access_token"])
    assert payload["sub"] == str(body["productor"]["id"])
    assert "exp" in payload
    assert "iat" in payload


def test_auth_me_with_valid_token(client) -> None:
    body = _register_and_login(client)

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert response.status_code == 200
    me = response.json()
    assert me["id"] == body["productor"]["id"]
    assert me["email"] == REGISTER_PAYLOAD["email"]
    assert me["activo"] is True
    assert "password" not in me
    assert "password_hash" not in me


def test_auth_me_without_token_is_rejected(client) -> None:
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_auth_me_with_invalid_token_is_rejected(client) -> None:
    body = _register_and_login(client)
    tampered = body["access_token"][:-4] + "xxxx"

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {tampered}"},
    )

    assert response.status_code == 401


def test_auth_me_with_expired_token_is_rejected(client) -> None:
    body = _register_and_login(client)
    expired_token = create_access_token(
        subject=str(body["productor"]["id"]),
        expires_delta=timedelta(seconds=-1),
    )

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    assert response.status_code == 401


def test_auth_me_rejects_unknown_productor_in_token(client) -> None:
    token = create_access_token(subject="999999")

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 401


def test_auth_me_rejects_inactive_productor(client, db_session) -> None:
    body = _register_and_login(client)

    productor = db_session.scalar(
        select(Productor).where(Productor.email == REGISTER_PAYLOAD["email"])
    )
    assert productor is not None
    productor.activo = False
    db_session.commit()

    response = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {body['access_token']}"},
    )

    assert response.status_code == 401


def test_logout_is_stateless_client_discard_instruction(client) -> None:
    response = client.post("/auth/logout")

    assert response.status_code == 200
    message = response.json()["message"]
    assert "Descarte el access token" in message
    assert "no revoca" in message.lower() or "no mantiene sesiones" in message.lower()
