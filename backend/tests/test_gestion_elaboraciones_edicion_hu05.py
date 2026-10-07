"""Editing and deleting elaboraciones: only borradores (T05-05 / HU05).

PATCH /gestion/elaboraciones/{id} and DELETE /gestion/elaboraciones/{id}. Covers PT05-08 (modify
and delete a borrador; deleting removes its uses) and PT05-11 (a finalizada can be neither
modified nor deleted). The database triggers have their own tests (test_triggers_elaboracion_hu05.py);
the translation of their errors to 409 is checked in test_persistencia_edicion_elaboracion_hu05.py.
"""

from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import Elaboracion, LoteInsumo, UsoInsumo, VersionProducto
from app.services import elaboracion_service
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    asignacion_completa,
    crear_alergenos,
    crear_elaboracion,
    crear_insumo,
    completar_insumo,
    formular,
    preparar,
    registrar,
)

HOY = date(2026, 10, 6)


@pytest.fixture(autouse=True)
def hoy_fijo(monkeypatch) -> None:
    monkeypatch.setattr(elaboracion_service, "hoy_santiago", lambda: HOY)


@pytest.fixture
def ctx(client, db_session) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["alergenos"] = crear_alergenos(db_session)
    completar_insumo(client, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    ctx["elaboracion"] = crear_elaboracion(client, headers, base["producto"]["id"], codigo="E-001").json()
    return ctx


def _url(ctx, elaboracion_id: int | None = None) -> str:
    return f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}"


def _patch(client, ctx, cuerpo: dict, elaboracion_id: int | None = None, headers=None):
    return client.patch(_url(ctx, elaboracion_id), headers=headers or ctx["headers"], json=cuerpo)


def _delete(client, ctx, elaboracion_id: int | None = None, headers=None):
    return client.delete(_url(ctx, elaboracion_id), headers=headers or ctx["headers"])


def _asignar(client, ctx, elaboracion_id: int | None = None) -> None:
    response = client.put(
        f"{_url(ctx, elaboracion_id)}/usos", headers=ctx["headers"], json={"usos": asignacion_completa(ctx)}
    )
    assert response.status_code == 200, response.text


def _finalizar(client, ctx, elaboracion_id: int | None = None):
    return client.post(f"{_url(ctx, elaboracion_id)}/finalizar", headers=ctx["headers"])


def _detalle(client, ctx, elaboracion_id: int | None = None) -> dict:
    return client.get(_url(ctx, elaboracion_id), headers=ctx["headers"]).json()


def _contar(db_session, modelo) -> int:
    db_session.expire_all()
    return db_session.scalar(select(func.count()).select_from(modelo))


def _finalizada(client, ctx) -> dict:
    _asignar(client, ctx)
    assert _finalizar(client, ctx).status_code == 200
    return _detalle(client, ctx)


# --- autenticación -----------------------------------------------------------------------


@pytest.mark.parametrize("metodo", ["patch", "delete"])
def test_las_rutas_requieren_autenticacion(client, metodo: str) -> None:
    kwargs = {"json": {}} if metodo == "patch" else {}

    assert getattr(client, metodo)("/gestion/elaboraciones/1", **kwargs).status_code == 401


# --- PT05-08: modificar un borrador ------------------------------------------------------


def test_pt05_08_modificar_el_codigo_y_la_fecha_de_un_borrador(client, ctx, db_session) -> None:
    response = _patch(client, ctx, {"codigo": "  LOTE-77 ", "fecha": "2026-10-01"})

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert (cuerpo["codigo"], cuerpo["fecha"], cuerpo["estado"]) == ("LOTE-77", "2026-10-01", "borrador")
    assert _detalle(client, ctx) == cuerpo
    db_session.expire_all()
    guardada = db_session.get(Elaboracion, ctx["elaboracion"]["id"])
    assert (guardada.codigo, str(guardada.fecha_elaboracion)) == ("LOTE-77", "2026-10-01")


def test_se_puede_modificar_solo_una_parte(client, ctx) -> None:
    solo_codigo = _patch(client, ctx, {"codigo": "E-050"}).json()
    solo_fecha = _patch(client, ctx, {"fecha": "2026-09-15"}).json()

    assert (solo_codigo["codigo"], solo_codigo["fecha"]) == ("E-050", "2026-10-06")
    assert (solo_fecha["codigo"], solo_fecha["fecha"]) == ("E-050", "2026-09-15")


