"""Persistence of the assignment of supplies and lots, read from an independent session (T05-03).

Same setup as test_persistencia_elaboraciones_hu05.py: every request has its own session and the
result is read with a brand new one, so a missing `commit` is detected, and so is a validation
failure that leaves half of the changes behind. The concurrency cases run on PostgreSQL only.
"""

import threading
import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.models import LoteInsumo, UsoInsumo
from app.repositories.elaboracion_repository import ElaboracionRepository
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    Pausa,
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
def ctx(api) -> dict:
    headers = registrar(api)
    base = preparar(api, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(api, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["elaboracion"] = crear_elaboracion(api, headers, base["producto"]["id"]).json()
    return ctx


def _put(api, ctx, usos: list[dict], elaboracion_id: int | None = None):
    return api.put(
        f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}/usos",
        headers=ctx["headers"],
        json={"usos": usos},
    )


def _asignacion(ctx, *, harina_lote=None, leche_insumo=None, leche_lote=None) -> list[dict]:
    harina = {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"]}
    if harina_lote is not None:
        harina["lote"] = harina_lote
    leche = {"ingrediente_id": ctx["leche"]["id"], "insumo_id": leche_insumo or ctx["insumo_habitual"]["id"]}
    if leche_lote is not None:
        leche["lote"] = leche_lote
    return [harina, leche]


NUEVO_X123 = {"tipo": "nuevo", "codigo": "X123", "fecha_vencimiento": "2026-10-15"}
SIN_LOTE = {"tipo": "sin_lote"}


def _leer_usos(fabrica, elaboracion_id: int) -> dict[int, UsoInsumo]:
    """Read with a brand new session: only committed data is visible."""
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id)))
        sesion.expunge_all()
    return {uso.ingrediente_id: uso for uso in filas}


def _leer_lotes(fabrica) -> list[LoteInsumo]:
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(LoteInsumo).order_by(LoteInsumo.id)))
        sesion.expunge_all()
    return filas


def _estado(usos: dict[int, UsoInsumo]) -> dict[int, tuple]:
    return {i: (uso.insumo_id, uso.lote_id, uso.sin_lote) for i, uso in usos.items()}


# --- persistencia ------------------------------------------------------------------------


def test_asignar_con_lote_nuevo_persiste_el_lote_y_el_uso(api, ctx, fabrica) -> None:
    response = _put(api, ctx, _asignacion(ctx, leche_lote=NUEVO_X123, harina_lote=SIN_LOTE))

    assert response.status_code == 200, response.text
    [lote] = _leer_lotes(fabrica)
    assert (lote.insumo_id, lote.codigo, str(lote.fecha_vencimiento)) == (ctx["insumo_habitual"]["id"], "X123", "2026-10-15")
    usos = _leer_usos(fabrica, ctx["elaboracion"]["id"])
    leche = usos[ctx["leche"]["id"]]
    assert (leche.insumo_id, leche.lote_id, leche.sin_lote) == (ctx["insumo_habitual"]["id"], lote.id, False)
    harina = usos[ctx["harina"]["id"]]
    assert (harina.insumo_id, harina.lote_id, harina.sin_lote) == (ctx["insumo_harina"]["id"], None, True)


def test_reutilizar_un_lote_persiste_la_referencia_sin_duplicarlo(api, ctx, fabrica) -> None:
    _put(api, ctx, _asignacion(ctx, leche_lote=NUEVO_X123))
    [lote] = _leer_lotes(fabrica)
    segunda = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"]).json()

    response = _put(
        api, ctx, _asignacion(ctx, leche_lote={"tipo": "existente", "lote_id": lote.id}), elaboracion_id=segunda["id"]
    )

    assert response.status_code == 200, response.text
    assert [fila.id for fila in _leer_lotes(fabrica)] == [lote.id]
    for elaboracion_id in (ctx["elaboracion"]["id"], segunda["id"]):
        assert _leer_usos(fabrica, elaboracion_id)[ctx["leche"]["id"]].lote_id == lote.id


def test_asignar_sin_lote_persiste_el_indicador_y_el_insumo(api, ctx, fabrica) -> None:
    assert _put(api, ctx, _asignacion(ctx, harina_lote=SIN_LOTE, leche_lote=SIN_LOTE)).status_code == 200

    usos = _leer_usos(fabrica, ctx["elaboracion"]["id"])

    assert _estado(usos) == {
        ctx["harina"]["id"]: (ctx["insumo_harina"]["id"], None, True),
        ctx["leche"]["id"]: (ctx["insumo_habitual"]["id"], None, True),
    }
    assert _leer_lotes(fabrica) == []


