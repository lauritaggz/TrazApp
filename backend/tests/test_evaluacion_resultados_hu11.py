"""Results of the anonymous evaluation for the productor (T11-03 / HU11).

GET /gestion/productos/{id}/evaluaciones and the `evaluacion_utilidad` of the product payload.
Covers PT11-06 (3 yes and 1 no -> 75 %) and PT11-07 (another productor's product -> 404) plus the
half-up rounding in integer arithmetic, no answers -> null (never 0), the breakdown by elaboración
(hidden ones included, default order), 401, and the number of queries. The fixtures are the ones of
test_consulta_publica_hu10.py.
"""

import hashlib
import itertools
from datetime import date

import pytest
from sqlalchemy import event

from app.core.evaluacion_resultados import porcentaje_positivas
from app.models import Elaboracion, EvaluacionUtilidad, Producto
from tests.escenario_hu05 import PRODUCTOR_B, crear_producto, registrar
from tests.test_consulta_publica_hu10 import (  # noqa: F401  (fixtures used by name)
    _dia,
    ctx,
    publicado,
    varias_elaboraciones,
)
from tests.test_evaluacion_utilidad_hu11 import _segundo_producto

NO_ENCONTRADO = {"detail": "Producto no encontrado"}
SIN_RESPUESTAS = {"total": 0, "positivas": 0, "porcentaje": None}
_contador = itertools.count(1)


def _responder(db_session, producto_id: int, elaboracion_id: int, si: int = 0, no: int = 0) -> None:
    """Store `si` positive and `no` negative answers straight in the table (unique fake nonces)."""
    for util in [True] * si + [False] * no:
        db_session.add(
            EvaluacionUtilidad(
                producto_id=producto_id,
                elaboracion_id=elaboracion_id,
                util=util,
                nonce_hash=hashlib.sha256(f"n{next(_contador)}".encode()).hexdigest(),
                fecha=date(2026, 11, 19),
            )
        )
    db_session.commit()


def _resultados(client, ctx, producto_id: int | None = None, headers: dict | None = None):
    return client.get(
        f"/gestion/productos/{producto_id or ctx['producto']['id']}/evaluaciones",
        headers=ctx["headers"] if headers is None else headers,
    )


def _resumen(client, ctx, producto_id: int | None = None) -> dict:
    fila = client.get(f"/gestion/productos/{producto_id or ctx['producto']['id']}", headers=ctx["headers"]).json()
    return fila["evaluacion_utilidad"]


# --- porcentaje -----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("positivas", "total", "esperado"),
    [
        (3, 4, 75),
        (1, 8, 13),  # 12.5 -> 13 (round() would give 12)
        (1, 3, 33),  # 33.3
        (2, 3, 67),  # 66.7
        (199, 200, 100),  # 99.5 -> 100
        (0, 5, 0),
        (5, 5, 100),
        (1, 2, 50),
        (3, 8, 38),  # 37.5 -> 38
        (0, 0, None),
    ],
)
def test_el_porcentaje_redondea_half_up_con_enteros(positivas: int, total: int, esperado) -> None:
    assert porcentaje_positivas(positivas, total) == esperado


# --- PT11-06 y resultados ------------------------------------------------------------------------


def test_pt11_06_tres_si_y_un_no_dan_75_por_ciento(client, publicado, db_session) -> None:
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=3, no=1)

    respuesta = _resultados(client, publicado)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == {
        "producto_id": publicado["producto"]["id"],
        "total": 4,
        "positivas": 3,
        "porcentaje": 75,
        "por_elaboracion": [
            {"codigo": "E-001", "fecha": _dia(5), "total": 4, "positivas": 3, "porcentaje": 75},
        ],
    }


@pytest.mark.parametrize(("si", "no", "esperado"), [(1, 7, 13), (1, 2, 33), (2, 1, 67), (199, 1, 100)])
def test_half_up_por_el_endpoint_y_en_el_resumen_del_producto(client, publicado, db_session, si, no, esperado) -> None:
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=si, no=no)

    cuerpo = _resultados(client, publicado).json()

    assert (cuerpo["total"], cuerpo["positivas"], cuerpo["porcentaje"]) == (si + no, si, esperado)
    assert cuerpo["por_elaboracion"][0]["porcentaje"] == esperado
    assert _resumen(client, publicado) == {"total": si + no, "positivas": si, "porcentaje": esperado}


def test_sin_respuestas_el_porcentaje_es_null_y_no_hay_desglose(client, publicado) -> None:
    respuesta = _resultados(client, publicado)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"producto_id": publicado["producto"]["id"], **SIN_RESPUESTAS, "por_elaboracion": []}
    assert _resumen(client, publicado) == SIN_RESPUESTAS


def test_el_desglose_trae_solo_elaboraciones_con_respuestas_incluida_la_oculta_en_orden(
    client, varias_elaboraciones, db_session
) -> None:
    producto_id = varias_elaboraciones["producto"]["id"]
    ids = varias_elaboraciones["ids"]
    _responder(db_session, producto_id, ids["E-001"], si=1, no=1)
    _responder(db_session, producto_id, ids["E-003"], si=2)  # hidden from the public, still counted
    # E-002 has no answers: it must not appear.

    cuerpo = _resultados(client, varias_elaboraciones).json()

    assert [(e["codigo"], e["total"], e["positivas"], e["porcentaje"]) for e in cuerpo["por_elaboracion"]] == [
        ("E-003", 2, 2, 100),
        ("E-001", 2, 1, 50),
    ]
    assert [e["fecha"] for e in cuerpo["por_elaboracion"]] == [_dia(1), _dia(5)]
    assert (cuerpo["total"], cuerpo["positivas"], cuerpo["porcentaje"]) == (4, 3, 75)


