"""Persistence and concurrency of the elaboración borrador (HU05 / T05-02).

Persistence: every request gets its own session and the result is read with a brand new
session on another connection (fixtures `api` and `fabrica` in conftest.py, see HU04), so a
missing `commit` is detected. The elaboración, its uses and the flag of the version must be
saved together, in a single commit.

Concurrency (PostgreSQL only): the product row lock serializes creations and formulation
edits. A request is paused in the middle of the transaction to make the race deterministic.
"""

import time

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.main import app
from app.models import Elaboracion, FormulacionVersionProducto, UsoInsumo, VersionProducto
from app.repositories.elaboracion_repository import ElaboracionRepository
from tests.conftest import USE_POSTGRESQL
from tests.escenario_hu05 import Pausa, crear_elaboracion, crear_ingrediente, en_hilo, preparar, registrar

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Los bloqueos de fila y las conexiones simultáneas requieren PostgreSQL.",
)


@pytest.fixture
def ctx(api) -> dict:
    headers = registrar(api)
    return {"headers": headers, **preparar(api, headers)}


def _contar(fabrica, modelo) -> int:
    with fabrica() as sesion:
        return sesion.scalar(select(func.count()).select_from(modelo))


def _leer_elaboraciones(fabrica) -> list[Elaboracion]:
    """Read with a brand new session: only committed data is visible."""
    with fabrica() as sesion:
        filas = list(sesion.scalars(select(Elaboracion).order_by(Elaboracion.id)))
        sesion.expunge_all()
    return filas


def _leer_usos(fabrica, elaboracion_id: int) -> list[UsoInsumo]:
    with fabrica() as sesion:
        filas = list(
            sesion.scalars(
                select(UsoInsumo).where(UsoInsumo.elaboracion_id == elaboracion_id).order_by(UsoInsumo.id)
            )
        )
        sesion.expunge_all()
    return filas


def _leer_version(fabrica, version_id: int) -> VersionProducto:
    with fabrica() as sesion:
        version = sesion.get(VersionProducto, version_id)
        sesion.expunge(version)
    return version


def _ingredientes_de_la_version(fabrica, version_id: int) -> list[int]:
    with fabrica() as sesion:
        return list(
            sesion.scalars(
                select(FormulacionVersionProducto.ingrediente_id)
                .where(FormulacionVersionProducto.version_producto_id == version_id)
                .order_by(FormulacionVersionProducto.orden)
            )
        )


# --- persistencia ------------------------------------------------------------------------


def test_crear_un_borrador_persiste_la_elaboracion_sus_usos_y_la_marca_de_la_version(api, ctx, fabrica) -> None:
    assert _leer_version(fabrica, ctx["version"]["id"]).usada_en_elaboracion is False

    response = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-014", fecha="2026-10-01")

    assert response.status_code == 201, response.text
    [elaboracion] = _leer_elaboraciones(fabrica)
    assert elaboracion.id == response.json()["id"]
    assert (elaboracion.codigo, str(elaboracion.fecha_elaboracion), elaboracion.estado) == (
        "E-014",
        "2026-10-01",
        "borrador",
    )
    assert elaboracion.finalizada_at is None
    assert elaboracion.producto_id == ctx["producto"]["id"]
    assert elaboracion.version_producto_id == ctx["version"]["id"]
    usos = {uso.ingrediente_id: uso for uso in _leer_usos(fabrica, elaboracion.id)}
    assert set(usos) == {ctx["harina"]["id"], ctx["leche"]["id"]}
    assert usos[ctx["leche"]["id"]].insumo_id == ctx["insumo_habitual"]["id"]
    assert usos[ctx["harina"]["id"]].insumo_id is None
    assert all(uso.lote_id is None and uso.sin_lote is False for uso in usos.values())
    assert _leer_version(fabrica, ctx["version"]["id"]).usada_en_elaboracion is True


def test_el_detalle_de_una_peticion_nueva_ve_el_borrador_confirmado(api, ctx) -> None:
    creada = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"]).json()

    detalle = api.get(f"/gestion/elaboraciones/{creada['id']}", headers=ctx["headers"])

    assert detalle.status_code == 200
    assert detalle.json() == creada


def test_si_la_creacion_falla_a_mitad_no_persiste_nada(api, ctx, fabrica, monkeypatch) -> None:
    def falla(self, version_id):
        raise RuntimeError("falla simulada al marcar la versión")

    monkeypatch.setattr(
        "app.services.producto_formulacion_service.ProductoFormulacionService.marcar_version_usada", falla
    )

    with pytest.raises(RuntimeError, match="falla simulada"):
        crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"])

    assert _contar(fabrica, Elaboracion) == 0
    assert _contar(fabrica, UsoInsumo) == 0
    assert _leer_version(fabrica, ctx["version"]["id"]).usada_en_elaboracion is False


def test_un_codigo_repetido_no_deja_filas_a_medias(api, ctx, fabrica) -> None:
    assert crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-001").status_code == 201

    assert crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="e-001").status_code == 409

    [unica] = _leer_elaboraciones(fabrica)
    assert unica.codigo == "E-001"
    assert _contar(fabrica, UsoInsumo) == 2


