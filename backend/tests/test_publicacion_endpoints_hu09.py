"""Enable / disable the publication of a product (T09-02 / HU09).

POST and DELETE /gestion/productos/{id}/publicacion. Covers PT09-01 (API part), PT09-02, PT09-03,
PT09-05 (API part), PT09-06 (API part) and PT09-12 (publish / unpublish), plus idempotency and the
collision of the public identifier. PT09-11 (POST / PATCH reject the publication fields) lives in
test_productos_publicacion_campos_hu09.py.
"""

import pytest
from sqlalchemy import delete, select

from app.models import FormulacionVersionProducto, Producto
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_elaboracion,
    crear_producto,
    formular,
    preparar,
    crear_alergenos,
    completar_insumo,
    crear_insumo,
    registrar,
)

SIN_LOTE = {"tipo": "sin_lote"}


@pytest.fixture
def ctx(client, db_session) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["alergenos"] = crear_alergenos(db_session)
    completar_insumo(client, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    return ctx


def _url(producto_id: int) -> str:
    return f"/gestion/productos/{producto_id}/publicacion"


def _habilitar(client, ctx, producto_id: int | None = None, headers=None):
    return client.post(_url(producto_id or ctx["producto"]["id"]), headers=headers or ctx["headers"])


def _deshabilitar(client, ctx, producto_id: int | None = None, headers=None):
    return client.delete(_url(producto_id or ctx["producto"]["id"]), headers=headers or ctx["headers"])


def _finalizar_una(client, ctx, producto_id: int | None = None) -> int:
    """Register an elaboración of the product and finalize it, all through the API."""
    producto_id = producto_id or ctx["producto"]["id"]
    elaboracion = crear_elaboracion(client, ctx["headers"], producto_id)
    assert elaboracion.status_code == 201, elaboracion.text
    elaboracion_id = elaboracion.json()["id"]
    usos = client.put(
        f"/gestion/elaboraciones/{elaboracion_id}/usos",
        headers=ctx["headers"],
        json={
            "usos": [
                {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": SIN_LOTE},
                {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_habitual"]["id"], "lote": SIN_LOTE},
            ]
        },
    )
    assert usos.status_code == 200, usos.text
    final = client.post(f"/gestion/elaboraciones/{elaboracion_id}/finalizar", headers=ctx["headers"])
    assert final.status_code == 200, final.text
    return elaboracion_id


@pytest.fixture
def listo(client, ctx) -> dict:
    """Product with formulation and one finalized elaboración."""
    _finalizar_una(client, ctx)
    return ctx


def _segundo_producto(client, ctx, finalizado: bool = True) -> int:
    producto = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], producto["id"], ctx["harina"], ctx["leche"])
    if finalizado:
        _finalizar_una(client, ctx, producto["id"])
    return producto["id"]


# --- PT09-01: habilitar --------------------------------------------------------------------------


def test_pt09_01_habilita_un_producto_con_formulacion_y_una_elaboracion_finalizada(client, listo) -> None:
    respuesta = _habilitar(client, listo)

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert set(cuerpo) == {"producto_id", "publicado", "id_publico", "publicado_en"}
    assert cuerpo["producto_id"] == listo["producto"]["id"]
    assert cuerpo["publicado"] is True
    assert cuerpo["id_publico"]
    assert cuerpo["publicado_en"]


def test_pt09_01_el_listado_y_el_detalle_muestran_el_estado(client, listo) -> None:
    producto_id = listo["producto"]["id"]
    otro = crear_producto(client, listo["headers"], "Galletas", "gal-001")
    cuerpo = _habilitar(client, listo).json()

    listado = {p["id"]: p for p in client.get("/gestion/productos", headers=listo["headers"]).json()}
    detalle = client.get(f"/gestion/productos/{producto_id}", headers=listo["headers"]).json()

    for fila in (listado[producto_id], detalle):
        assert fila["publicado"] is True
        assert fila["id_publico"] == cuerpo["id_publico"]
        assert fila["publicado_en"] == cuerpo["publicado_en"]
    assert listado[otro["id"]]["publicado"] is False
    assert listado[otro["id"]]["id_publico"] is None
    assert listado[otro["id"]]["publicado_en"] is None


def test_un_producto_nuevo_se_ve_no_publicado_en_el_detalle(client, ctx) -> None:
    detalle = client.get(f"/gestion/productos/{ctx['producto']['id']}", headers=ctx["headers"]).json()
    assert (detalle["publicado"], detalle["id_publico"], detalle["publicado_en"]) == (False, None, None)


# --- PT09-02 / PT09-03: requisitos -----------------------------------------------------------


def _estado_bd(db_session, producto_id: int) -> tuple:
    db_session.expire_all()
    producto = db_session.get(Producto, producto_id)
    return producto.publicado, producto.id_publico, producto.publicado_en


def test_pt09_02_sin_formulacion_ni_elaboraciones_lista_ambos_faltantes(client, ctx, db_session) -> None:
    producto = crear_producto(client, ctx["headers"], "Galletas", "gal-001")

    respuesta = _habilitar(client, ctx, producto["id"])

    assert respuesta.status_code == 409
    detalle = respuesta.json()["detail"]
    assert detalle["faltantes"] == ["sin_formulacion", "sin_elaboracion_finalizada"]
    assert detalle["mensaje"]
    assert _estado_bd(db_session, producto["id"]) == (False, None, None)


def test_pt09_02_sin_formulacion_aunque_haya_una_elaboracion_finalizada(client, listo, db_session) -> None:
    """The state the formulation can only reach by hand: the finalized elaboración does not replace it."""
    db_session.execute(delete(FormulacionVersionProducto))
    db_session.commit()

    respuesta = _habilitar(client, listo)

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"]["faltantes"] == ["sin_formulacion"]
    assert _estado_bd(db_session, listo["producto"]["id"]) == (False, None, None)


def test_pt09_03_con_formulacion_pero_solo_borradores(client, ctx, db_session) -> None:
    assert crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).status_code == 201

    respuesta = _habilitar(client, ctx)

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"]["faltantes"] == ["sin_elaboracion_finalizada"]
    assert _estado_bd(db_session, ctx["producto"]["id"]) == (False, None, None)


