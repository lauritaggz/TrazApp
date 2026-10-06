"""Persistence of editing and deleting elaboraciones, and the 409 when a trigger protects them (T05-05).

Persistence is read from an independent session (fixtures `api` and `fabrica`, conftest.py). The
last tests, PostgreSQL only, make the service skip its own state check on purpose so that the
database triggers are the ones that reject the write: the service must turn their error into the
same 409 instead of a 500, and nothing may change.
"""

import pytest
from sqlalchemy import select

from app.models import Elaboracion, UsoInsumo
from app.services import elaboracion_service
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import (
    asignacion_completa,
    completar_insumo,
    crear_alergenos,
    crear_elaboracion,
    crear_insumo,
    preparar,
    registrar,
)

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Los triggers de elaboraciones son de PostgreSQL.",
)


@pytest.fixture
def ctx(api, fabrica) -> dict:
    headers = registrar(api)
    base = preparar(api, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(api, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    with fabrica() as sesion:
        ctx["alergenos"] = crear_alergenos(sesion)
    completar_insumo(api, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    ctx["elaboracion"] = crear_elaboracion(api, headers, base["producto"]["id"], codigo="E-001").json()
    return ctx


def _url(ctx, elaboracion_id: int | None = None, sufijo: str = "") -> str:
    return f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}{sufijo}"


def _asignar(api, ctx, elaboracion_id: int | None = None) -> None:
    response = api.put(_url(ctx, elaboracion_id, "/usos"), headers=ctx["headers"], json={"usos": asignacion_completa(ctx)})
    assert response.status_code == 200, response.text


def _finalizar(api, ctx):
    return api.post(_url(ctx, None, "/finalizar"), headers=ctx["headers"])


def _leer(fabrica) -> dict[int, Elaboracion]:
    """Read with a brand new session: only committed data is visible."""
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(Elaboracion).order_by(Elaboracion.id)))
        sesion.expunge_all()
    return {fila.id: fila for fila in filas}


def _usos(fabrica, elaboracion_id: int) -> list[tuple]:
    with fabrica() as sesion:
        return [
            (u.id, u.ingrediente_id, u.insumo_id, u.lote_id, u.sin_lote, u.informacion_conservada)
            for u in sesion.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id).order_by(UsoInsumo.id))
        ]


# --- persistencia ------------------------------------------------------------------------


def test_modificar_un_borrador_persiste_el_codigo_y_la_fecha(api, ctx, fabrica) -> None:
    antes = _leer(fabrica)[ctx["elaboracion"]["id"]]

    response = api.patch(_url(ctx), headers=ctx["headers"], json={"codigo": "LOTE-7", "fecha": "2026-10-01"})

    assert response.status_code == 200, response.text
    guardada = _leer(fabrica)[ctx["elaboracion"]["id"]]
    assert (guardada.codigo, str(guardada.fecha_elaboracion), guardada.estado) == ("LOTE-7", "2026-10-01", "borrador")
    assert (guardada.version_producto_id, guardada.producto_id) == (antes.version_producto_id, antes.producto_id)


def test_una_modificacion_rechazada_no_persiste_nada(api, ctx, fabrica) -> None:
    crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-002")
    antes = _leer(fabrica)[ctx["elaboracion"]["id"]]

    assert api.patch(_url(ctx), headers=ctx["headers"], json={"codigo": "e-002", "fecha": "2026-09-01"}).status_code == 409
    assert api.patch(_url(ctx), headers=ctx["headers"], json={"fecha": "2999-01-01"}).status_code == 422

    despues = _leer(fabrica)[ctx["elaboracion"]["id"]]
    assert (despues.codigo, despues.fecha_elaboracion) == (antes.codigo, antes.fecha_elaboracion)


def test_eliminar_un_borrador_persiste_la_baja_de_la_elaboracion_y_de_sus_usos(api, ctx, fabrica) -> None:
    otra = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-002").json()
    _asignar(api, ctx)
    assert len(_usos(fabrica, ctx["elaboracion"]["id"])) == 2

    assert api.delete(_url(ctx), headers=ctx["headers"]).status_code == 204

    assert set(_leer(fabrica)) == {otra["id"]}
    assert _usos(fabrica, ctx["elaboracion"]["id"]) == []
    assert len(_usos(fabrica, otra["id"])) == 2


