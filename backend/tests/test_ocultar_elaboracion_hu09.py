"""Hide / show a finalized elaboración and the public-visibility rule (T09-04 / HU09).

POST /gestion/elaboraciones/{id}/ocultar and /mostrar. Covers PT09-07 (API part), PT09-08,
PT09-09 and PT09-10 (domain rule: there is no public endpoint yet), PT09-12 and idempotency.
Hiding never writes the elaboración nor its uses: it only inserts / deletes a row of
elaboraciones_ocultas.
"""

import pytest
from sqlalchemy import func, select

from app.models import Elaboracion, ElaboracionOculta, Producto, UsoInsumo
from app.repositories.elaboracion_repository import ElaboracionRepository
from app.services.elaboracion_service import (
    ElaboracionService,
    elaboracion_visible_publicamente,
    producto_disponible_publicamente,
)
from tests.escenario_hu05 import PRODUCTOR_B, crear_elaboracion, registrar
from tests.test_publicacion_endpoints_hu09 import (  # noqa: F401  (fixtures and helpers)
    _deshabilitar,
    _finalizar_una,
    _habilitar,
    ctx,
    listo,
)


def _ocultar(client, ctx, elaboracion_id: int, headers=None):
    return client.post(f"/gestion/elaboraciones/{elaboracion_id}/ocultar", headers=headers or ctx["headers"])


def _mostrar(client, ctx, elaboracion_id: int, headers=None):
    return client.post(f"/gestion/elaboraciones/{elaboracion_id}/mostrar", headers=headers or ctx["headers"])


def _detalle(client, ctx, elaboracion_id: int) -> dict:
    respuesta = client.get(f"/gestion/elaboraciones/{elaboracion_id}", headers=ctx["headers"])
    assert respuesta.status_code == 200
    return respuesta.json()


def _fila_listado(client, ctx, elaboracion_id: int) -> dict:
    items = client.get("/gestion/elaboraciones?limit=100", headers=ctx["headers"]).json()["items"]
    return next(item for item in items if item["id"] == elaboracion_id)


@pytest.fixture
def finalizada(client, listo) -> int:
    """Id of a finalized elaboración of the product of `listo`."""
    return client.get("/gestion/elaboraciones?estado=finalizada", headers=listo["headers"]).json()["items"][0]["id"]


# --- PT09-07 ---------------------------------------------------------------------------------


def test_pt09_07_ocultar_y_mostrar_cambia_oculta_en_ambos_sentidos(client, listo, finalizada) -> None:
    assert _detalle(client, listo, finalizada)["oculta"] is False
    assert _fila_listado(client, listo, finalizada)["oculta"] is False

    oculta = _ocultar(client, listo, finalizada)

    assert oculta.status_code == 200, oculta.text
    cuerpo = oculta.json()
    assert set(cuerpo) == {"elaboracion_id", "oculta", "oculta_at"}
    assert (cuerpo["elaboracion_id"], cuerpo["oculta"]) == (finalizada, True)
    assert cuerpo["oculta_at"]
    assert _detalle(client, listo, finalizada)["oculta"] is True
    assert _fila_listado(client, listo, finalizada)["oculta"] is True

    visible = _mostrar(client, listo, finalizada)

    assert visible.status_code == 200
    assert visible.json() == {"elaboracion_id": finalizada, "oculta": False, "oculta_at": None}
    assert _detalle(client, listo, finalizada)["oculta"] is False
    assert _fila_listado(client, listo, finalizada)["oculta"] is False


def test_el_listado_marca_solo_las_ocultas(client, listo, finalizada) -> None:
    otra = _finalizar_una(client, listo)
    borrador = crear_elaboracion(client, listo["headers"], listo["producto"]["id"], codigo="E-900").json()["id"]
    _ocultar(client, listo, finalizada)

    estados = {item["id"]: item["oculta"] for item in client.get("/gestion/elaboraciones", headers=listo["headers"]).json()["items"]}

    assert estados == {finalizada: True, otra: False, borrador: False}


