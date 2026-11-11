"""Preview of the public ficha by its productor (T10-05 / HU10): GET /gestion/productos/{id}/vista-publica.

Covers PT10-11 (preview a product not published yet; the public link stays unavailable) and the
extra scenarios: single source (same body as the public consultation), hidden elaboraciones and
borradores out, another productor / unknown / deleted -> 404, no token -> 401, the same 422 as the
public consultation, and the number of queries. The fixtures and helpers are the ones of
test_consulta_publica_hu10.py.
"""

import pytest
from sqlalchemy import event

from app.models import Producto
from tests.escenario_hu05 import PRODUCTOR_B, crear_elaboracion, registrar
from tests.test_consulta_publica_hu10 import (  # noqa: F401  (fixtures used by name)
    CABECERAS,
    CONSULTAS_MAXIMAS,
    MENSAJE_NO_DISPONIBLE,
    RUTAS_APROBADAS,
    _dia,
    _ficha,
    _finalizar,
    _forma,
    _ocultar,
    _publicar,
    _rutas,
    ctx,
    publicado,
)

# Statements spent on authentication (token -> productor) before the ficha itself is read.
CONSULTAS_AUTENTICACION = 1
NO_ENCONTRADO = {"detail": "Producto no encontrado"}


def _previa(client, ctx, producto_id: int | None = None, headers: dict | None = None, **params):
    return client.get(
        f"/gestion/productos/{producto_id or ctx['producto']['id']}/vista-publica",
        headers=ctx["headers"] if headers is None else headers,
        params=params or None,
    )


def _estado(db_session, producto_id: int) -> tuple:
    db_session.expire_all()
    producto = db_session.get(Producto, producto_id)
    return producto.publicado, producto.id_publico, producto.publicado_en


@pytest.fixture
def sin_publicar(client, ctx) -> dict:
    """Product with a formulation and one finalized elaboración (E-001), never published."""
    ctx["elaboracion_id"] = _finalizar(client, ctx, "E-001", dias=5)
    return ctx


# --- PT10-11 ---------------------------------------------------------------------------------------


def test_pt10_11_previsualiza_un_producto_no_publicado_y_no_cambia_su_publicacion(client, sin_publicar, db_session) -> None:
    producto_id = sin_publicar["producto"]["id"]
    assert _estado(db_session, producto_id) == (False, None, None)

    respuesta = _previa(client, sin_publicar)

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["producto"]["nombre"] == "Queque de vainilla"
    assert cuerpo["producto"]["id_publico"] is None  # never published: no identifier yet
    assert cuerpo["elaboracion"]["codigo"] == "E-001"
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-001"]
    # Previewing neither publishes nor creates the public id.
    assert _estado(db_session, producto_id) == (False, None, None)


def test_pt10_11_despues_de_previsualizar_la_consulta_publica_sigue_no_disponible(client, sin_publicar, db_session) -> None:
    producto_id = sin_publicar["producto"]["id"]
    # It had an identifier (published once) and was unpublished: the public link must stay unavailable.
    id_publico = _publicar(client, sin_publicar)
    assert client.delete(f"/gestion/productos/{producto_id}/publicacion", headers=sin_publicar["headers"]).status_code == 200
    antes = _estado(db_session, producto_id)
    assert antes[0] is False and antes[1] == id_publico and antes[2] is not None
    esperada = (404, MENSAJE_NO_DISPONIBLE, CABECERAS["cache-control"], CABECERAS["x-robots-tag"])
    assert _forma(_ficha(client, id_publico)) == esperada

    previa = _previa(client, sin_publicar)

    assert previa.status_code == 200
    assert previa.json()["producto"]["id_publico"] == id_publico
    assert previa.json()["elaboracion"]["codigo"] == "E-001"
    assert _forma(_ficha(client, id_publico)) == esperada
    assert _estado(db_session, producto_id) == antes  # publicado, id_publico and publicado_en untouched


# --- Single source ---------------------------------------------------------------------------------


def test_la_previsualizacion_es_identica_a_la_consulta_publica_de_un_producto_publicado(client, publicado) -> None:
    _finalizar(client, publicado, "E-002", dias=3)
    _finalizar(client, publicado, "E-003", dias=3)  # same day as E-002: "varias"
    variantes = [
        {},
        {"codigo": "e-001"},
        {"codigo": "  E-002 "},
        {"codigo": "NO-EXISTE"},
        {"fecha": _dia(5)},
        {"fecha": _dia(3)},  # varias
        {"fecha": _dia(20)},  # none
    ]

    for params in variantes:
        publica = _ficha(client, publicado["id_publico"], **params)
        previa = _previa(client, publicado, **params)
        assert previa.status_code == publica.status_code == 200, params
        assert previa.json() == publica.json(), params
    assert _ficha(client, publicado["id_publico"], fecha=_dia(3)).json()["estado_elaboracion"] == "varias"


