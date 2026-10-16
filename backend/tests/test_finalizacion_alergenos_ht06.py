"""Finalizing requires the allergens of every supply to be reviewed (HT06-03).

The new problem `alergenos_sin_revisar` in the 409 of POST /gestion/elaboraciones/{id}/finalizar,
the review date kept in the conserved copy and exposed by the detail. These tests share one session
between the request and the assertions; the persistence and locking cases are in
test_persistencia_finalizacion_alergenos_ht06.py.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import select, text, update

from app.models import InsumoComercial, UsoInsumo
from tests.escenario_hu05 import (
    asignacion_completa,
    crear_alergenos,
    crear_elaboracion,
    crear_insumo,
    preparar,
    registrar,
)

ESTRUCTURA_DEL_PROBLEMA = {"ingrediente_id", "ingrediente_nombre", "falta"}


@pytest.fixture
def ctx(client, db_session) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["alergenos"] = crear_alergenos(db_session)
    ctx["elaboracion"] = crear_elaboracion(client, headers, base["producto"]["id"]).json()
    return ctx


def _url(ctx, sufijo: str = "") -> str:
    return f"/gestion/elaboraciones/{ctx['elaboracion']['id']}{sufijo}"


def _asignar(client, ctx, usos: list[dict] | None = None):
    response = client.put(
        _url(ctx, "/usos"), headers=ctx["headers"], json={"usos": usos if usos is not None else asignacion_completa(ctx)}
    )
    assert response.status_code == 200, response.text


def _finalizar(client, ctx):
    return client.post(_url(ctx, "/finalizar"), headers=ctx["headers"])


def _detalle(client, ctx) -> dict:
    return client.get(_url(ctx), headers=ctx["headers"]).json()


def _problemas(respuesta) -> list[dict]:
    assert respuesta.status_code == 409, respuesta.text
    detalle = respuesta.json()["detail"]
    assert detalle["mensaje"] == (
        "No se puede finalizar la elaboración: hay ingredientes con información pendiente o no disponible."
    )
    return detalle["problemas"]


def _pares(problemas: list[dict]) -> list[tuple[str, str]]:
    return [(p["ingrediente_nombre"], p["falta"]) for p in problemas]


def _sin_revisar(db_session, insumo_id: int) -> None:
    """The API cannot un-review a supply: put it back to "never reviewed" in the database."""
    db_session.execute(update(InsumoComercial).where(InsumoComercial.id == insumo_id).values(alergenos_revisados_at=None))
    db_session.commit()
    db_session.expire_all()


def _revisar(client, ctx, insumo_id: int, alergenos: list[dict] | None = None):
    respuesta = client.put(
        f"/gestion/insumos/{insumo_id}/alergenos", headers=ctx["headers"], json={"alergenos": alergenos or []}
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _fecha_utc(texto: str) -> datetime:
    fecha = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    return fecha.replace(tzinfo=timezone.utc) if fecha.tzinfo is None else fecha.astimezone(timezone.utc)


def _copias(db_session) -> dict[int, dict | None]:
    db_session.expire_all()
    return {uso.ingrediente_id: uso.informacion_conservada for uso in db_session.scalars(select(UsoInsumo))}


def _estado_sin_cambios(client, ctx, db_session, antes: dict) -> None:
    assert _detalle(client, ctx) == antes
    assert all(copia is None for copia in _copias(db_session).values())


# --- el bloqueo ---------------------------------------------------------------------------


def test_no_finaliza_con_un_insumo_sin_revisar_y_el_409_indica_la_linea(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])
    antes = _detalle(client, ctx)

    respuesta = _finalizar(client, ctx)

    assert _problemas(respuesta) == [
        {"ingrediente_id": ctx["leche"]["id"], "ingrediente_nombre": "Leche", "falta": "alergenos_sin_revisar"}
    ]
    assert antes["estado"] == "borrador" and _detalle(client, ctx)["estado"] == "borrador"
    _estado_sin_cambios(client, ctx, db_session, antes)


def test_el_problema_tiene_la_misma_estructura_que_los_demas(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])

    problemas = _problemas(_finalizar(client, ctx))

    assert all(set(problema) == ESTRUCTURA_DEL_PROBLEMA for problema in problemas)
    assert "tipo" not in problemas[0]


def test_un_insumo_creado_sin_alergenos_no_deja_finalizar_hasta_revisarlo(client, ctx) -> None:
    sin_revisar = crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Harina sin revisar", revisado=False)
    usos = asignacion_completa(ctx)
    usos[0] = {"ingrediente_id": ctx["harina"]["id"], "insumo_id": sin_revisar["id"], "lote": {"tipo": "sin_lote"}}
    _asignar(client, ctx, usos)

    assert _pares(_problemas(_finalizar(client, ctx))) == [("Harina", "alergenos_sin_revisar")]

    _revisar(client, ctx, sin_revisar["id"])
    assert _finalizar(client, ctx).status_code == 200


def test_finaliza_cuando_todos_los_insumos_estan_revisados_incluido_revisado_sin_alergenos(
    client, ctx, db_session
) -> None:
    # Leche with allergens, harina "reviewed, no allergens" (created with an empty list).
    _revisar(client, ctx, ctx["insumo_habitual"]["id"], [{"alergeno_id": ctx["alergenos"]["leche"], "tipo": "contiene"}])
    _asignar(client, ctx)

    respuesta = _finalizar(client, ctx)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["estado"] == "finalizada"
    copias = _copias(db_session)
    assert copias[ctx["harina"]["id"]]["alergenos"] == []
    assert copias[ctx["leche"]["id"]]["alergenos"][0]["codigo"] == "leche"
    assert all(copia["alergenos_revisados_at"] is not None for copia in copias.values())


def test_corregir_la_revision_permite_finalizar(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])
    assert _finalizar(client, ctx).status_code == 409

    _revisar(client, ctx, ctx["insumo_habitual"]["id"])

    assert _finalizar(client, ctx).status_code == 200


# --- cuándo NO se reporta -----------------------------------------------------------------


def test_no_se_reporta_alergenos_sin_revisar_si_la_linea_no_tiene_insumo(client, ctx, db_session) -> None:
    usos = asignacion_completa(ctx)
    usos[0] = {"ingrediente_id": ctx["harina"]["id"], "insumo_id": None}
    _asignar(client, ctx, usos)
    _sin_revisar(db_session, ctx["insumo_harina"]["id"])  # the supply it would have used is unreviewed

    assert _pares(_problemas(_finalizar(client, ctx))) == [("Harina", "insumo")]


def test_no_se_reporta_alergenos_sin_revisar_si_el_insumo_esta_desactivado(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_harina"]["id"])
    assert client.delete(f"/gestion/insumos/{ctx['insumo_harina']['id']}", headers=ctx["headers"]).status_code == 204

    assert _pares(_problemas(_finalizar(client, ctx))) == [("Harina", "insumo_desactivado")]


def test_con_el_ingrediente_desactivado_y_el_insumo_activo_sin_revisar_se_informan_ambos(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_harina"]["id"])
    client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"])

    assert _pares(_problemas(_finalizar(client, ctx))) == [
        ("Harina", "ingrediente_desactivado"),
        ("Harina", "alergenos_sin_revisar"),
    ]


# --- varios problemas juntos ----------------------------------------------------------------


def test_varios_problemas_se_devuelven_todos_juntos_y_en_el_orden_de_la_formulacion(client, ctx, db_session) -> None:
    usos = [
        {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": {"tipo": "sin_lote"}},
        {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_habitual"]["id"]},  # no lot yet
    ]
    _asignar(client, ctx, usos)
    _sin_revisar(db_session, ctx["insumo_harina"]["id"])
    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])
    client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"])

    problemas = _problemas(_finalizar(client, ctx))

    # Formulation order (harina, leche); inside a line the existing problems keep their order and the
    # new one comes last.
    assert _pares(problemas) == [
        ("Harina", "ingrediente_desactivado"),
        ("Harina", "alergenos_sin_revisar"),
        ("Leche", "lote"),
        ("Leche", "alergenos_sin_revisar"),
    ]
    assert all(set(p) == ESTRUCTURA_DEL_PROBLEMA for p in problemas)


def test_varias_lineas_sin_revisar_se_informan_cada_una(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _sin_revisar(db_session, ctx["insumo_harina"]["id"])
    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])

    assert _pares(_problemas(_finalizar(client, ctx))) == [
        ("Harina", "alergenos_sin_revisar"),
        ("Leche", "alergenos_sin_revisar"),
    ]


# --- la copia y el detalle -------------------------------------------------------------------


def test_la_copia_conserva_la_fecha_de_revision_del_insumo_de_cada_linea(client, ctx, db_session) -> None:
    _revisar(client, ctx, ctx["insumo_habitual"]["id"], [{"alergeno_id": ctx["alergenos"]["apio"], "tipo": "trazas"}])
    _asignar(client, ctx)
    fechas = {
        clave: client.get(f"/gestion/insumos/{ctx[clave]['id']}", headers=ctx["headers"]).json()["alergenos_revisados_at"]
        for clave in ("insumo_habitual", "insumo_harina")
    }

    assert _finalizar(client, ctx).status_code == 200

    copias = _copias(db_session)
    leche, harina = copias[ctx["leche"]["id"]], copias[ctx["harina"]["id"]]
    for copia, clave in ((leche, "insumo_habitual"), (harina, "insumo_harina")):
        assert copia["alergenos_revisados_at"].endswith("Z")
        assert _fecha_utc(copia["alergenos_revisados_at"]) == _fecha_utc(fechas[clave])
    assert harina["alergenos"] == []  # "reviewed, no allergens" keeps its date too


def test_el_detalle_de_una_finalizada_expone_la_fecha_por_linea(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    assert _finalizar(client, ctx).status_code == 200
    copias = _copias(db_session)

    usos = {uso["ingrediente_id"]: uso for uso in _detalle(client, ctx)["usos"]}

    for ingrediente in ("leche", "harina"):
        copia = copias[ctx[ingrediente]["id"]]
        assert _fecha_utc(usos[ctx[ingrediente]["id"]]["insumo"]["alergenos_revisados_at"]) == _fecha_utc(
            copia["alergenos_revisados_at"]
        )


def test_una_finalizada_sin_la_clave_se_lee_con_null_y_no_es_un_error(client, ctx, db_session) -> None:
    """Elaboraciones finalized before HT06 have no review date: they read as null, never as an error."""
    _asignar(client, ctx)
    assert _finalizar(client, ctx).status_code == 200
    copias = _copias(db_session)
    antiguas = {
        ingrediente: {clave: valor for clave, valor in copia.items() if clave != "alergenos_revisados_at"}
        for ingrediente, copia in copias.items()
    }
    postgresql = db_session.get_bind().dialect.name == "postgresql"
    if postgresql:  # the trigger forbids touching the uses of a finalizada: lift it, and put it back
        db_session.execute(text("ALTER TABLE usos_insumo DISABLE TRIGGER trg_usos_insumo_elaboracion_abierta"))
        db_session.commit()
    try:
        for ingrediente, copia in antiguas.items():
            db_session.execute(
                update(UsoInsumo).where(UsoInsumo.ingrediente_id == ingrediente).values(informacion_conservada=copia)
            )
        db_session.commit()
    finally:
        db_session.rollback()
        if postgresql:
            db_session.execute(text("ALTER TABLE usos_insumo ENABLE TRIGGER trg_usos_insumo_elaboracion_abierta"))
            db_session.commit()
    assert all("alergenos_revisados_at" not in copia for copia in _copias(db_session).values())

    respuesta = client.get(_url(ctx), headers=ctx["headers"])

    assert respuesta.status_code == 200
    usos = respuesta.json()["usos"]
    assert len(usos) == 2
    assert all(uso["insumo"]["alergenos_revisados_at"] is None for uso in usos)
    assert all(uso["insumo"]["nombre"] for uso in usos)  # the rest of the copy reads as before


def test_el_detalle_de_un_borrador_muestra_la_fecha_vigente_del_insumo(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    leche = lambda: {u["ingrediente_id"]: u for u in _detalle(client, ctx)["usos"]}[ctx["leche"]["id"]]  # noqa: E731
    assert leche()["insumo"]["alergenos_revisados_at"] is not None

    _sin_revisar(db_session, ctx["insumo_habitual"]["id"])
    assert leche()["insumo"]["alergenos_revisados_at"] is None

    revisado = _revisar(client, ctx, ctx["insumo_habitual"]["id"])
    assert _fecha_utc(leche()["insumo"]["alergenos_revisados_at"]) == _fecha_utc(revisado["alergenos_revisados_at"])


def test_revisar_el_insumo_despues_de_finalizar_no_cambia_la_copia_ni_el_detalle(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    assert _finalizar(client, ctx).status_code == 200
    antes = (_detalle(client, ctx), _copias(db_session))

    _revisar(client, ctx, ctx["insumo_habitual"]["id"], [{"alergeno_id": ctx["alergenos"]["soya"], "tipo": "contiene"}])
    _revisar(client, ctx, ctx["insumo_harina"]["id"])

    assert (_detalle(client, ctx), _copias(db_session)) == antes