# --- PT09-05: deshabilitar y volver a habilitar -----------------------------------------------


def test_pt09_05_deshabilitar_conserva_el_id_y_la_fecha_y_rehabilitar_conserva_el_id(client, listo) -> None:
    primera = _habilitar(client, listo).json()

    apagada = _deshabilitar(client, listo)
    assert apagada.status_code == 200
    assert apagada.json() == {**primera, "publicado": False}

    segunda = _habilitar(client, listo).json()
    assert segunda["publicado"] is True
    assert segunda["id_publico"] == primera["id_publico"]
    assert segunda["publicado_en"] > primera["publicado_en"]


# --- PT09-06: dos productos ---------------------------------------------------------------------


def test_pt09_06_dos_productos_publicados_tienen_id_publico_distintos(client, listo) -> None:
    otro = _segundo_producto(client, listo)

    primero = _habilitar(client, listo).json()
    segundo = _habilitar(client, listo, otro).json()

    assert primero["id_publico"] != segundo["id_publico"]


# --- idempotencia -------------------------------------------------------------------------------


def test_habilitar_un_producto_ya_publicado_responde_200_sin_cambios(client, listo) -> None:
    primera = _habilitar(client, listo).json()

    repetida = _habilitar(client, listo)

    assert repetida.status_code == 200
    assert repetida.json() == primera


def test_deshabilitar_un_producto_no_publicado_responde_200_sin_cambios(client, ctx, db_session) -> None:
    respuesta = _deshabilitar(client, ctx)

    assert respuesta.status_code == 200
    assert respuesta.json() == {
        "producto_id": ctx["producto"]["id"],
        "publicado": False,
        "id_publico": None,
        "publicado_en": None,
    }
    assert _estado_bd(db_session, ctx["producto"]["id"]) == (False, None, None)


def test_deshabilitar_dos_veces_responde_200_y_no_cambia_nada(client, listo) -> None:
    _habilitar(client, listo)
    primera = _deshabilitar(client, listo).json()

    segunda = _deshabilitar(client, listo)

    assert segunda.status_code == 200
    assert segunda.json() == primera


# --- PT09-12: aislamiento -------------------------------------------------------------------


def test_pt09_12_publicar_y_despublicar_un_producto_de_otro_productor_responde_404(client, listo, db_session) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    producto_id = listo["producto"]["id"]

    assert _habilitar(client, listo, headers=headers_b).status_code == 404
    assert _estado_bd(db_session, producto_id) == (False, None, None)

    _habilitar(client, listo)
    antes = _estado_bd(db_session, producto_id)
    assert _deshabilitar(client, listo, headers=headers_b).status_code == 404
    assert _estado_bd(db_session, producto_id) == antes
    assert antes[0] is True


