"""HT08 / T-HT08-04B (PT-HT08-14): GET /gestion/elaboraciones/{id}/vecinos and /gestion/insumos/{id}/vecinos.

Per resource: the walk follows the default order of its list, the ends have no neighbour, another productor's
records never appear (their id answers 404) and the exclusion rule: borradores are not walked (hidden ones are),
inactive supplies are not walked. The elaboración name «E-002 · Queque de vainilla» is built in SQL and checked
on both SQLite and PostgreSQL (this module runs on both).
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app.models import InsumoComercial
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    preparar,
    registrar,
)
from tests.test_consulta_publica_hu10 import _finalizar, ctx  # noqa: F401  (fixture used by name)

ELABORACION_NO_ENCONTRADA = {"detail": "Elaboración no encontrada"}
INSUMO_NO_ENCONTRADO = {"detail": "Insumo no encontrado"}
BASE = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def _vecinos(client, headers, recurso: str, registro_id: int):
    return client.get(f"/gestion/{recurso}/{registro_id}/vecinos", headers=headers)


def _recorrer(client, headers, recurso: str, desde: int, hacia: str) -> list[int]:
    """Follow `hacia` ("siguiente" / "anterior") from `desde` until the end; the ids visited."""
    visitados = [desde]
    while (vecino := _vecinos(client, headers, recurso, visitados[-1]).json()[hacia]) is not None:
        visitados.append(vecino["id"])
    return visitados


def _contexto_de(client, headers) -> dict:
    """What `_finalizar` needs, for any productor."""
    base = preparar(client, headers)
    insumo_harina = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    return {
        "headers": headers,
        **base,
        "insumo_por_ingrediente": {
            base["harina"]["id"]: insumo_harina["id"],
            base["leche"]["id"]: base["insumo_habitual"]["id"],
        },
    }


# --- Elaboraciones -------------------------------------------------------------------------------------


def _historial_finalizadas(client, headers) -> list[int]:
    respuesta = client.get("/gestion/elaboraciones", headers=headers, params={"estado": "finalizada", "limit": 100})
    return [e["id"] for e in respuesta.json()["items"]]


def test_pt_ht08_14_elaboraciones_recorrido_en_el_orden_del_historial_mezclando_productos(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Queque de vainilla", "que-002")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    # Dates out of id order and two products interleaved; the same day twice (tie broken by id).
    _finalizar(client, ctx, "E-001", dias=3)
    _finalizar(client, ctx, "E-002", dias=1, producto_id=otro["id"])
    _finalizar(client, ctx, "E-003", dias=5)
    _finalizar(client, ctx, "E-004", dias=1)
    orden = _historial_finalizadas(client, ctx["headers"])
    assert len(orden) == 4

    assert _recorrer(client, ctx["headers"], "elaboraciones", orden[0], "siguiente") == orden
    assert _recorrer(client, ctx["headers"], "elaboraciones", orden[-1], "anterior") == list(reversed(orden))
    primero = _vecinos(client, ctx["headers"], "elaboraciones", orden[0]).json()
    ultimo = _vecinos(client, ctx["headers"], "elaboraciones", orden[-1]).json()
    assert primero["anterior"] is None and ultimo["siguiente"] is None


def test_el_nombre_es_codigo_y_producto_en_sqlite_y_postgresql(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Queque de vainilla", "que-002")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    mas_reciente = _finalizar(client, ctx, "E-002", dias=1, producto_id=otro["id"])
    mas_antigua = _finalizar(client, ctx, "E-001", dias=2)

    cuerpo = _vecinos(client, ctx["headers"], "elaboraciones", mas_antigua).json()

    assert cuerpo == {"anterior": {"id": mas_reciente, "nombre": "E-002 · Queque de vainilla"}, "siguiente": None}
    assert _vecinos(client, ctx["headers"], "elaboraciones", mas_reciente).json()["siguiente"] == {
        "id": mas_antigua,
        "nombre": f"E-001 · {ctx['producto']['nombre']}",
    }


def test_los_borradores_no_se_recorren_y_las_ocultas_si(client, ctx) -> None:
    antigua = _finalizar(client, ctx, "E-001", dias=4)
    oculta = _finalizar(client, ctx, "E-002", dias=3)
    reciente = _finalizar(client, ctx, "E-004", dias=1)
    borrador = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-003").json()
    assert client.post(f"/gestion/elaboraciones/{oculta}/ocultar", headers=ctx["headers"]).status_code == 200

    assert _recorrer(client, ctx["headers"], "elaboraciones", reciente, "siguiente") == [reciente, oculta, antigua]
    respuesta = _vecinos(client, ctx["headers"], "elaboraciones", borrador["id"])
    assert respuesta.status_code == 404
    assert respuesta.json() == ELABORACION_NO_ENCONTRADA


def test_elaboraciones_de_otro_productor_nunca_son_vecinas_y_su_id_da_404(client, ctx) -> None:
    propias = [_finalizar(client, ctx, f"E-00{i}", dias=i * 2) for i in (1, 2, 3)]
    otro = _contexto_de(client, registrar(client, PRODUCTOR_B))
    ajenas = [_finalizar(client, otro, f"E-00{i}", dias=i * 2 + 1) for i in (1, 2)]

    assert _recorrer(client, ctx["headers"], "elaboraciones", propias[0], "siguiente") == propias
    for propia in propias:
        cuerpo = _vecinos(client, ctx["headers"], "elaboraciones", propia).json()
        assert {v["id"] for v in (cuerpo["anterior"], cuerpo["siguiente"]) if v} <= set(propias)
    respuesta = _vecinos(client, ctx["headers"], "elaboraciones", ajenas[0])
    assert respuesta.status_code == 404
    assert respuesta.json() == ELABORACION_NO_ENCONTRADA


def test_una_sola_elaboracion_sin_vecinos_inexistente_404_y_sin_token_401(client, ctx) -> None:
    unica = _finalizar(client, ctx, "E-001")

    assert _vecinos(client, ctx["headers"], "elaboraciones", unica).json() == {"anterior": None, "siguiente": None}
    assert _vecinos(client, ctx["headers"], "elaboraciones", 999_999).json() == ELABORACION_NO_ENCONTRADA
    assert client.get(f"/gestion/elaboraciones/{unica}/vecinos").status_code == 401


# --- Insumos ---------------------------------------------------------------------------------------------


def _lista_de_insumos(client, headers) -> list[int]:
    return [i["id"] for i in client.get("/gestion/insumos", headers=headers).json()]


def _fechar_insumos(db_session, fechas: dict[int, datetime]) -> None:
    for insumo_id, fecha in fechas.items():
        db_session.get(InsumoComercial, insumo_id).created_at = fecha
    db_session.commit()


def _insumos(client, headers, db_session, *nombres: str) -> list[dict]:
    """Supplies of one ingredient, dated days apart and NOT in id order."""
    base = preparar(client, headers)
    creados = [crear_insumo(client, headers, base["harina"]["id"], nombre) for nombre in nombres]
    dias = [0, 2, 1, 3][: len(creados)]
    _fechar_insumos(db_session, {i["id"]: BASE + timedelta(days=d) for i, d in zip(creados, dias)})
    return creados


def test_pt_ht08_14_insumos_recorrido_en_el_orden_de_la_lista(client, db_session) -> None:
    headers = registrar(client)
    _insumos(client, headers, db_session, "Harina A", "Harina B", "Harina C")
    orden = _lista_de_insumos(client, headers)  # also the two supplies of preparar()
    assert len(orden) == 5

    assert _recorrer(client, headers, "insumos", orden[0], "siguiente") == orden
    assert _recorrer(client, headers, "insumos", orden[-1], "anterior") == list(reversed(orden))
    medio = _vecinos(client, headers, "insumos", orden[2]).json()
    nombres = {i["id"]: i["nombre"] for i in client.get("/gestion/insumos", headers=headers).json()}
    assert medio == {
        "anterior": {"id": orden[1], "nombre": nombres[orden[1]]},
        "siguiente": {"id": orden[3], "nombre": nombres[orden[3]]},
    }


def test_los_insumos_inactivos_no_se_recorren_y_el_propio_inactivo_da_404(client, db_session) -> None:
    headers = registrar(client)
    a, b, c = _insumos(client, headers, db_session, "Harina A", "Harina B", "Harina C")
    # Order among these three: B (day 2), C (day 1), A (day 0). Deactivate the middle one.
    assert client.delete(f"/gestion/insumos/{c['id']}", headers=headers).status_code == 204

    assert _vecinos(client, headers, "insumos", b["id"]).json()["siguiente"]["id"] == a["id"]
    assert _vecinos(client, headers, "insumos", a["id"]).json()["anterior"]["id"] == b["id"]
    inactivo = _vecinos(client, headers, "insumos", c["id"])
    assert inactivo.status_code == 404
    assert inactivo.json() == INSUMO_NO_ENCONTRADO


def test_insumos_de_otro_productor_nunca_son_vecinos_y_su_id_da_404(client, db_session) -> None:
    headers = registrar(client)
    otro = registrar(client, PRODUCTOR_B)
    propios = _insumos(client, headers, db_session, "Harina A", "Harina B", "Harina C")
    ajeno = crear_insumo(client, otro, preparar(client, otro)["harina"]["id"], "Harina ajena")
    _fechar_insumos(db_session, {ajeno["id"]: BASE + timedelta(days=1, hours=12)})

    propios_ids = set(_lista_de_insumos(client, headers))
    for insumo in propios:
        cuerpo = _vecinos(client, headers, "insumos", insumo["id"]).json()
        assert {v["id"] for v in (cuerpo["anterior"], cuerpo["siguiente"]) if v} <= propios_ids
    respuesta = _vecinos(client, headers, "insumos", ajeno["id"])
    assert respuesta.status_code == 404
    assert respuesta.json() == INSUMO_NO_ENCONTRADO


def test_un_solo_insumo_sin_vecinos_y_sin_token_401(client) -> None:
    headers = registrar(client)
    unico = crear_insumo(client, headers, crear_ingrediente(client, headers, "Harina", "har-001")["id"], "Único")

    assert _vecinos(client, headers, "insumos", unico["id"]).json() == {"anterior": None, "siguiente": None}
    assert client.get(f"/gestion/insumos/{unico['id']}/vecinos").status_code == 401


# --- Solo lectura ----------------------------------------------------------------------------------------


def test_las_dos_consultas_solo_leen(client, ctx, db_session) -> None:
    elaboracion = _finalizar(client, ctx, "E-001")
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert _vecinos(client, ctx["headers"], "elaboraciones", elaboracion).status_code == 200
        assert _vecinos(client, ctx["headers"], "insumos", ctx["insumo_harina"]["id"]).status_code == 200
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)

    assert sentencias
    assert not [s for s in sentencias if s.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))]