def test_el_listado_calcula_oculta_en_la_misma_consulta(client, listo, finalizada, db_session) -> None:
    from sqlalchemy import event

    for _ in range(3):
        _finalizar_una(client, listo)
    _ocultar(client, listo, finalizada)
    sentencias: list[str] = []

    def contar(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", contar)
    try:
        client.get("/gestion/elaboraciones?limit=100", headers=listo["headers"])
    finally:
        event.remove(motor, "before_cursor_execute", contar)

    # No query of its own per row (nor per page): the flag travels in the list query itself.
    assert not [s for s in sentencias if s.lstrip().upper().startswith("SELECT ELABORACIONES_OCULTAS")]
    assert any("elaboraciones_ocultas" in s and "FROM elaboraciones" in s for s in sentencias)


# --- PT09-08 ---------------------------------------------------------------------------------


def test_pt09_08_ocultar_no_cambia_la_informacion_conservada_ni_los_usos(client, listo, finalizada, db_session) -> None:
    antes = _detalle(client, listo, finalizada)
    usos_antes = db_session.scalar(select(func.count()).select_from(UsoInsumo).where(UsoInsumo.elaboracion_id == finalizada))

    _ocultar(client, listo, finalizada)
    despues = _detalle(client, listo, finalizada)

    assert despues.pop("oculta") is True
    assert antes.pop("oculta") is False
    assert despues == antes
    assert despues["usos"] and despues["estado"] == "finalizada"
    db_session.expire_all()
    assert usos_antes == 2
    assert db_session.scalar(
        select(func.count()).select_from(UsoInsumo).where(UsoInsumo.elaboracion_id == finalizada)
    ) == usos_antes
    # Still in the productor's history.
    historial = client.get("/gestion/elaboraciones", headers=listo["headers"]).json()
    assert finalizada in [item["id"] for item in historial["items"]]
    assert historial["total"] == 1


def test_mostrar_tampoco_cambia_la_elaboracion(client, listo, finalizada) -> None:
    _ocultar(client, listo, finalizada)
    oculta = _detalle(client, listo, finalizada)

    _mostrar(client, listo, finalizada)
    visible = _detalle(client, listo, finalizada)

    assert oculta.pop("oculta") is True and visible.pop("oculta") is False
    assert visible == oculta


# --- borrador, otro productor, inexistente ---------------------------------------------------


@pytest.mark.parametrize("accion", [_ocultar, _mostrar])
def test_un_borrador_responde_409_de_la_api_y_no_escribe(client, ctx, db_session, accion) -> None:
    borrador = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).json()["id"]

    respuesta = accion(client, ctx, borrador)

    assert respuesta.status_code == 409, respuesta.text
    assert set(respuesta.json()["detail"]) == {"mensaje"}
    assert db_session.scalar(select(func.count()).select_from(ElaboracionOculta)) == 0


@pytest.mark.parametrize("accion", [_ocultar, _mostrar])
def test_pt09_12_otro_productor_o_inexistente_responde_404(client, listo, finalizada, db_session, accion) -> None:
    headers_b = registrar(client, PRODUCTOR_B)

    ajeno = accion(client, listo, finalizada, headers=headers_b)
    inexistente = accion(client, listo, 999999)

    assert ajeno.status_code == 404
    assert inexistente.status_code == 404
    assert ajeno.json() == inexistente.json()
    assert db_session.scalar(select(func.count()).select_from(ElaboracionOculta)) == 0


def test_sin_autenticacion_no_se_puede_ocultar(client, finalizada) -> None:
    assert client.post(f"/gestion/elaboraciones/{finalizada}/ocultar").status_code in (401, 403)


# --- idempotencia ----------------------------------------------------------------------------


def test_ocultar_dos_veces_responde_200_y_conserva_oculta_at(client, listo, finalizada, db_session) -> None:
    primera = _ocultar(client, listo, finalizada).json()
    segunda = _ocultar(client, listo, finalizada)

    assert segunda.status_code == 200
    assert segunda.json() == primera
    assert db_session.scalar(select(func.count()).select_from(ElaboracionOculta)) == 1


