"""Anonymous evaluation of the usefulness of a consultation (T11-01 / HU11).

POST /publico/productos/{id_publico}/evaluaciones and the `token_evaluacion` of the public ficha.
Covers PT11-02, PT11-03, PT11-04 and PT11-05 (API part) and the extra scenarios: one answer per
token, one 422 for every kind of unusable token, uniform 404, the GET that writes nothing, the token
only for an "ok" state and never in the preview, an ignored productor token and the exact columns of
the table (nothing that identifies who answers). The fixtures are the ones of test_consulta_publica_hu10.
"""

import base64
import json
import logging
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from sqlalchemy import inspect, select

from app.core.evaluacion_token import emitir_token, hash_nonce, verificar_token
from app.core.security import create_access_token
from app.models import Elaboracion, EvaluacionUtilidad
from app.repositories.evaluacion_repository import EvaluacionRepository
from tests.escenario_hu05 import crear_producto, formular
from tests.test_consulta_codigo_hu13 import _sentencias_de_escritura
from tests.test_consulta_publica_hu10 import (  # noqa: F401  (fixtures used by name)
    CABECERAS,
    CONSULTAS_MAXIMAS,
    MENSAJE_NO_DISPONIBLE,
    _contar_consultas,
    _dia,
    _ficha,
    _finalizar,
    _ocultar,
    _publicar,
    ctx,
    publicado,
    varias_elaboraciones,
)
from tests.test_vista_publica_gestion_hu10 import _previa, sin_publicar  # noqa: F401

COLUMNAS_APROBADAS = {"id", "producto_id", "elaboracion_id", "util", "nonce_hash", "fecha"}
MENSAJE_422 = {"detail": {"mensaje": "El enlace para evaluar no es válido o venció. Vuelve a abrir la ficha."}}
MENSAJE_409 = {"detail": {"mensaje": "Esta consulta ya fue evaluada."}}
AGENTE = "AgenteSecreto/9.9"
IP = "203.0.113.77"


def _token(client, id_publico: str, **params) -> str:
    respuesta = _ficha(client, id_publico, **params)
    assert respuesta.status_code == 200, respuesta.text
    token = respuesta.json()["token_evaluacion"]
    assert isinstance(token, str)
    return token


def _evaluar(client, id_publico: str, token, util=True, headers: dict | None = None, **extra):
    return client.post(
        f"/publico/productos/{id_publico}/evaluaciones",
        headers=headers or {},
        json={"token": token, "util": util, **extra},
    )


def _filas(db_session) -> list[EvaluacionUtilidad]:
    db_session.expire_all()
    return list(db_session.scalars(select(EvaluacionUtilidad).order_by(EvaluacionUtilidad.id)))


def _forma(respuesta) -> tuple:
    return (
        respuesta.status_code,
        respuesta.content,
        respuesta.headers.get("cache-control"),
        respuesta.headers.get("x-robots-tag"),
    )


def _b64(datos: bytes) -> str:
    return base64.urlsafe_b64encode(datos).rstrip(b"=").decode()


def _segundo_producto(client, ctx) -> str:
    """Another published product of the same productor with one finalized elaboración (G-001)."""
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    _finalizar(client, ctx, "G-001", producto_id=otro["id"])
    return _publicar(client, ctx, otro["id"])


# --- PT11-02 a PT11-05 -----------------------------------------------------------------------------


def test_pt11_02_si_y_no_en_consultas_distintas_se_registran_ambas(client, publicado, db_session) -> None:
    id_publico = publicado["id_publico"]
    primera, segunda = _token(client, id_publico), _token(client, id_publico)

    assert _evaluar(client, id_publico, primera, True).status_code == 201
    assert _evaluar(client, id_publico, segunda, False).status_code == 201

    filas = _filas(db_session)
    assert [f.util for f in filas] == [True, False]
    assert {(f.producto_id, f.elaboracion_id) for f in filas} == {(publicado["producto"]["id"], publicado["elaboracion_id"])}


def test_pt11_03_responder_sin_sesion_devuelve_201(client, publicado, db_session) -> None:
    respuesta = _evaluar(client, publicado["id_publico"], _token(client, publicado["id_publico"]))

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json() == {"registrada": True}
    assert len(_filas(db_session)) == 1


def test_pt11_04_el_mismo_token_dos_veces_da_409_y_una_sola_fila(client, publicado, db_session) -> None:
    token = _token(client, publicado["id_publico"])

    primera = _evaluar(client, publicado["id_publico"], token, True)
    segunda = _evaluar(client, publicado["id_publico"], token, False)

    assert primera.status_code == 201
    assert (segunda.status_code, segunda.json()) == (409, MENSAJE_409)
    filas = _filas(db_session)
    assert [f.util for f in filas] == [True]  # the second answer did not replace the first one