def test_reemplazar_la_asignacion_persiste_el_cambio_de_insumo_y_de_lote(api, ctx, fabrica) -> None:
    _put(api, ctx, _asignacion(ctx, leche_lote=NUEVO_X123))

    response = _put(api, ctx, _asignacion(ctx, leche_insumo=ctx["insumo_otro"]["id"], leche_lote=SIN_LOTE))

    assert response.status_code == 200
    leche = _leer_usos(fabrica, ctx["elaboracion"]["id"])[ctx["leche"]["id"]]
    assert (leche.insumo_id, leche.lote_id, leche.sin_lote) == (ctx["insumo_otro"]["id"], None, True)


def test_un_avance_parcial_persiste_lo_pendiente(api, ctx, fabrica) -> None:
    response = _put(
        api,
        ctx,
        [
            {"ingrediente_id": ctx["harina"]["id"], "insumo_id": None},
            {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_otro"]["id"]},
        ],
    )

    assert response.status_code == 200
    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == {
        ctx["harina"]["id"]: (None, None, False),
        ctx["leche"]["id"]: (ctx["insumo_otro"]["id"], None, False),
    }


# --- un fallo no deja cambios a medias ---------------------------------------------------


def test_un_fallo_de_validacion_no_deja_cambios_a_medias(api, ctx, fabrica) -> None:
    _put(api, ctx, _asignacion(ctx, leche_lote=SIN_LOTE, harina_lote=SIN_LOTE))
    antes = _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"]))

    # The first entry is valid and creates a lot; the second uses a supply of another ingredient.
    invalida = [
        {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": NUEVO_X123},
        {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": SIN_LOTE},
    ]
    assert _put(api, ctx, invalida).status_code == 422

    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == antes
    assert _leer_lotes(fabrica) == []


def test_un_lote_repetido_no_deja_cambios_a_medias(api, ctx, fabrica) -> None:
    _put(api, ctx, _asignacion(ctx, leche_lote=NUEVO_X123, harina_lote=SIN_LOTE))
    antes = _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"]))

    repetido = _asignacion(
        ctx,
        harina_lote={"tipo": "nuevo", "codigo": "H-1"},
        leche_lote={"tipo": "nuevo", "codigo": "x123"},
    )
    assert _put(api, ctx, repetido).status_code == 409

    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == antes
    assert [lote.codigo for lote in _leer_lotes(fabrica)] == ["X123"]


def test_la_base_respalda_la_unicidad_del_lote_si_la_comprobacion_previa_no_la_ve(api, ctx, fabrica, monkeypatch) -> None:
    """If two requests slipped past the pre-check, the unique index still rejects the second lot
    and the answer is the same 409 that offers the existing lot."""
    _put(api, ctx, _asignacion(ctx, leche_lote=NUEVO_X123, harina_lote=SIN_LOTE))
    [lote] = _leer_lotes(fabrica)
    antes = _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"]))
    original = ElaboracionRepository.find_lote_by_codigo
    ciegas: list[str] = []

    def ciega_con_x123_la_primera_vez(self, insumo_id, codigo):
        if codigo.lower() == "x123" and not ciegas:
            ciegas.append(codigo)
            return None
        return original(self, insumo_id, codigo)

    monkeypatch.setattr(ElaboracionRepository, "find_lote_by_codigo", ciega_con_x123_la_primera_vez)

    response = _put(
        api,
        ctx,
        _asignacion(ctx, harina_lote={"tipo": "nuevo", "codigo": "H-1"}, leche_lote={"tipo": "nuevo", "codigo": "x123"}),
    )

    assert response.status_code == 409, response.text
    assert response.json()["detail"]["lote_id"] == lote.id
    assert response.json()["detail"]["ingrediente_id"] == ctx["leche"]["id"]
    assert ciegas == ["x123"]
    # H-1 was created before the failing line; the rollback removed it.
    assert [fila.codigo for fila in _leer_lotes(fabrica)] == ["X123"]
    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == antes


def test_si_algo_falla_a_mitad_no_persiste_nada(api, ctx, fabrica, monkeypatch) -> None:
    """The first new lot is already flushed when the second lookup blows up."""
    original = ElaboracionRepository.find_lote_by_codigo
    llamadas: list[str] = []

    def falla_la_segunda(self, insumo_id, codigo):
        llamadas.append(codigo)
        if len(llamadas) == 2:
            raise RuntimeError("falla simulada a mitad de la asignación")
        return original(self, insumo_id, codigo)

    monkeypatch.setattr(ElaboracionRepository, "find_lote_by_codigo", falla_la_segunda)
    antes = _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"]))

    with pytest.raises(RuntimeError, match="falla simulada"):
        _put(
            api,
            ctx,
            _asignacion(ctx, harina_lote={"tipo": "nuevo", "codigo": "H-1"}, leche_lote=NUEVO_X123),
        )

    assert len(llamadas) == 2
    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == antes
    assert _leer_lotes(fabrica) == []


def test_una_elaboracion_ajena_no_cambia_nada_en_la_base(api, ctx, fabrica) -> None:
    headers_b = registrar(api, PRODUCTOR_B)
    antes = _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"]))

    response = api.put(
        f"/gestion/elaboraciones/{ctx['elaboracion']['id']}/usos",
        headers=headers_b,
        json={"usos": _asignacion(ctx, leche_lote=NUEVO_X123, harina_lote=SIN_LOTE)},
    )

    assert response.status_code == 404
    assert _estado(_leer_usos(fabrica, ctx["elaboracion"]["id"])) == antes
    assert _leer_lotes(fabrica) == []


# --- concurrencia (PostgreSQL) -----------------------------------------------------------


@solo_postgresql
def test_dos_asignaciones_simultaneas_del_mismo_lote_nuevo_solo_una_lo_crea(api, ctx, fabrica) -> None:
    """Two elaboraciones create lot X123 of the same supply at the same time: the unique index decides."""
    segunda = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"]).json()
    arranque = threading.Barrier(2)
    resultados: list = []

    def asignar(elaboracion_id: int):
        def correr():
            arranque.wait(timeout=20)
            return TestClient(app).put(
                f"/gestion/elaboraciones/{elaboracion_id}/usos",
                headers=ctx["headers"],
                json={"usos": _asignacion(ctx, leche_lote=NUEVO_X123, harina_lote=SIN_LOTE)},
            )

        return correr

    hilos = [
        en_hilo(resultados, "a", asignar(ctx["elaboracion"]["id"])),
        en_hilo(resultados, "b", asignar(segunda["id"])),
    ]
    for hilo in hilos:
        hilo.join(timeout=30)

    respuestas = {clave: valor for clave, valor in resultados}
    assert sorted(valor.status_code for valor in respuestas.values()) == [200, 409]
    perdedora = next(valor for valor in respuestas.values() if valor.status_code == 409)
    [lote] = _leer_lotes(fabrica)
    assert perdedora.json()["detail"]["lote_id"] == lote.id
    asignadas = [
        _leer_usos(fabrica, elaboracion_id)[ctx["leche"]["id"]].lote_id
        for elaboracion_id in (ctx["elaboracion"]["id"], segunda["id"])
    ]
    assert sorted(i for i in asignadas if i is not None) == [lote.id]


@solo_postgresql
def test_dos_asignaciones_simultaneas_a_la_misma_elaboracion_se_aplican_una_despues_de_otra(
    api, ctx, fabrica, monkeypatch
) -> None:
    """The second request waits for the elaboración lock, so its assignment is the final one, whole."""
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "usos_por_ingrediente")
    resultados: list = []
    elaboracion_id = ctx["elaboracion"]["id"]

    def asignar(cuerpo: list[dict]):
        return lambda: TestClient(app).put(
            f"/gestion/elaboraciones/{elaboracion_id}/usos", headers=ctx["headers"], json={"usos": cuerpo}
        )

    primera = _asignacion(ctx, harina_lote=SIN_LOTE, leche_lote=NUEVO_X123)
    segunda = _asignacion(ctx, leche_insumo=ctx["insumo_otro"]["id"], leche_lote=SIN_LOTE)

    h1 = en_hilo(resultados, "primera", asignar(primera))
    assert pausa.leido.wait(timeout=20)
    h2 = en_hilo(resultados, "segunda", asignar(segunda))
    time.sleep(1.0)  # With the lock the second waits here; without it, it finishes first.
    pausa.continuar.set()
    h1.join(timeout=30)
    h2.join(timeout=30)

    assert {clave: valor.status_code for clave, valor in resultados} == {"primera": 200, "segunda": 200}
    assert _estado(_leer_usos(fabrica, elaboracion_id)) == {
        ctx["harina"]["id"]: (ctx["insumo_harina"]["id"], None, False),
        ctx["leche"]["id"]: (ctx["insumo_otro"]["id"], None, True),
    }
    # The lot of the first assignment stays registered for reuse.
    assert [lote.codigo for lote in _leer_lotes(fabrica)] == ["X123"]