def test_modificar_o_eliminar_una_finalizada_deja_la_base_exactamente_igual(api, ctx, fabrica) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    antes = (_leer(fabrica), _usos(fabrica, ctx["elaboracion"]["id"]))

    assert api.patch(_url(ctx), headers=ctx["headers"], json={"codigo": "OTRO"}).status_code == 409
    assert api.delete(_url(ctx), headers=ctx["headers"]).status_code == 409
    assert api.put(_url(ctx, None, "/usos"), headers=ctx["headers"], json={"usos": asignacion_completa(ctx)}).status_code == 409

    despues = (_leer(fabrica), _usos(fabrica, ctx["elaboracion"]["id"]))
    assert despues[1] == antes[1]
    for id_, antes_fila in antes[0].items():
        fila = despues[0][id_]
        assert (fila.codigo, fila.estado, fila.finalizada_at, fila.fecha_elaboracion, fila.updated_at) == (
            antes_fila.codigo,
            antes_fila.estado,
            antes_fila.finalizada_at,
            antes_fila.fecha_elaboracion,
            antes_fila.updated_at,
        )


# --- el trigger rechaza y el servicio responde 409 (PostgreSQL) --------------------------
# Each test makes the service believe a finalizada is a borrador (ESTADO_BORRADOR), so only the
# triggers can stop the write.


@solo_postgresql
def test_si_el_servicio_dejara_pasar_una_modificacion_el_trigger_la_rechaza_con_409(
    api, ctx, fabrica, monkeypatch
) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    antes = _leer(fabrica)[ctx["elaboracion"]["id"]]
    monkeypatch.setattr(elaboracion_service, "ESTADO_BORRADOR", "finalizada")

    response = api.patch(_url(ctx), headers=ctx["headers"], json={"codigo": "OTRO"})

    assert response.status_code == 409
    assert response.json()["detail"] == "La elaboración está finalizada y no puede modificarse."
    assert _leer(fabrica)[ctx["elaboracion"]["id"]].codigo == antes.codigo


@solo_postgresql
def test_si_el_servicio_dejara_pasar_una_eliminacion_el_trigger_la_rechaza_con_409(
    api, ctx, fabrica, monkeypatch
) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    usos = _usos(fabrica, ctx["elaboracion"]["id"])
    monkeypatch.setattr(elaboracion_service, "ESTADO_BORRADOR", "finalizada")

    response = api.delete(_url(ctx), headers=ctx["headers"])

    assert response.status_code == 409
    assert response.json()["detail"] == "La elaboración está finalizada y no puede eliminarse."
    assert ctx["elaboracion"]["id"] in _leer(fabrica)
    assert _usos(fabrica, ctx["elaboracion"]["id"]) == usos


@solo_postgresql
def test_si_el_servicio_dejara_pasar_un_cambio_de_asignacion_el_trigger_lo_rechaza_con_409(
    api, ctx, fabrica, monkeypatch
) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    usos = _usos(fabrica, ctx["elaboracion"]["id"])
    monkeypatch.setattr(elaboracion_service, "ESTADO_BORRADOR", "finalizada")
    cambiada = asignacion_completa(ctx)
    cambiada[1] = {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_otro"]["id"], "lote": {"tipo": "sin_lote"}}

    response = api.put(_url(ctx, None, "/usos"), headers=ctx["headers"], json={"usos": cambiada})

    assert response.status_code == 409
    assert _usos(fabrica, ctx["elaboracion"]["id"]) == usos


@solo_postgresql
def test_si_el_servicio_dejara_finalizar_de_nuevo_el_trigger_lo_rechaza_con_409(
    api, ctx, fabrica, monkeypatch
) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    usos = _usos(fabrica, ctx["elaboracion"]["id"])
    monkeypatch.setattr(elaboracion_service, "ESTADO_BORRADOR", "finalizada")

    response = _finalizar(api, ctx)

    assert response.status_code == 409
    assert _usos(fabrica, ctx["elaboracion"]["id"]) == usos


@solo_postgresql
def test_si_el_servicio_dejara_finalizar_sin_copias_el_trigger_lo_rechaza_con_409(
    api, ctx, fabrica, monkeypatch
) -> None:
    """The finalization with incomplete data: the trigger stops what the service validation would."""
    _asignar(api, ctx)
    # Skip the service validation of the lines and the writing of the copies.
    monkeypatch.setattr(
        elaboracion_service.ElaboracionService, "_problemas_de_finalizacion", staticmethod(lambda *args, **kwargs: [])
    )
    monkeypatch.setattr(elaboracion_service, "construir_informacion_conservada", lambda *a, **k: None)

    response = _finalizar(api, ctx)

    assert response.status_code == 409
    assert "información conservada" in response.json()["detail"]
    elaboracion = _leer(fabrica)[ctx["elaboracion"]["id"]]
    assert (elaboracion.estado, elaboracion.finalizada_at) == ("borrador", None)