def test_un_cuerpo_vacio_devuelve_la_elaboracion_sin_cambios(client, ctx) -> None:
    antes = _detalle(client, ctx)

    response = _patch(client, ctx, {})

    assert response.status_code == 200
    assert response.json() == antes


def test_modificar_no_cambia_la_asignacion_ni_la_version(client, ctx) -> None:
    _asignar(client, ctx)
    antes = _detalle(client, ctx)

    despues = _patch(client, ctx, {"codigo": "E-099", "fecha": "2026-10-02"}).json()

    assert despues["usos"] == antes["usos"]
    assert despues["version"] == antes["version"]
    assert despues["id"] == antes["id"]


@pytest.mark.parametrize("variante", ["e-001", "E-001 ", "E-001"])
def test_se_puede_reenviar_el_propio_codigo_aunque_cambie_el_formato(client, ctx, variante: str) -> None:
    response = _patch(client, ctx, {"codigo": variante})

    assert response.status_code == 200
    assert response.json()["codigo"] == variante.strip()


def test_el_codigo_de_otra_elaboracion_del_producto_responde_409_con_sugerido(client, ctx, db_session) -> None:
    otra = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-002").json()

    for repetido in ("E-002", "e-002", " E-002 "):
        response = _patch(client, ctx, {"codigo": repetido})
        assert response.status_code == 409
        assert response.json()["detail"]["codigo_sugerido"] == "E-003"
        assert repetido.strip() in response.json()["detail"]["mensaje"]

    assert _detalle(client, ctx)["codigo"] == "E-001"
    assert _detalle(client, ctx, otra["id"])["codigo"] == "E-002"


def test_el_mismo_codigo_en_otro_producto_se_permite(client, ctx) -> None:
    otro = client.post(
        "/gestion/productos",
        headers=ctx["headers"],
        json={"codigo_interno": "gal-001", "nombre": "Galletas", "descripcion": "Galletas.", "contenido_neto": "100.000", "unidad_medida": "g"},
    ).json()
    formular(client, ctx["headers"], otro["id"], ctx["harina"])
    ajena = crear_elaboracion(client, ctx["headers"], otro["id"], codigo="G-001").json()

    assert _patch(client, ctx, {"codigo": "G-001"}).status_code == 200
    assert _detalle(client, ctx, ajena["id"])["codigo"] == "G-001"


@pytest.mark.parametrize("cuerpo", [{"codigo": ""}, {"codigo": "   "}, {"codigo": "x" * 101}, {"codigo": None}])
def test_un_codigo_invalido_responde_422(client, ctx, cuerpo: dict) -> None:
    assert _patch(client, ctx, cuerpo).status_code == 422
    assert _detalle(client, ctx)["codigo"] == "E-001"


def test_una_fecha_futura_responde_422_y_no_cambia_nada(client, ctx) -> None:
    antes = _detalle(client, ctx)

    response = _patch(client, ctx, {"fecha": "2026-10-07"})

    assert response.status_code == 422
    assert response.json()["detail"] == "La fecha de elaboración no puede ser futura."
    assert _detalle(client, ctx) == antes


@pytest.mark.parametrize("cuerpo", [{"fecha": None}, {"fecha": "no-es-fecha"}, {"fecha": 20261006}, {"estado": "finalizada"}, {"usos": []}])
def test_una_fecha_invalida_o_un_campo_no_permitido_responde_422(client, ctx, cuerpo: dict) -> None:
    assert _patch(client, ctx, cuerpo).status_code == 422


def test_una_modificacion_con_un_campo_invalido_no_aplica_el_otro(client, ctx) -> None:
    """Atomic: a valid date is not applied when the code is already taken."""
    crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-002")
    antes = _detalle(client, ctx)

    assert _patch(client, ctx, {"codigo": "E-002", "fecha": "2026-09-01"}).status_code == 409

    assert _detalle(client, ctx) == antes


# --- PT05-08: eliminar un borrador -------------------------------------------------------


def test_pt05_08_eliminar_un_borrador_borra_la_elaboracion_y_sus_usos(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    assert _contar(db_session, UsoInsumo) == 2

    response = _delete(client, ctx)

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(_url(ctx), headers=ctx["headers"]).status_code == 404
    assert _contar(db_session, Elaboracion) == 0
    assert _contar(db_session, UsoInsumo) == 0
    assert client.get("/gestion/elaboraciones", headers=ctx["headers"]).json() == []


def test_eliminar_un_borrador_conserva_los_lotes_la_version_y_el_resto(client, ctx, db_session) -> None:
    _asignar(client, ctx)

    assert _delete(client, ctx).status_code == 204

    # The lot stays registered for reuse; the version stays flagged as used (a borrador used it).
    assert [lote.codigo for lote in db_session.scalars(select(LoteInsumo))] == ["X123"]
    db_session.expire_all()
    assert [(v.numero_version, v.usada_en_elaboracion) for v in db_session.scalars(select(VersionProducto))] == [(1, True)]
    assert client.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).status_code == 200