def test_producto_inexistente_responde_404(client, ctx) -> None:
    assert _habilitar(client, ctx, 99999).status_code == 404
    assert _deshabilitar(client, ctx, 99999).status_code == 404


def test_sin_sesion_responde_401(client, ctx) -> None:
    assert client.post(_url(ctx["producto"]["id"])).status_code == 401
    assert client.delete(_url(ctx["producto"]["id"])).status_code == 401


def test_un_producto_eliminado_responde_404_como_el_resto_de_la_gestion(client, listo) -> None:
    producto_id = listo["producto"]["id"]
    assert client.delete(f"/gestion/productos/{producto_id}", headers=listo["headers"]).status_code == 204
    assert client.get(f"/gestion/productos/{producto_id}", headers=listo["headers"]).status_code == 404

    assert _habilitar(client, listo).status_code == 404
    assert _deshabilitar(client, listo).status_code == 404


def test_eliminar_un_producto_publicado_no_lo_despublica(client, listo, db_session) -> None:
    _habilitar(client, listo)
    producto_id = listo["producto"]["id"]

    assert client.delete(f"/gestion/productos/{producto_id}", headers=listo["headers"]).status_code == 204

    publicado, id_publico, _ = _estado_bd(db_session, producto_id)
    assert publicado is True
    assert id_publico is not None


# --- colisión del identificador público -------------------------------------------------------


def _generador(monkeypatch, valores: list[str]) -> list[str]:
    llamadas: list[str] = []
    iterador = iter(valores)

    def falso() -> str:
        valor = next(iterador)
        llamadas.append(valor)
        return valor

    monkeypatch.setattr("app.services.producto_service.generar_id_publico", falso)
    return llamadas


def test_una_colision_seguida_de_un_valor_libre_publica_bien(client, listo, db_session, monkeypatch) -> None:
    ocupado = _habilitar(client, listo).json()["id_publico"]
    otro = _segundo_producto(client, listo)
    llamadas = _generador(monkeypatch, [ocupado, "valor-libre"])

    respuesta = _habilitar(client, listo, otro)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["id_publico"] == "valor-libre"
    assert respuesta.json()["publicado"] is True
    assert llamadas == [ocupado, "valor-libre"]
    assert _estado_bd(db_session, otro)[:2] == (True, "valor-libre")


def test_tres_colisiones_dan_500_controlado_y_no_dejan_el_producto_publicado(
    client, listo, db_session, monkeypatch
) -> None:
    ocupado = _habilitar(client, listo).json()["id_publico"]
    otro = _segundo_producto(client, listo)
    llamadas = _generador(monkeypatch, [ocupado, ocupado, ocupado, "no-se-usa"])

    respuesta = _habilitar(client, listo, otro)

    assert respuesta.status_code == 500
    assert respuesta.json()["detail"]["mensaje"]
    assert llamadas == [ocupado, ocupado, ocupado]
    assert _estado_bd(db_session, otro) == (False, None, None)


def test_rehabilitar_no_vuelve_a_generar_el_id(client, listo, monkeypatch) -> None:
    primera = _habilitar(client, listo).json()
    _deshabilitar(client, listo)
    llamadas = _generador(monkeypatch, ["otro-valor"])

    segunda = _habilitar(client, listo).json()

    assert segunda["id_publico"] == primera["id_publico"]
    assert llamadas == []


# --- pendiente de T09-01: el endpoint legacy de versiones --------------------------------------


def test_el_endpoint_legacy_de_versiones_no_toca_los_productos_de_un_productor(client, listo, db_session) -> None:
    """Limitation documented: POST /productos/{id}/versiones is still exposed, but only operates on
    RT-01 legacy products (without productor). It cannot empty the current version of a managed
    product, so a managed product with finalized elaboraciones keeps its formulation."""
    producto_id = listo["producto"]["id"]
    versiones_antes = client.get(f"/productos/{producto_id}/versiones")
    assert versiones_antes.status_code == 404

    creada = client.post(f"/productos/{producto_id}/versiones", json={"descripcion": "Vacía", "vigente": True})

    assert creada.status_code == 404
    assert _habilitar(client, listo).status_code == 200