def test_pt11_05_la_fila_tiene_producto_elaboracion_y_respuesta(client, publicado, db_session) -> None:
    token = _token(client, publicado["id_publico"])
    assert _evaluar(client, publicado["id_publico"], token, False).status_code == 201

    (fila,) = _filas(db_session)

    assert (fila.producto_id, fila.elaboracion_id, fila.util) == (
        publicado["producto"]["id"],
        publicado["elaboracion_id"],
        False,
    )
    assert fila.nonce_hash == hash_nonce(verificar_token(token).nonce)
    assert fila.fecha is not None


def test_el_par_producto_elaboracion_es_coherente_con_dos_productos(client, publicado, db_session) -> None:
    otro_publico = _segundo_producto(client, publicado)
    for id_publico in (publicado["id_publico"], otro_publico):
        assert _evaluar(client, id_publico, _token(client, id_publico)).status_code == 201

    filas = _filas(db_session)
    assert len(filas) == 2
    for fila in filas:
        assert db_session.get(Elaboracion, fila.elaboracion_id).producto_id == fila.producto_id
    assert len({f.producto_id for f in filas}) == 2


def test_la_eleccion_de_otra_elaboracion_queda_asociada_a_esa_elaboracion(client, varias_elaboraciones, db_session) -> None:
    ctx = varias_elaboraciones
    token = _token(client, ctx["id_publico"], codigo="e-002")  # normalised comparison

    assert _evaluar(client, ctx["id_publico"], token).status_code == 201

    (fila,) = _filas(db_session)
    assert fila.elaboracion_id == ctx["ids"]["E-002"]


# --- Anonymity (CA3, CA6) --------------------------------------------------------------------------


def test_el_conjunto_exacto_de_columnas_no_tiene_ip_user_agent_ni_token(db_engine) -> None:
    columnas = {c["name"] for c in inspect(db_engine).get_columns("evaluaciones_utilidad")}

    assert columnas == COLUMNAS_APROBADAS


def test_con_ip_user_agent_y_token_de_productor_la_fila_no_guarda_rastro(client, publicado, db_session) -> None:
    token = _token(client, publicado["id_publico"])
    nonce = verificar_token(token).nonce
    headers = {**publicado["headers"], "User-Agent": AGENTE, "X-Forwarded-For": IP, "Cookie": "sesion=abc123"}

    respuesta = _evaluar(client, publicado["id_publico"], token, True, headers=headers)

    assert respuesta.status_code == 201, respuesta.text
    (fila,) = _filas(db_session)
    volcado = " ".join(str(getattr(fila, c)) for c in COLUMNAS_APROBADAS)
    for rastro in (AGENTE, IP, "abc123", token, nonce, publicado["headers"]["Authorization"]):
        assert rastro not in volcado
    assert fila.nonce_hash != nonce and len(fila.nonce_hash) == 64


def test_no_se_registra_token_nonce_ni_user_agent_en_los_logs(client, publicado, caplog) -> None:
    token = _token(client, publicado["id_publico"])
    nonce = verificar_token(token).nonce
    caplog.set_level(logging.DEBUG)

    _evaluar(client, publicado["id_publico"], token, True, headers={"User-Agent": AGENTE, "X-Forwarded-For": IP})
    _evaluar(client, publicado["id_publico"], token, True, headers={"User-Agent": AGENTE})  # 409

    for secreto in (token, nonce, AGENTE, IP, hash_nonce(nonce)):
        assert secreto not in caplog.text


def test_el_registro_de_acceso_de_uvicorn_omite_el_endpoint_de_evaluacion() -> None:
    import app.main  # noqa: F401  (installs the filter)

    filtro = logging.getLogger("uvicorn.access").filters
    assert filtro, "falta el filtro del registro de acceso"

    def linea(ruta: str) -> logging.LogRecord:
        return logging.LogRecord(
            "uvicorn.access", logging.INFO, "", 0, '%s - "%s %s HTTP/1.1" %d', (IP, "POST", ruta, 201), None
        )

    assert not all(f.filter(linea("/publico/productos/ABC/evaluaciones")) for f in filtro)
    assert all(f.filter(linea("/publico/productos/ABC")) for f in filtro)


# --- Unusable tokens: a single 422 -----------------------------------------------------------------