def test_mostrar_una_visible_responde_200_sin_cambios(client, listo, finalizada) -> None:
    respuesta = _mostrar(client, listo, finalizada)

    assert respuesta.status_code == 200
    assert respuesta.json() == {"elaboracion_id": finalizada, "oculta": False, "oculta_at": None}
    assert _detalle(client, listo, finalizada)["oculta"] is False


def test_mostrar_dos_veces_es_idempotente(client, listo, finalizada) -> None:
    _ocultar(client, listo, finalizada)

    assert _mostrar(client, listo, finalizada).json() == _mostrar(client, listo, finalizada).json()


# --- producto publicado -----------------------------------------------------------------------


def test_se_pueden_ocultar_todas_las_elaboraciones_sin_despublicar_el_producto(client, listo, finalizada) -> None:
    publicada = _habilitar(client, listo).json()

    assert _ocultar(client, listo, finalizada).status_code == 200

    detalle = client.get(f"/gestion/productos/{listo['producto']['id']}", headers=listo["headers"]).json()
    assert detalle["publicado"] is True and detalle["id_publico"] == publicada["id_publico"]


def test_elaboraciones_de_un_producto_eliminado_siguen_al_alcance_de_su_productor(client, listo, finalizada) -> None:
    """Same convention as the other elaboración endpoints: they do not look at product.activo."""
    assert client.delete(f"/gestion/productos/{listo['producto']['id']}", headers=listo["headers"]).status_code == 204

    assert _detalle(client, listo, finalizada)["id"] == finalizada
    assert _ocultar(client, listo, finalizada).status_code == 200
    assert _mostrar(client, listo, finalizada).status_code == 200


# --- regla de visibilidad pública (PT09-09 / PT09-10) -------------------------------------------


def _servicio(db_session) -> ElaboracionService:
    return ElaboracionService(ElaboracionRepository(db_session), None)  # type: ignore[arg-type]


def _recargar(db_session, elaboracion_id: int) -> Elaboracion:
    db_session.expire_all()
    return db_session.get(Elaboracion, elaboracion_id)


def test_tabla_de_verdad_de_la_visibilidad_publica(client, listo, finalizada, db_session) -> None:
    servicio = _servicio(db_session)
    producto_id = listo["producto"]["id"]
    borrador = crear_elaboracion(client, listo["headers"], producto_id, codigo="E-900").json()["id"]

    # Product not published: nothing is visible.
    assert producto_disponible_publicamente(db_session.get(Producto, producto_id)) is False
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is False

    # Published: a finalized, visible elaboración is visible; a borrador never is.
    _habilitar(client, listo)
    db_session.expire_all()
    assert producto_disponible_publicamente(db_session.get(Producto, producto_id)) is True
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is True
    assert servicio.es_visible_publicamente(_recargar(db_session, borrador)) is False

    # Finalized but hidden.
    _ocultar(client, listo, finalizada)
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is False
    _mostrar(client, listo, finalizada)
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is True

    # Disabled again: the product is no longer available.
    _deshabilitar(client, listo)
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is False

    # Published and logically deleted: not available.
    _habilitar(client, listo)
    assert client.delete(f"/gestion/productos/{producto_id}", headers=listo["headers"]).status_code == 204
    db_session.expire_all()
    producto = db_session.get(Producto, producto_id)
    assert producto.publicado is True and producto.activo is False
    assert producto_disponible_publicamente(producto) is False
    assert servicio.es_visible_publicamente(_recargar(db_session, finalizada)) is False


@pytest.mark.parametrize(
    ("publicado", "activo", "estado", "oculta", "esperado"),
    [
        (False, True, "finalizada", False, False),
        (True, False, "finalizada", False, False),
        (True, True, "borrador", False, False),
        (True, True, "finalizada", True, False),
        (True, True, "finalizada", False, True),
    ],
)
def test_la_regla_pura_de_visibilidad(publicado, activo, estado, oculta, esperado) -> None:
    class _Obj:
        def __init__(self, **kw) -> None:
            self.__dict__.update(kw)

    producto = _Obj(publicado=publicado, activo=activo)

    assert elaboracion_visible_publicamente(producto, _Obj(estado=estado), oculta) is esperado
