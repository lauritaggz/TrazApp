"""Persistence and locking of the allergen review in the finalization (HT06-03).

Every request has its own session and the result is read with a brand new one (fixtures `api` and
`fabrica`), so what the copy keeps is what was really committed. The locking case runs on
PostgreSQL only.
"""

import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.main import app
from app.models import Elaboracion, InsumoComercial, UsoInsumo
from app.repositories.elaboracion_repository import ElaboracionRepository
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import (
    Pausa,
    asignacion_completa,
    crear_alergenos,
    crear_elaboracion,
    crear_insumo,
    en_hilo,
    preparar,
    registrar,
)

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Los bloqueos de fila y las conexiones simultáneas requieren PostgreSQL.",
)


@pytest.fixture
def ctx(api, fabrica) -> dict:
    headers = registrar(api)
    base = preparar(api, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(api, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    with fabrica() as sesion:
        ctx["alergenos"] = crear_alergenos(sesion)
    ctx["elaboracion"] = crear_elaboracion(api, headers, base["producto"]["id"]).json()
    return ctx


def _url(ctx, sufijo: str = "") -> str:
    return f"/gestion/elaboraciones/{ctx['elaboracion']['id']}{sufijo}"


def _asignar(api, ctx) -> None:
    respuesta = api.put(_url(ctx, "/usos"), headers=ctx["headers"], json={"usos": asignacion_completa(ctx)})
    assert respuesta.status_code == 200, respuesta.text


def _finalizar(api, ctx):
    return api.post(_url(ctx, "/finalizar"), headers=ctx["headers"])


def _sin_revisar(fabrica, insumo_id: int) -> None:
    with fabrica() as sesion:
        sesion.execute(update(InsumoComercial).where(InsumoComercial.id == insumo_id).values(alergenos_revisados_at=None))
        sesion.commit()


def _revision_del_insumo(fabrica, insumo_id: int) -> datetime | None:
    with fabrica() as sesion:
        fecha = sesion.get(InsumoComercial, insumo_id).alergenos_revisados_at
    return None if fecha is None else _utc(fecha)


def _utc(fecha: datetime) -> datetime:
    return fecha.replace(tzinfo=timezone.utc) if fecha.tzinfo is None else fecha.astimezone(timezone.utc)


def _copias(fabrica, elaboracion_id: int) -> dict[int, dict | None]:
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id)))
        return {uso.ingrediente_id: uso.informacion_conservada for uso in filas}


def _estado(fabrica, elaboracion_id: int) -> str:
    with fabrica() as sesion:
        return sesion.get(Elaboracion, elaboracion_id).estado


# --- persistencia --------------------------------------------------------------------------


def test_la_fecha_de_revision_queda_guardada_en_la_copia_de_cada_uso(api, ctx, fabrica) -> None:
    _asignar(api, ctx)
    fechas = {
        clave: _revision_del_insumo(fabrica, ctx[clave]["id"]) for clave in ("insumo_habitual", "insumo_harina")
    }
    assert all(fecha is not None for fecha in fechas.values())

    assert _finalizar(api, ctx).status_code == 200

    copias = _copias(fabrica, ctx["elaboracion"]["id"])
    for ingrediente, clave in (("leche", "insumo_habitual"), ("harina", "insumo_harina")):
        guardada = copias[ctx[ingrediente]["id"]]["alergenos_revisados_at"]
        assert guardada.endswith("Z")
        assert _utc(datetime.fromisoformat(guardada.replace("Z", "+00:00"))) == fechas[clave]


def test_revisar_el_insumo_despues_de_finalizar_no_cambia_lo_guardado(api, ctx, fabrica) -> None:
    _asignar(api, ctx)
    assert _finalizar(api, ctx).status_code == 200
    copias = _copias(fabrica, ctx["elaboracion"]["id"])
    detalle = api.get(_url(ctx), headers=ctx["headers"]).json()
    fecha_original = copias[ctx["leche"]["id"]]["alergenos_revisados_at"]

    # The supply is reviewed again, with other allergens, and later still.
    for lista in ([{"alergeno_id": ctx["alergenos"]["apio"], "tipo": "contiene"}], []):
        respuesta = api.put(
            f"/gestion/insumos/{ctx['insumo_habitual']['id']}/alergenos",
            headers=ctx["headers"],
            json={"alergenos": lista},
        )
        assert respuesta.status_code == 200
    nueva = _revision_del_insumo(fabrica, ctx["insumo_habitual"]["id"])

    assert nueva >= _utc(datetime.fromisoformat(fecha_original.replace("Z", "+00:00")))
    assert _copias(fabrica, ctx["elaboracion"]["id"]) == copias
    assert copias[ctx["leche"]["id"]]["alergenos_revisados_at"] == fecha_original
    assert api.get(_url(ctx), headers=ctx["headers"]).json() == detalle


def test_un_bloqueo_por_alergenos_sin_revisar_no_deja_copias_ni_cambia_el_estado(api, ctx, fabrica) -> None:
    _asignar(api, ctx)
    _sin_revisar(fabrica, ctx["insumo_habitual"]["id"])

    respuesta = _finalizar(api, ctx)

    assert respuesta.status_code == 409
    assert [p["falta"] for p in respuesta.json()["detail"]["problemas"]] == ["alergenos_sin_revisar"]
    assert _estado(fabrica, ctx["elaboracion"]["id"]) == "borrador"
    assert all(copia is None for copia in _copias(fabrica, ctx["elaboracion"]["id"]).values())


# --- bloqueo (PostgreSQL) --------------------------------------------------------------------


@solo_postgresql
def test_la_revision_se_evalua_con_el_insumo_bloqueado_y_una_revision_concurrente_espera(
    api, ctx, fabrica, monkeypatch
) -> None:
    """The supplies are locked FOR SHARE before the lines are checked: a review that arrives in the
    middle waits, the finalization decides with the state it locked, and the review applies after."""
    _asignar(api, ctx)
    _sin_revisar(fabrica, ctx["insumo_habitual"]["id"])
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "lock_insumos_compartido")
    resultados: list = []

    h1 = en_hilo(
        resultados,
        "finalizacion",
        lambda: TestClient(app).post(_url(ctx, "/finalizar"), headers=ctx["headers"]),
    )
    assert pausa.leido.wait(timeout=20)
    h2 = en_hilo(
        resultados,
        "revision",
        lambda: TestClient(app).put(
            f"/gestion/insumos/{ctx['insumo_habitual']['id']}/alergenos",
            headers=ctx["headers"],
            json={"alergenos": []},
        ),
    )
    time.sleep(1.0)
    termino_durante_la_pausa = any(clave == "revision" for clave, _ in resultados)
    pausa.continuar.set()
    h1.join(timeout=30)
    h2.join(timeout=30)
    respuestas = {clave: valor for clave, valor in resultados}

    assert termino_durante_la_pausa is False, "la revisión no debió terminar mientras la finalización retenía el insumo"
    assert respuestas["finalizacion"].status_code == 409
    assert [p["falta"] for p in respuestas["finalizacion"].json()["detail"]["problemas"]] == ["alergenos_sin_revisar"]
    assert respuestas["revision"].status_code == 200
    assert _revision_del_insumo(fabrica, ctx["insumo_habitual"]["id"]) is not None
    assert _finalizar(api, ctx).status_code == 200
