"""Persistence, atomicity and concurrency of finalizing an elaboración (T05-04 / HU05).

Every request has its own session and the result is read with a brand new one (fixtures `api`
and `fabrica` in conftest.py), so a missing `commit` is detected. This is the critical case of
the project: a finalizada must never exist without the conserved information of every use.
The concurrency cases run on PostgreSQL only, pausing a request in the middle of the
transaction to make the race deterministic.
"""

import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.main import app
from app.models import Elaboracion, LoteInsumo, UsoInsumo
from app.repositories.elaboracion_repository import ElaboracionRepository
from app.services import elaboracion_service
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import (
    EAN_LECHE,
    Pausa,
    asignacion_completa,
    completar_insumo,
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
    completar_insumo(api, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    ctx["elaboracion"] = crear_elaboracion(api, headers, base["producto"]["id"]).json()
    return ctx


def _url(ctx, sufijo: str = "") -> str:
    return f"/gestion/elaboraciones/{ctx['elaboracion']['id']}{sufijo}"


def _asignar(api, ctx, usos: list[dict] | None = None):
    response = api.put(_url(ctx, "/usos"), headers=ctx["headers"], json={"usos": usos or asignacion_completa(ctx)})
    assert response.status_code == 200, response.text


def _finalizar(api, ctx):
    return api.post(_url(ctx, "/finalizar"), headers=ctx["headers"])


def _leer_elaboracion(fabrica, elaboracion_id: int) -> Elaboracion:
    """Read with a brand new session: only committed data is visible."""
    with fabrica() as sesion:
        elaboracion = sesion.get(Elaboracion, elaboracion_id)
        sesion.expunge(elaboracion)
    return elaboracion


def _leer_usos(fabrica, elaboracion_id: int) -> dict[int, UsoInsumo]:
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id)))
        sesion.expunge_all()
    return {uso.ingrediente_id: uso for uso in filas}


def _copias(fabrica, elaboracion_id: int) -> dict[int, dict | None]:
    return {i: uso.informacion_conservada for i, uso in _leer_usos(fabrica, elaboracion_id).items()}


def _utc(valor: datetime) -> datetime:
    return valor.replace(tzinfo=timezone.utc) if valor.tzinfo is None else valor.astimezone(timezone.utc)


def _esperado_leche(ctx, lote_id: int, conservada_en: str) -> dict:
    a = ctx["alergenos"]
    return {
        "esquema": 1,
        "conservada_en": conservada_en,
        "ingrediente": {"id": ctx["leche"]["id"], "nombre": "Leche"},
        "insumo": {
            "id": ctx["insumo_habitual"]["id"],
            "nombre": "Leche Colun Semidescremada 1 L",
            "marca_origen": "Marca",
            "presentacion": "Caja 1 L",
            "codigo_barras": EAN_LECHE,
            "ingredientes_declarados": "Leche semidescremada, vitaminas A y D",
            "advertencias": "Puede contener trazas de soya",
        },
        "alergenos": [
            {"alergeno_id": a["leche"], "codigo": "leche", "nombre": "Leche", "obligatorio_chile": True, "tipo": "contiene"},
            {"alergeno_id": a["apio"], "codigo": "apio", "nombre": "Apio", "obligatorio_chile": False, "tipo": "contiene"},
            {"alergeno_id": a["soya"], "codigo": "soya", "nombre": "Soya", "obligatorio_chile": True, "tipo": "trazas"},
        ],
        "lote": {"id": lote_id, "codigo": "X123", "fecha_vencimiento": "2026-10-15"},
        "sin_lote": False,
    }


# --- persistencia ------------------------------------------------------------------------


def test_finalizar_persiste_el_estado_la_fecha_y_el_json_completo_de_cada_uso(api, ctx, fabrica) -> None:
    _asignar(api, ctx)

    response = _finalizar(api, ctx)

    assert response.status_code == 200, response.text
    elaboracion = _leer_elaboracion(fabrica, ctx["elaboracion"]["id"])
    assert elaboracion.estado == "finalizada"
    assert elaboracion.finalizada_at is not None
    copias = _copias(fabrica, ctx["elaboracion"]["id"])
    assert set(copias) == {ctx["harina"]["id"], ctx["leche"]["id"]}
    with fabrica() as sesion:
        lote_id = sesion.scalar(select(LoteInsumo.id))
    leche = copias[ctx["leche"]["id"]]
    conservada_en = leche["conservada_en"]
    assert conservada_en.endswith("Z")
    assert _utc(datetime.fromisoformat(conservada_en.replace("Z", "+00:00"))) == _utc(elaboracion.finalizada_at)
    assert leche == _esperado_leche(ctx, lote_id, conservada_en)
    harina = copias[ctx["harina"]["id"]]
    assert harina["conservada_en"] == conservada_en
    assert harina["insumo"]["id"] == ctx["insumo_harina"]["id"]
    assert (harina["lote"], harina["sin_lote"], harina["alergenos"]) == (None, True, [])
    assert all("ficha" not in copia["insumo"] for copia in copias.values())


