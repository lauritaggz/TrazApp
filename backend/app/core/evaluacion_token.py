"""Signed, single-use consultation token (HU11, D1).

The public `GET` hands one out with every ficha whose elaboración is "ok". Nothing is written when
it is issued. The `POST` of the answer sends it back: the server checks the signature and the expiry
and then stores only the SHA-256 of the nonce, under a unique constraint, so one consultation is
answered once. The payload is readable by the client (it is signed, not encrypted) and carries only
what is already public (`id_publico`, elaboración code) plus the random nonce.

The signing key is derived from `jwt_secret_key` with a fixed label, so a session JWT is never
valid here and the other way round, and no new secret has to be configured.

Every way of being invalid raises the same error: the caller cannot tell why (D3).
"""

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import get_settings

VIGENCIA_TOKEN_EVALUACION = timedelta(hours=24)
LONGITUD_MAXIMA_TOKEN = 1024
_AUDIENCIA = "trazapp:evaluacion"
_ETIQUETA_CLAVE = b"trazapp:evaluacion-utilidad:v1"
_ALGORITMO = "HS256"
_CLAIMS = ("pub", "cod", "n", "iat", "exp", "aud")


class TokenEvaluacionInvalidoError(Exception):
    """Altered, expired, signed with another key, of another kind, unreadable or too long."""


@dataclass(frozen=True)
class ConsultaFirmada:
    id_publico: str
    codigo: str
    nonce: str


def _clave() -> bytes:
    secreto = get_settings().jwt_secret_key.encode("utf-8")
    return hmac.new(secreto, _ETIQUETA_CLAVE, hashlib.sha256).digest()


def emitir_token(id_publico: str, codigo: str, ahora: datetime | None = None) -> str:
    """Pure function: no database, no write."""
    ahora = ahora or datetime.now(UTC)
    claims = {
        "aud": _AUDIENCIA,
        "pub": id_publico,
        "cod": codigo,
        "n": secrets.token_urlsafe(16),
        "iat": ahora,
        "exp": ahora + VIGENCIA_TOKEN_EVALUACION,
    }
    return jwt.encode(claims, _clave(), algorithm=_ALGORITMO)


def verificar_token(token: str) -> ConsultaFirmada:
    """Signature (constant-time, done by the library), audience and expiry; fixed algorithm."""
    if not isinstance(token, str) or not token or len(token) > LONGITUD_MAXIMA_TOKEN:
        raise TokenEvaluacionInvalidoError()
    try:
        claims = jwt.decode(
            token,
            _clave(),
            algorithms=[_ALGORITMO],
            audience=_AUDIENCIA,
            options={"require": list(_CLAIMS)},
        )
    except jwt.PyJWTError:
        raise TokenEvaluacionInvalidoError() from None
    pub, cod, nonce = claims["pub"], claims["cod"], claims["n"]
    if not all(isinstance(valor, str) and valor for valor in (pub, cod, nonce)):
        raise TokenEvaluacionInvalidoError()
    return ConsultaFirmada(id_publico=pub, codigo=cod, nonce=nonce)


def hash_nonce(nonce: str) -> str:
    """What is stored: 64 hex characters. The nonce itself never reaches the database."""
    return hashlib.sha256(nonce.encode("utf-8")).hexdigest()