def _tokens_inutilizables(client, publicado) -> dict:
    id_publico = publicado["id_publico"]
    token = _token(client, id_publico)
    cabecera, carga, firma = token.split(".")
    claims = json.loads(base64.urlsafe_b64decode(carga + "=" * (-len(carga) % 4)))
    claims["cod"] = "E-002"  # another elaboración, with the original signature
    otro_publico = _segundo_producto(client, publicado)
    return {
        "alterado": ".".join([cabecera, _b64(json.dumps(claims).encode()), firma]),
        "vencido": emitir_token(id_publico, "E-001", ahora=datetime.now(UTC) - timedelta(hours=25)),
        "de otro producto": _token(client, otro_publico),
        "firmado con otra clave": jwt.encode(jwt.decode(token, options={"verify_signature": False}), b"otra-clave-de-prueba-0123456789", algorithm="HS256"),
        "jwt de sesion": create_access_token("1"),
        "basura": "no-es-un-token",
        "vacio": "",
        "demasiado largo": "x" * 5000,
    }


def test_token_alterado_vencido_y_de_otro_producto_dan_el_mismo_422_byte_a_byte(client, publicado, db_session) -> None:
    casos = _tokens_inutilizables(client, publicado)

    formas = {nombre: _forma(_evaluar(client, publicado["id_publico"], token)) for nombre, token in casos.items()}

    esperada = _forma(_evaluar(client, publicado["id_publico"], "no-es-un-token"))
    assert esperada[0] == 422 and json.loads(esperada[1]) == MENSAJE_422
    assert esperada[2:] == (CABECERAS["cache-control"], CABECERAS["x-robots-tag"])
    assert formas == {nombre: esperada for nombre in casos}
    assert _filas(db_session) == []


def test_un_token_para_un_producto_que_no_existe_da_el_mismo_422_que_para_uno_que_si(client, publicado) -> None:
    token = _token(client, publicado["id_publico"])

    en_otra_ruta = _evaluar(client, "ZZZZZZZZZZZZZZZZZZZZZZ", token)

    assert _forma(en_otra_ruta) == _forma(_evaluar(client, publicado["id_publico"], "no-es-un-token"))


def test_util_no_booleano_campo_extra_o_sin_token_da_422_sin_registrar(client, publicado, db_session) -> None:
    id_publico = publicado["id_publico"]
    token = _token(client, id_publico)
    ruta = f"/publico/productos/{id_publico}/evaluaciones"

    for util in ("si", "true", 1, 0, None):
        assert _evaluar(client, id_publico, token, util).status_code == 422, util
    assert _evaluar(client, id_publico, token, True, ip="1.2.3.4").status_code == 422
    assert _evaluar(client, id_publico, token, True, user_agent="x").status_code == 422
    assert client.post(ruta, json={"util": True}).status_code == 422
    assert client.post(ruta, json={"token": token}).status_code == 422
    assert _filas(db_session) == []
    assert _evaluar(client, id_publico, token, True).status_code == 201  # the token was not burnt


# --- Uniform 404 -----------------------------------------------------------------------------------


def test_elaboracion_ocultada_despues_de_emitir_el_token_da_404_uniforme(client, publicado, db_session) -> None:
    token = _token(client, publicado["id_publico"])
    _ocultar(client, publicado, publicado["elaboracion_id"])

    respuesta = _evaluar(client, publicado["id_publico"], token)

    assert (respuesta.status_code, respuesta.json()) == (404, MENSAJE_NO_DISPONIBLE)
    assert _filas(db_session) == []


def test_producto_despublicado_o_eliminado_despues_de_emitir_da_404_uniforme_igual_al_get(client, publicado, db_session) -> None:
    otro_publico = _segundo_producto(client, publicado)
    token_a, token_b = _token(client, publicado["id_publico"]), _token(client, otro_publico)
    producto_b = next(p for p in client.get("/gestion/productos", headers=publicado["headers"]).json() if p["id_publico"] == otro_publico)
    assert client.delete(f"/gestion/productos/{publicado['producto']['id']}/publicacion", headers=publicado["headers"]).status_code == 200
    assert client.delete(f"/gestion/productos/{producto_b['id']}", headers=publicado["headers"]).status_code == 204

    despublicado = _evaluar(client, publicado["id_publico"], token_a)
    eliminado = _evaluar(client, otro_publico, token_b)

    get_404 = _ficha(client, publicado["id_publico"])
    assert _forma(despublicado) == _forma(eliminado) == _forma(get_404)
    assert despublicado.json() == MENSAJE_NO_DISPONIBLE
    assert _filas(db_session) == []


# --- The GET writes nothing and issues the token only for "ok" -------------------------------------


def test_el_get_de_la_ficha_no_escribe_en_la_base(client, publicado, db_session) -> None:
    antes = len(_filas(db_session))
    with _sentencias_de_escritura(db_session.get_bind()) as escrituras:
        assert _ficha(client, publicado["id_publico"]).status_code == 200
        assert _ficha(client, publicado["id_publico"], codigo="NO-EXISTE").status_code == 200

    assert escrituras == []
    assert len(_filas(db_session)) == antes