def test_no_se_finaliza_nada_si_la_validacion_falla(api, ctx, fabrica) -> None:
    assert _finalizar(api, ctx).status_code == 409

    elaboracion = _leer_elaboracion(fabrica, ctx["elaboracion"]["id"])
    assert (elaboracion.estado, elaboracion.finalizada_at) == ("borrador", None)
    assert all(copia is None for copia in _copias(fabrica, ctx["elaboracion"]["id"]).values())


def test_el_json_y_el_detalle_no_cambian_aunque_cambie_todo_lo_demas(api, ctx, fabrica) -> None:
    """PT05-12 / CA13 with an independent reader: modify the supply, its allergens, deactivate it
    and the ingredient, and even touch the lot row: what was conserved is identical afterwards."""
    _asignar(api, ctx)
    inmediato = _finalizar(api, ctx).json()
    copias_antes = _copias(fabrica, ctx["elaboracion"]["id"])
    detalle_antes = api.get(_url(ctx), headers=ctx["headers"]).json()
    assert detalle_antes == inmediato

    insumo = f"/gestion/insumos/{ctx['insumo_habitual']['id']}"
    cambios = {
        "nombre": "Otro nombre",
        "marca_origen": "Otra marca",
        "presentacion": "Otra",
        "codigo_barras": "4006381333931",
        "ingredientes_declarados": "Otros",
        "advertencias": None,
    }
    assert api.patch(insumo, headers=ctx["headers"], json=cambios).status_code == 200
    assert api.patch(f"{insumo}/alergenos/{ctx['alergenos']['leche']}", headers=ctx["headers"], json={"tipo": "trazas"}).status_code == 200
    assert api.delete(f"{insumo}/alergenos/{ctx['alergenos']['apio']}", headers=ctx["headers"]).status_code == 204
    assert api.delete(insumo, headers=ctx["headers"]).status_code == 204
    assert api.delete(f"/gestion/ingredientes/{ctx['leche']['id']}", headers=ctx["headers"]).status_code == 204
    with fabrica() as sesion:
        sesion.execute(update(LoteInsumo).values(codigo="CAMBIADO", fecha_vencimiento=None))
        sesion.commit()

    assert _copias(fabrica, ctx["elaboracion"]["id"]) == copias_antes
    assert api.get(_url(ctx), headers=ctx["headers"]).json() == detalle_antes
    elaboracion = _leer_elaboracion(fabrica, ctx["elaboracion"]["id"])
    assert elaboracion.estado == "finalizada"


# --- atomicidad --------------------------------------------------------------------------


def test_una_falla_a_mitad_de_la_copia_deja_el_borrador_intacto(api, ctx, fabrica, monkeypatch) -> None:
    """The copy of the second use blows up: no use keeps a copy and the state stays borrador."""
    _asignar(api, ctx)
    antes = {i: (u.insumo_id, u.lote_id, u.sin_lote) for i, u in _leer_usos(fabrica, ctx["elaboracion"]["id"]).items()}
    original = elaboracion_service.construir_informacion_conservada
    llamadas: list[int] = []

    def falla_en_la_segunda(*args, **kwargs):
        llamadas.append(1)
        if len(llamadas) == 2:
            raise RuntimeError("falla simulada al copiar el segundo uso")
        return original(*args, **kwargs)

    monkeypatch.setattr(elaboracion_service, "construir_informacion_conservada", falla_en_la_segunda)

    with pytest.raises(RuntimeError, match="falla simulada"):
        _finalizar(api, ctx)

    assert len(llamadas) == 2
    elaboracion = _leer_elaboracion(fabrica, ctx["elaboracion"]["id"])
    assert (elaboracion.estado, elaboracion.finalizada_at) == ("borrador", None)
    assert all(copia is None for copia in _copias(fabrica, ctx["elaboracion"]["id"]).values())
    assert {i: (u.insumo_id, u.lote_id, u.sin_lote) for i, u in _leer_usos(fabrica, ctx["elaboracion"]["id"]).items()} == antes
    # Nothing was left half done: finalizing again works.
    monkeypatch.setattr(elaboracion_service, "construir_informacion_conservada", original)
    assert _finalizar(api, ctx).status_code == 200
    assert all(copia is not None for copia in _copias(fabrica, ctx["elaboracion"]["id"]).values())


def test_el_estado_se_cambia_despues_de_escribir_las_copias(api, ctx, monkeypatch) -> None:
    """When the state is set, every use already carries its copy (and the state is still borrador)."""
    _asignar(api, ctx)
    original = ElaboracionRepository.marcar_finalizada
    vistos: list[tuple[int, str]] = []

    def espia(self, elaboracion, finalizada_at):
        usos = self.db.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion.id)).all()
        vistos.append((sum(1 for uso in usos if uso.informacion_conservada is not None), elaboracion.estado))
        return original(self, elaboracion, finalizada_at)

    monkeypatch.setattr(ElaboracionRepository, "marcar_finalizada", espia)

    assert _finalizar(api, ctx).status_code == 200

    assert vistos == [(2, "borrador")]


