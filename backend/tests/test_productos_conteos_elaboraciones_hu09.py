"""Elaboración counts in the product payload (T09-05 / HU09, vista general de Publicaciones).

`elaboraciones_finalizadas` and `elaboraciones_visibles` come from ONE grouped query for the whole
list. Borradores never count; hidden ones count as finalized but not as visible.
"""

import pytest
from sqlalchemy import event

from tests.escenario_hu05 import PRODUCTOR_B, crear_elaboracion, crear_producto, registrar
from tests.test_publicacion_endpoints_hu09 import (  # noqa: F401  (fixtures and helpers)
    _finalizar_una,
    _segundo_producto,
    ctx,
    listo,
)


def _conteos(client, headers, producto_id: int) -> tuple[int, int]:
    fila = client.get(f"/gestion/productos/{producto_id}", headers=headers).json()
    return fila["elaboraciones_finalizadas"], fila["elaboraciones_visibles"]


def _ocultar(client, headers, elaboracion_id: int) -> None:
    assert client.post(f"/gestion/elaboraciones/{elaboracion_id}/ocultar", headers=headers).status_code == 200


def test_un_producto_sin_elaboraciones_cuenta_cero(client, ctx) -> None:
    assert _conteos(client, ctx["headers"], ctx["producto"]["id"]) == (0, 0)


def test_los_borradores_no_cuentan(client, ctx) -> None:
    crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-900")

    assert _conteos(client, ctx["headers"], ctx["producto"]["id"]) == (0, 0)


def test_las_finalizadas_cuentan_y_las_ocultas_bajan_solo_las_visibles(client, ctx) -> None:
    producto_id = ctx["producto"]["id"]
    primera = _finalizar_una(client, ctx)
    _finalizar_una(client, ctx)
    crear_elaboracion(client, ctx["headers"], producto_id, codigo="E-900")
    assert _conteos(client, ctx["headers"], producto_id) == (2, 2)

    _ocultar(client, ctx["headers"], primera)

    assert _conteos(client, ctx["headers"], producto_id) == (2, 1)
    client.post(f"/gestion/elaboraciones/{primera}/mostrar", headers=ctx["headers"])
    assert _conteos(client, ctx["headers"], producto_id) == (2, 2)


def test_el_listado_trae_los_conteos_de_cada_producto(client, ctx) -> None:
    uno = ctx["producto"]["id"]
    elaboracion = _finalizar_una(client, ctx)
    otro = _segundo_producto(client, ctx, finalizado=False)
    _ocultar(client, ctx["headers"], elaboracion)

    filas = {p["id"]: (p["elaboraciones_finalizadas"], p["elaboraciones_visibles"]) for p in client.get("/gestion/productos", headers=ctx["headers"]).json()}

    assert filas == {uno: (1, 0), otro: (0, 0)}


def test_los_conteos_estan_aislados_por_productor(client, ctx) -> None:
    _finalizar_una(client, ctx)
    headers_b = registrar(client, PRODUCTOR_B)
    producto_b = crear_producto(client, headers_b, "Pan", "pan-001")

    assert _conteos(client, headers_b, producto_b["id"]) == (0, 0)
    assert [p["id"] for p in client.get("/gestion/productos", headers=headers_b).json()] == [producto_b["id"]]


def test_las_respuestas_de_crear_y_editar_tambien_traen_los_conteos(client, ctx) -> None:
    _finalizar_una(client, ctx)
    producto_id = ctx["producto"]["id"]

    editado = client.patch(f"/gestion/productos/{producto_id}", headers=ctx["headers"], json={"nombre": "Otro nombre"}).json()
    nuevo = crear_producto(client, ctx["headers"], "Galletas", "gal-001")

    assert (editado["elaboraciones_finalizadas"], editado["elaboraciones_visibles"]) == (1, 1)
    assert (nuevo["elaboraciones_finalizadas"], nuevo["elaboraciones_visibles"]) == (0, 0)


def test_sin_n_mas_1_el_listado_hace_las_mismas_consultas_con_uno_o_con_varios_productos(client, ctx, db_session) -> None:
    sentencias: list[str] = []

    def contar(conn, cursor, statement, *args):
        sentencias.append(statement)

    def consultas_del_listado() -> int:
        sentencias.clear()
        motor = db_session.get_bind()
        event.listen(motor, "before_cursor_execute", contar)
        try:
            assert client.get("/gestion/productos", headers=ctx["headers"]).status_code == 200
        finally:
            event.remove(motor, "before_cursor_execute", contar)
        return len(sentencias)

    _finalizar_una(client, ctx)
    con_uno = consultas_del_listado()
    for _ in range(3):
        _segundo_producto_distinto = crear_producto(client, ctx["headers"], f"P{_}", f"p-00{_}")
        crear_elaboracion(client, ctx["headers"], _segundo_producto_distinto["id"], codigo="E-900")

    assert consultas_del_listado() == con_uno
    assert any("elaboraciones_ocultas" in s for s in sentencias)