def test_eliminar_un_borrador_no_afecta_a_las_otras_elaboraciones(client, ctx, db_session) -> None:
    otra = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-002").json()
    antes = _detalle(client, ctx, otra["id"])

    assert _delete(client, ctx).status_code == 204

    assert _detalle(client, ctx, otra["id"]) == antes
    assert _contar(db_session, UsoInsumo) == 2


def test_el_codigo_de_un_borrador_eliminado_se_puede_volver_a_usar(client, ctx) -> None:
    assert _delete(client, ctx).status_code == 204

    assert crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-001").status_code == 201


def test_eliminar_dos_veces_responde_404(client, ctx) -> None:
    assert _delete(client, ctx).status_code == 204

    assert _delete(client, ctx).status_code == 404


# --- 404 ---------------------------------------------------------------------------------


def test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada(client, ctx, db_session) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    antes = _detalle(client, ctx)

    assert _patch(client, ctx, {"codigo": "ZZZ"}, headers=headers_b).status_code == 404
    assert _delete(client, ctx, headers=headers_b).status_code == 404
    assert _patch(client, ctx, {"codigo": "ZZZ"}, elaboracion_id=99999).status_code == 404
    assert _delete(client, ctx, elaboracion_id=99999).status_code == 404

    assert _detalle(client, ctx) == antes
    assert _contar(db_session, Elaboracion) == 1


# --- PT05-11: una finalizada no se modifica ni se elimina --------------------------------


def test_pt05_11_modificar_una_finalizada_responde_409_y_no_cambia_nada(client, ctx, db_session) -> None:
    antes = _finalizada(client, ctx)

    for cuerpo in ({"codigo": "OTRO"}, {"fecha": "2026-01-01"}, {"codigo": "OTRO", "fecha": "2026-01-01"}, {}):
        response = _patch(client, ctx, cuerpo)
        assert response.status_code == 409
        assert response.json()["detail"] == "La elaboración está finalizada y no puede modificarse."

    assert _detalle(client, ctx) == antes


def test_pt05_11_eliminar_una_finalizada_responde_409_y_conserva_todo(client, ctx, db_session) -> None:
    antes = _finalizada(client, ctx)

    response = _delete(client, ctx)

    assert response.status_code == 409
    assert response.json()["detail"] == "La elaboración está finalizada y no puede eliminarse."
    assert _detalle(client, ctx) == antes
    assert _contar(db_session, Elaboracion) == 1
    assert _contar(db_session, UsoInsumo) == 2


def test_una_modificacion_invalida_sobre_una_finalizada_responde_409_antes_que_validar(client, ctx) -> None:
    """The state is checked first: nothing about a finalizada depends on what is sent."""
    _finalizada(client, ctx)

    assert _patch(client, ctx, {"codigo": "x" * 100, "fecha": "2026-01-01"}).status_code == 409
    assert _patch(client, ctx, {"fecha": "2099-01-01"}).status_code == 409


def test_pt05_11_las_demas_escrituras_sobre_una_finalizada_tambien_responden_409(client, ctx) -> None:
    antes = _finalizada(client, ctx)

    asignar = client.put(f"{_url(ctx)}/usos", headers=ctx["headers"], json={"usos": asignacion_completa(ctx)})
    finalizar = _finalizar(client, ctx)

    assert (asignar.status_code, finalizar.status_code) == (409, 409)
    assert _detalle(client, ctx) == antes


def test_modificar_o_eliminar_la_finalizada_no_toca_a_las_demas(client, ctx) -> None:
    _finalizada(client, ctx)
    borrador = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], codigo="E-002").json()

    _patch(client, ctx, {"codigo": "OTRO"})
    _delete(client, ctx)

    assert _detalle(client, ctx, borrador["id"]) == borrador
    assert _patch(client, ctx, {"codigo": "E-003"}, elaboracion_id=borrador["id"]).status_code == 200
    assert _delete(client, ctx, elaboracion_id=borrador["id"]).status_code == 204
