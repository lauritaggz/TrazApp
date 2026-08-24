"""Password hashing and JWT access-token utilities.

These helpers stay decoupled from HTTP endpoints so auth flows can reuse them.
Plaintext passwords must never be persisted or written to logs.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings


class TokenError(Exception):
    """Raised when an access token cannot be created or validated."""


def hash_password(plain_password: str) -> str:
    """Return a salted bcrypt hash for the given plaintext password."""
    password_bytes = plain_password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    """Return True when plaintext matches the stored bcrypt hash."""
    password_bytes = plain_password.encode("utf-8")
    hash_bytes = password_hash.encode("utf-8")
    return bcrypt.checkpw(password_bytes, hash_bytes)


def create_access_token(
    subject: str,
    *,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token for the given subject (productor id)."""
    settings = get_settings()
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)

    now = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(
        payload,
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """Decode and validate a JWT access token (signature and expiration)."""
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise TokenError("Token inválido o expirado") from exc
