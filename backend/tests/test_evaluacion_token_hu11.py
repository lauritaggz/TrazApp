"""Signed consultation token of HU11 (T11-01, D1): issuing, checking and the stored hash.

Pure unit tests: no database and no HTTP.
"""

import base64
import json
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.config import get_settings
from app.core.evaluacion_token import (
    LONGITUD_MAXIMA_TOKEN,
    VIGENCIA_TOKEN_EVALUACION,
    TokenEvaluacionInvalidoError,
    _clave,
    emitir_token,
    hash_nonce,
    verificar_token,
)
from app.core.security import create_access_token


def _claims_sin_verificar(token: str) -> dict:
    return jwt.decode(token, options={"verify_signature": False})


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def _desb64(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def test_el_token_emitido_se_verifica_y_trae_solo_los_claims_aprobados() -> None:
    token = emitir_token("PUB123", "E-001")

    firmada = verificar_token(token)

    assert (firmada.id_publico, firmada.codigo) == ("PUB123", "E-001")
    assert firmada.nonce
    claims = _claims_sin_verificar(token)
    assert set(claims) == {"aud", "pub", "cod", "n", "iat", "exp"}
    assert claims["exp"] - claims["iat"] == int(VIGENCIA_TOKEN_EVALUACION.total_seconds())


def test_dos_emisiones_del_mismo_par_tienen_nonce_distinto() -> None:
    a, b = emitir_token("PUB123", "E-001"), emitir_token("PUB123", "E-001")

    assert a != b
    assert verificar_token(a).nonce != verificar_token(b).nonce


def test_token_alterado_firma_de_otra_clave_y_jwt_de_sesion_son_invalidos() -> None:
    token = emitir_token("PUB123", "E-001")
    cabecera, carga, firma = token.split(".")
    claims = json.loads(_desb64(carga))
    claims["cod"] = "E-002"
    alterado = ".".join([cabecera, _b64(json.dumps(claims).encode()), firma])
    otra_clave = jwt.encode(_claims_sin_verificar(token), b"otra-clave", algorithm="HS256")
    sin_firma = jwt.encode(_claims_sin_verificar(token), None, algorithm="none")
    de_sesion = create_access_token("1")
    clave_del_jwt = jwt.encode(_claims_sin_verificar(token), get_settings().jwt_secret_key, algorithm="HS256")

    for invalido in (alterado, otra_clave, sin_firma, de_sesion, clave_del_jwt):
        with pytest.raises(TokenEvaluacionInvalidoError):
            verificar_token(invalido)


def test_token_vencido_es_invalido_y_a_23h59_es_valido() -> None:
    ahora = datetime.now(UTC)

    with pytest.raises(TokenEvaluacionInvalidoError):
        verificar_token(emitir_token("PUB123", "E-001", ahora=ahora - timedelta(hours=24, minutes=1)))
    assert verificar_token(emitir_token("PUB123", "E-001", ahora=ahora - timedelta(hours=23, minutes=59)))


def test_token_demasiado_largo_o_ilegible_es_invalido() -> None:
    for invalido in ("", "no-es-un-token", "a.b.c", "x" * (LONGITUD_MAXIMA_TOKEN + 1)):
        with pytest.raises(TokenEvaluacionInvalidoError):
            verificar_token(invalido)


def test_la_clave_derivada_no_es_la_del_jwt() -> None:
    assert _clave() != get_settings().jwt_secret_key.encode()


def test_el_hash_del_nonce_son_64_hex_y_no_contiene_el_nonce() -> None:
    nonce = verificar_token(emitir_token("PUB123", "E-001")).nonce

    resultado = hash_nonce(nonce)

    assert len(resultado) == 64 and set(resultado) <= set("0123456789abcdef")
    assert nonce not in resultado
    assert hash_nonce(nonce) == resultado