def test_la_base_respalda_la_unicidad_del_codigo_si_la_comprobacion_previa_no_la_ve(
    api, ctx, fabrica, monkeypatch
) -> None:
    """If two requests slipped past the pre-check, the unique index still rejects the second."""
    assert crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-001").status_code == 201
    original = ElaboracionRepository.find_by_codigo
    llamadas: list[str] = []

    def ciega_la_primera_vez(self, producto_id, codigo):
        llamadas.append(codigo)
        return None if len(llamadas) == 1 else original(self, producto_id, codigo)

    monkeypatch.setattr(ElaboracionRepository, "find_by_codigo", ciega_la_primera_vez)

    response = crear_elaboracion(api, ctx["headers"], ctx["producto"]["id"], codigo="E-001")

    assert response.status_code == 409
    assert response.json()["detail"]["codigo_sugerido"] == "E-002"
    assert len(llamadas) == 2
    assert len(_leer_elaboraciones(fabrica)) == 1
    assert _contar(fabrica, UsoInsumo) == 2
    assert _leer_version(fabrica, ctx["version"]["id"]).usada_en_elaboracion is True


# --- concurrencia (PostgreSQL) -----------------------------------------------------------


@solo_postgresql
def test_dos_creaciones_simultaneas_sin_codigo_reciben_codigos_distintos(api, ctx, monkeypatch) -> None:
    """Without the product lock both would read the same suggestion and one would be rejected."""
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "list_codigos")
    resultados: list = []
    producto_id = ctx["producto"]["id"]

    def crear():
        return crear_elaboracion(TestClient(app), ctx["headers"], producto_id)

    primero = en_hilo(resultados, "primero", crear)
    assert pausa.leido.wait(timeout=20)
    segundo = en_hilo(resultados, "segundo", crear)
    time.sleep(1.0)  # With the lock the second waits here; without it, it finishes first.
    pausa.continuar.set()
    primero.join(timeout=30)
    segundo.join(timeout=30)

    respuestas = {clave: valor for clave, valor in resultados}
    assert {clave: valor.status_code for clave, valor in respuestas.items()} == {"primero": 201, "segundo": 201}
    assert sorted(valor.json()["codigo"] for valor in respuestas.values()) == ["E-001", "E-002"]


@solo_postgresql
def test_dos_creaciones_simultaneas_con_el_mismo_codigo_solo_una_gana(api, ctx, fabrica, monkeypatch) -> None:
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "list_codigos")
    resultados: list = []
    producto_id = ctx["producto"]["id"]

    def crear(codigo: str):
        return lambda: crear_elaboracion(TestClient(app), ctx["headers"], producto_id, codigo=codigo)

    primero = en_hilo(resultados, "primero", crear("E-050"))
    assert pausa.leido.wait(timeout=20)
    segundo = en_hilo(resultados, "segundo", crear("e-050"))
    time.sleep(1.0)
    pausa.continuar.set()
    primero.join(timeout=30)
    segundo.join(timeout=30)

    respuestas = {clave: valor for clave, valor in resultados}
    assert sorted(valor.status_code for valor in respuestas.values()) == [201, 409]
    perdedora = next(valor for valor in respuestas.values() if valor.status_code == 409)
    assert perdedora.json()["detail"]["codigo_sugerido"] == "E-051"
    assert len(_leer_elaboraciones(fabrica)) == 1
    assert _contar(fabrica, UsoInsumo) == 2


@solo_postgresql
def test_crear_una_elaboracion_mientras_se_edita_la_formulacion_no_modifica_la_version_usada(
    api, ctx, fabrica, monkeypatch
) -> None:
    """The edit waits for the creation: the version is flagged first, so the edit makes a new one.

    Without the lock the edit would change the (still unused) version in place while the
    creation holds a stale copy of its lines, and the elaboración would disagree with its version.
    """
    pausa = Pausa()
    pausa.instalar(monkeypatch, ElaboracionRepository, "list_lineas_formulacion")
    resultados: list = []
    producto_id = ctx["producto"]["id"]
    azucar = crear_ingrediente(api, ctx["headers"], "Azúcar", "azu-001")

    def crear():
        return crear_elaboracion(TestClient(app), ctx["headers"], producto_id)

    def editar():
        return TestClient(app).put(
            f"/gestion/productos/{producto_id}/formulacion",
            headers=ctx["headers"],
            json={"lineas": [{"ingrediente_id": azucar["id"]}]},
        )

    creacion = en_hilo(resultados, "creacion", crear)
    assert pausa.leido.wait(timeout=20)
    edicion = en_hilo(resultados, "edicion", editar)
    time.sleep(1.0)  # With the lock the edit waits here; without it, it finishes first.
    pausa.continuar.set()
    creacion.join(timeout=30)
    edicion.join(timeout=30)

    respuestas = {clave: valor for clave, valor in resultados}
    assert respuestas["creacion"].status_code == 201, respuestas["creacion"]
    assert respuestas["edicion"].status_code == 200, respuestas["edicion"]
    assert respuestas["edicion"].json()["resultado"] == "nueva_version"

    [elaboracion] = _leer_elaboraciones(fabrica)
    version_id = elaboracion.version_producto_id
    assert version_id == ctx["version"]["id"]
    assert _leer_version(fabrica, version_id).usada_en_elaboracion is True
    assert _ingredientes_de_la_version(fabrica, version_id) == [ctx["harina"]["id"], ctx["leche"]["id"]]
    assert sorted(uso.ingrediente_id for uso in _leer_usos(fabrica, elaboracion.id)) == sorted(
        _ingredientes_de_la_version(fabrica, version_id)
    )
    assert _ingredientes_de_la_version(fabrica, respuestas["edicion"].json()["version"]["id"]) == [azucar["id"]]