# --- concurrencia (PostgreSQL) -----------------------------------------------------------


def _finalizacion_pausada(monkeypatch, ctx, cuerpo_concurrente) -> tuple[dict, bool]:
    """Pause the finalization right after it locked the supplies and run `cuerpo_concurrente`
    in another request. Returns the responses and whether that request finished during the pause."""
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "lock_insumos_compartido")
    resultados: list = []
    h1 = en_hilo(
        resultados,
        "finalizacion",
        lambda: TestClient(app).post(_url(ctx, "/finalizar"), headers=ctx["headers"]),
    )
    assert pausa.leido.wait(timeout=20)
    h2 = en_hilo(resultados, "concurrente", lambda: cuerpo_concurrente(TestClient(app)))
    time.sleep(1.0)
    termino_durante_la_pausa = any(clave == "concurrente" for clave, _ in resultados)
    pausa.continuar.set()
    h1.join(timeout=30)
    h2.join(timeout=30)
    return {clave: valor for clave, valor in resultados}, termino_durante_la_pausa


@solo_postgresql
def test_una_edicion_del_insumo_espera_a_que_termine_la_finalizacion(api, ctx, fabrica, monkeypatch) -> None:
    """The supplies are locked FOR SHARE: the edit waits, so the copy is the supply as it was when
    the elaboración was finalized, and the edit applies right after."""
    _asignar(api, ctx)
    insumo = f"/gestion/insumos/{ctx['insumo_habitual']['id']}"

    respuestas, durante_la_pausa = _finalizacion_pausada(
        monkeypatch,
        ctx,
        lambda cliente: cliente.patch(insumo, headers=ctx["headers"], json={"nombre": "Nombre nuevo"}),
    )

    assert durante_la_pausa is False, "la edición no debió terminar mientras la finalización retenía el bloqueo"
    assert respuestas["finalizacion"].status_code == 200
    assert respuestas["concurrente"].status_code == 200
    copia = _copias(fabrica, ctx["elaboracion"]["id"])[ctx["leche"]["id"]]
    assert copia["insumo"]["nombre"] == "Leche Colun Semidescremada 1 L"
    assert api.get(insumo, headers=ctx["headers"]).json()["nombre"] == "Nombre nuevo"
    detalle = api.get(_url(ctx), headers=ctx["headers"]).json()
    assert [u["insumo"]["nombre"] for u in detalle["usos"] if u["ingrediente_id"] == ctx["leche"]["id"]] == [
        "Leche Colun Semidescremada 1 L"
    ]


@solo_postgresql
def test_un_cambio_de_alergenos_espera_a_que_termine_la_finalizacion(api, ctx, fabrica, monkeypatch) -> None:
    _asignar(api, ctx)
    alergenos = f"/gestion/insumos/{ctx['insumo_habitual']['id']}/alergenos/{ctx['alergenos']['apio']}"

    respuestas, durante_la_pausa = _finalizacion_pausada(
        monkeypatch, ctx, lambda cliente: cliente.delete(alergenos, headers=ctx["headers"])
    )

    assert durante_la_pausa is False
    assert respuestas["finalizacion"].status_code == 200
    assert respuestas["concurrente"].status_code == 204
    copia = _copias(fabrica, ctx["elaboracion"]["id"])[ctx["leche"]["id"]]
    assert [a["codigo"] for a in copia["alergenos"]] == ["leche", "apio", "soya"]
    assert [
        a["codigo"] for a in api.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}/alergenos", headers=ctx["headers"]).json()
    ] == ["leche", "soya"]


@solo_postgresql
def test_un_cambio_de_la_asignacion_durante_la_finalizacion_espera_y_se_rechaza(api, ctx, fabrica, monkeypatch) -> None:
    """The elaboración row is locked: a concurrent assignment waits and then finds it finalized."""
    _asignar(api, ctx)
    cambiada = asignacion_completa(ctx)
    cambiada[1] = {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_otro"]["id"], "lote": {"tipo": "sin_lote"}}

    respuestas, durante_la_pausa = _finalizacion_pausada(
        monkeypatch,
        ctx,
        lambda cliente: cliente.put(_url(ctx, "/usos"), headers=ctx["headers"], json={"usos": cambiada}),
    )

    assert durante_la_pausa is False
    assert respuestas["finalizacion"].status_code == 200
    assert respuestas["concurrente"].status_code == 409
    copia = _copias(fabrica, ctx["elaboracion"]["id"])[ctx["leche"]["id"]]
    assert copia["insumo"]["id"] == ctx["insumo_habitual"]["id"]
    assert _leer_usos(fabrica, ctx["elaboracion"]["id"])[ctx["leche"]["id"]].insumo_id == ctx["insumo_habitual"]["id"]