def test_las_respuestas_de_otro_producto_no_se_mezclan(client, publicado, db_session) -> None:
    _segundo_producto(client, publicado)
    otro = [p for p in client.get("/gestion/productos", headers=publicado["headers"]).json() if p["nombre"] == "Galletas"][0]
    elaboracion_otro = db_session.query(Elaboracion).filter_by(producto_id=otro["id"]).one().id
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=1)
    _responder(db_session, otro["id"], elaboracion_otro, si=0, no=3)

    assert _resumen(client, publicado) == {"total": 1, "positivas": 1, "porcentaje": 100}
    assert _resumen(client, publicado, otro["id"]) == {"total": 3, "positivas": 0, "porcentaje": 0}
    assert _resultados(client, publicado, otro["id"]).json()["porcentaje"] == 0


# --- aislamiento y autenticación -------------------------------------------------------------------


def test_pt11_07_el_producto_de_otro_productor_da_404(client, publicado, db_session) -> None:
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=1)
    headers_b = registrar(client, PRODUCTOR_B)

    respuesta = _resultados(client, publicado, headers=headers_b)

    assert (respuesta.status_code, respuesta.json()) == (404, NO_ENCONTRADO)
    # The same answer as a product that does not exist: nothing tells them apart.
    inexistente = _resultados(client, publicado, producto_id=999999, headers=headers_b)
    assert (inexistente.status_code, inexistente.json()) == (404, NO_ENCONTRADO)
    assert "1" not in respuesta.text


def test_un_producto_inexistente_o_dado_de_baja_da_404(client, publicado, db_session) -> None:
    assert _resultados(client, publicado, producto_id=999999).status_code == 404

    producto = db_session.get(Producto, publicado["producto"]["id"])
    producto.activo = False
    db_session.commit()

    respuesta = _resultados(client, publicado)
    assert (respuesta.status_code, respuesta.json()) == (404, NO_ENCONTRADO)


def test_sin_token_o_con_token_invalido_da_401(client, publicado) -> None:
    assert _resultados(client, publicado, headers={}).status_code == 401
    assert _resultados(client, publicado, headers={"Authorization": "Bearer no-es-un-token"}).status_code == 401


def test_el_listado_de_otro_productor_no_trae_los_resultados_ajenos(client, publicado, db_session) -> None:
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=2)
    headers_b = registrar(client, PRODUCTOR_B)
    producto_b = crear_producto(client, headers_b, "Pan", "pan-001")

    filas = client.get("/gestion/productos", headers=headers_b).json()

    assert [(f["id"], f["evaluacion_utilidad"]) for f in filas] == [(producto_b["id"], SIN_RESPUESTAS)]


# --- el producto: listado, detalle y campos existentes ---------------------------------------------


def test_el_listado_y_el_detalle_traen_evaluacion_utilidad_sin_cambiar_otros_campos(client, publicado, db_session) -> None:
    antes = client.get(f"/gestion/productos/{publicado['producto']['id']}", headers=publicado["headers"]).json()
    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=3, no=1)

    detalle = client.get(f"/gestion/productos/{publicado['producto']['id']}", headers=publicado["headers"]).json()
    listado = client.get("/gestion/productos", headers=publicado["headers"]).json()

    esperado = {"total": 4, "positivas": 3, "porcentaje": 75}
    assert detalle["evaluacion_utilidad"] == esperado
    assert [f["evaluacion_utilidad"] for f in listado] == [esperado]
    assert {k: v for k, v in detalle.items() if k != "evaluacion_utilidad"} == {
        k: v for k, v in antes.items() if k != "evaluacion_utilidad"
    }
    assert antes["evaluacion_utilidad"] == SIN_RESPUESTAS


# --- consultas ---------------------------------------------------------------------------------------


def _sentencias(db_session, accion) -> list[str]:
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        accion()
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)
    return sentencias


def test_el_endpoint_hace_tres_consultas_con_una_o_con_varias_elaboraciones(client, varias_elaboraciones, db_session) -> None:
    producto_id = varias_elaboraciones["producto"]["id"]
    ids = varias_elaboraciones["ids"]
    _responder(db_session, producto_id, ids["E-001"], si=1)
    con_una = _sentencias(db_session, lambda: _resultados(client, varias_elaboraciones))
    _responder(db_session, producto_id, ids["E-002"], si=1, no=1)
    _responder(db_session, producto_id, ids["E-003"], no=2)

    con_tres = _sentencias(db_session, lambda: _resultados(client, varias_elaboraciones))

    # authentication + ownership of the product + ONE grouped read of the answers.
    assert len(con_una) == len(con_tres) == 3, con_tres


def test_el_listado_agrega_una_sola_consulta_de_evaluaciones_sin_n_mas_1(client, publicado, db_session) -> None:
    def listar():
        assert client.get("/gestion/productos", headers=publicado["headers"]).status_code == 200

    _responder(db_session, publicado["producto"]["id"], publicado["elaboracion_id"], si=1)
    con_uno = _sentencias(db_session, listar)
    for numero in range(3):
        crear_producto(client, publicado["headers"], f"Producto {numero}", f"pro-00{numero}")

    con_cuatro = _sentencias(db_session, listar)

    assert len(con_uno) == len(con_cuatro), (con_uno, con_cuatro)
    assert sum("evaluaciones_utilidad" in s for s in con_cuatro) == 1