def test_la_previsualizacion_tiene_exactamente_los_campos_de_la_lista_blanca(client, publicado) -> None:
    assert _rutas(_previa(client, publicado).json()) == RUTAS_APROBADAS


# --- What the consumer would see: hidden and borradores stay out -----------------------------------------


def test_las_ocultas_y_los_borradores_no_aparecen_en_la_previsualizacion(client, sin_publicar) -> None:
    e_antigua = sin_publicar["elaboracion_id"]
    e_media = _finalizar(client, sin_publicar, "E-002", dias=3)
    e_reciente = _finalizar(client, sin_publicar, "E-003", dias=1)
    assert crear_elaboracion(client, sin_publicar["headers"], sin_publicar["producto"]["id"], codigo="E-004").status_code == 201
    _ocultar(client, sin_publicar, e_reciente)

    cuerpo = _previa(client, sin_publicar).json()

    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-002", "E-001"]
    assert cuerpo["elaboracion"]["codigo"] == "E-002"
    assert "E-003" not in str(cuerpo) and "E-004" not in str(cuerpo)
    # By code: hidden, borrador and unknown answer the same.
    inexistente = _previa(client, sin_publicar, codigo="NO-EXISTE").json()
    assert inexistente["estado_elaboracion"] == "no_disponible"
    for codigo in ("E-003", "E-004"):
        assert _previa(client, sin_publicar, codigo=codigo).json() == inexistente

    _ocultar(client, sin_publicar, e_media)
    _ocultar(client, sin_publicar, e_antigua)
    vacia = _previa(client, sin_publicar).json()
    assert (vacia["estado_elaboracion"], vacia["elaboraciones"], vacia["elaboracion"]) == ("sin_elaboraciones", [], None)


# --- Ownership and authentication ------------------------------------------------------------------


def test_otro_productor_inexistente_y_eliminado_responden_404(client, sin_publicar) -> None:
    otro_productor = registrar(client, PRODUCTOR_B)
    producto_id = sin_publicar["producto"]["id"]

    ajeno = _previa(client, sin_publicar, headers=otro_productor)
    inexistente = _previa(client, sin_publicar, producto_id=999999)

    assert (ajeno.status_code, ajeno.json()) == (404, NO_ENCONTRADO)
    assert (inexistente.status_code, inexistente.json()) == (404, NO_ENCONTRADO)
    # A deleted product follows the convention of the management endpoints: 404.
    assert client.delete(f"/gestion/productos/{producto_id}", headers=sin_publicar["headers"]).status_code == 204
    eliminado = _previa(client, sin_publicar)
    assert (eliminado.status_code, eliminado.json()) == (404, NO_ENCONTRADO)


def test_sin_token_o_con_token_invalido_responde_401(client, sin_publicar) -> None:
    assert _previa(client, sin_publicar, headers={"Authorization": ""}).status_code == 401
    assert client.get(f"/gestion/productos/{sin_publicar['producto']['id']}/vista-publica").status_code == 401
    assert _previa(client, sin_publicar, headers={"Authorization": "Bearer no-es-un-token"}).status_code == 401


@pytest.mark.parametrize(
    "params",
    [{"codigo": "E-001", "fecha": "2026-01-01"}, {"fecha": "01-02-2026"}, {"fecha": "2026-02-30"}, {"fecha": ""}],
)
def test_los_parametros_invalidos_dan_el_mismo_422_que_la_consulta_publica(client, sin_publicar, params) -> None:
    propio = _previa(client, sin_publicar, **params)
    inexistente = _previa(client, sin_publicar, producto_id=999999, **params)
    publica = _ficha(client, "ZZZZZZZZZZZZZZZZZZZZZZ", **params)

    assert propio.status_code == 422
    assert set(propio.json()["detail"]) == {"mensaje"}
    assert propio.json() == inexistente.json() == publica.json()


def test_la_previsualizacion_no_se_cachea(client, sin_publicar) -> None:
    assert _previa(client, sin_publicar).headers["cache-control"] == "no-store"
    assert _previa(client, sin_publicar, producto_id=999999).headers["cache-control"] == "no-store"


# --- Queries ---------------------------------------------------------------------------------------


def test_la_cantidad_de_consultas_es_la_de_la_ficha_mas_la_autenticacion(client, sin_publicar, db_session) -> None:
    for numero in range(2, 5):
        _finalizar(client, sin_publicar, f"E-00{numero}", dias=numero)
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert _previa(client, sin_publicar).status_code == 200
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)

    # Exactly the ficha's 4 (product, categories, elaboraciones, copies) plus the authentication one.
    assert len(sentencias) == CONSULTAS_MAXIMAS + CONSULTAS_AUTENTICACION, sentencias