def test_el_get_con_token_no_supera_consultas_maximas(client, publicado, db_session) -> None:
    assert _contar_consultas(client, db_session, publicado["id_publico"]) <= CONSULTAS_MAXIMAS


def test_token_solo_con_estado_ok_y_null_en_los_otros_estados(client, varias_elaboraciones, db_session) -> None:
    ctx = varias_elaboraciones
    ok = _ficha(client, ctx["id_publico"]).json()
    no_disponible = _ficha(client, ctx["id_publico"], codigo="NO-EXISTE").json()
    _finalizar(client, ctx, "E-006", dias=3)  # same day as E-002: "varias"
    varias = _ficha(client, ctx["id_publico"], fecha=_dia(3)).json()

    assert ok["estado_elaboracion"] == "ok" and isinstance(ok["token_evaluacion"], str)
    assert no_disponible["estado_elaboracion"] == "no_disponible" and no_disponible["token_evaluacion"] is None
    assert varias["estado_elaboracion"] == "varias" and varias["token_evaluacion"] is None


def test_sin_elaboraciones_visibles_el_token_es_null(client, publicado) -> None:
    _ocultar(client, publicado, publicado["elaboracion_id"])

    cuerpo = _ficha(client, publicado["id_publico"]).json()

    assert cuerpo["estado_elaboracion"] == "sin_elaboraciones"
    assert cuerpo["token_evaluacion"] is None


def test_la_previsualizacion_devuelve_token_null(client, sin_publicar) -> None:
    cuerpo = _previa(client, sin_publicar).json()

    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["token_evaluacion"] is None


def test_el_token_trae_solo_datos_publicos(client, publicado) -> None:
    token = _token(client, publicado["id_publico"])

    claims = jwt.decode(token, options={"verify_signature": False})

    assert claims["pub"] == publicado["id_publico"]
    assert claims["cod"] == "E-001"
    assert set(claims) == {"aud", "pub", "cod", "n", "iat", "exp"}


def test_cada_get_emite_un_token_distinto_y_el_de_productor_se_ignora(client, publicado, db_session) -> None:
    anonimo = _ficha(client, publicado["id_publico"]).json()
    con_sesion = _ficha(client, publicado["id_publico"], publicado["headers"]).json()

    assert anonimo["token_evaluacion"] != con_sesion["token_evaluacion"]
    assert {**anonimo, "token_evaluacion": None} == {**con_sesion, "token_evaluacion": None}
    # A token obtained with a productor session answers like any other: anonymous.
    assert _evaluar(client, publicado["id_publico"], con_sesion["token_evaluacion"], headers=publicado["headers"]).status_code == 201
    assert {c.name for c in EvaluacionUtilidad.__table__.columns} == COLUMNAS_APROBADAS


# --- Headers and races -----------------------------------------------------------------------------


def test_cabeceras_no_store_y_noindex_en_201_409_422_y_404(client, publicado) -> None:
    token = _token(client, publicado["id_publico"])
    respuestas = [
        _evaluar(client, publicado["id_publico"], token),  # 201
        _evaluar(client, publicado["id_publico"], token),  # 409
        _evaluar(client, publicado["id_publico"], "no-es-un-token"),  # 422
    ]
    _ocultar(client, publicado, publicado["elaboracion_id"])
    respuestas.append(_evaluar(client, publicado["id_publico"], _token_de(publicado)))  # 404

    assert [r.status_code for r in respuestas] == [201, 409, 422, 404]
    for respuesta in respuestas:
        assert respuesta.headers["cache-control"] == CABECERAS["cache-control"]
        assert respuesta.headers["x-robots-tag"] == CABECERAS["x-robots-tag"]


def _token_de(publicado) -> str:
    return emitir_token(publicado["id_publico"], "E-001")


def test_la_carrera_del_mismo_nonce_cae_en_409_por_la_restriccion_unica(client, publicado, db_session, monkeypatch) -> None:
    token = _token(client, publicado["id_publico"])
    assert _evaluar(client, publicado["id_publico"], token).status_code == 201
    original = EvaluacionRepository.existe_nonce
    llamadas = {"n": 0}

    def ciego_la_primera_vez(self, nonce_hash):
        llamadas["n"] += 1
        return False if llamadas["n"] == 1 else original(self, nonce_hash)

    monkeypatch.setattr(EvaluacionRepository, "existe_nonce", ciego_la_primera_vez)

    segunda = _evaluar(client, publicado["id_publico"], token, False)

    assert (segunda.status_code, segunda.json()) == (409, MENSAJE_409)
    assert [f.util for f in _filas(db_session)] == [True]
