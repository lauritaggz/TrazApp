"""Authenticated elaboración API tests: creating the borrador and reading it (T05-02 / HU05).

Covers PT05-01, PT05-02, PT05-03, PT05-04 and PT05-16, plus the suggested code, the default
and future dates and deactivated ingredients. Persistence from an independent session and
the concurrency cases live in test_persistencia_elaboraciones_hu05.py.
"""

from datetime import date, datetime

import pytest
from sqlalchemy import func, select

from app.models import Elaboracion, Productor, UsoInsumo, VersionProducto
from app.services import elaboracion_service
from app.services.elaboracion_service import sugerir_codigo
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_elaboracion,
    crear_insumo,
    crear_ingrediente,
    crear_producto,
    formular,
    preparar,
    registrar,
)

HOY = date(2026, 10, 6)


@pytest.fixture(autouse=True)
def hoy_fijo(monkeypatch) -> None:
    """Today in America/Santiago, fixed so the default date and the future check are exact."""
    monkeypatch.setattr(elaboracion_service, "hoy_santiago", lambda: HOY)


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    return {"headers": headers, **preparar(client, headers)}


def _filas(db_session, modelo) -> int:
    db_session.expire_all()
    return db_session.scalar(select(func.count()).select_from(modelo))


def _version(db_session, version_id: int) -> VersionProducto:
    db_session.expire_all()
    return db_session.get(VersionProducto, version_id)


def _crear(client, ctx, **cuerpo):
    return crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"], **cuerpo)


# --- autenticación -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("get", "/gestion/productos/1/elaboraciones/codigo-sugerido"),
        ("post", "/gestion/productos/1/elaboraciones"),
        ("get", "/gestion/elaboraciones"),
        ("get", "/gestion/elaboraciones/1"),
    ],
)
def test_las_rutas_requieren_autenticacion(client, metodo: str, ruta: str) -> None:
    kwargs = {"json": {}} if metodo == "post" else {}

    assert getattr(client, metodo)(ruta, **kwargs).status_code == 401


# --- PT05-01: crear un borrador ----------------------------------------------------------


def test_pt05_01_crea_un_borrador_asociado_a_la_version_vigente(client, ctx, db_session) -> None:
    response = _crear(client, ctx)

    assert response.status_code == 201, response.text
    cuerpo = response.json()
    assert cuerpo["estado"] == "borrador"
    assert cuerpo["finalizada_at"] is None
    assert cuerpo["codigo"] == "E-001"
    assert cuerpo["fecha"] == "2026-10-06"
    assert cuerpo["producto"] == {"id": ctx["producto"]["id"], "nombre": "Queque de vainilla"}
    assert cuerpo["version"] == {"id": ctx["version"]["id"], "numero_version": 1}
    assert [(uso["ingrediente_id"], uso["ingrediente_nombre"]) for uso in cuerpo["usos"]] == [
        (ctx["harina"]["id"], "Harina"),
        (ctx["leche"]["id"], "Leche"),
    ]
    assert [uso["orden"] for uso in cuerpo["usos"]] == [1, 2]
    elaboracion = db_session.scalar(select(Elaboracion))
    assert elaboracion.id == cuerpo["id"]
    assert elaboracion.version_producto_id == ctx["version"]["id"]
    assert elaboracion.productor_id == db_session.scalar(select(Productor.id))


def test_la_version_queda_marcada_como_usada_al_crear_la_elaboracion(client, ctx, db_session) -> None:
    assert _version(db_session, ctx["version"]["id"]).usada_en_elaboracion is False

    assert _crear(client, ctx).status_code == 201

    assert _version(db_session, ctx["version"]["id"]).usada_en_elaboracion is True


def test_se_crea_un_uso_por_cada_ingrediente_de_la_version(client, ctx, db_session) -> None:
    cuerpo = _crear(client, ctx).json()

    usos = db_session.scalars(select(UsoInsumo).where(UsoInsumo.elaboracion_id == cuerpo["id"])).all()

    assert sorted(uso.ingrediente_id for uso in usos) == sorted([ctx["harina"]["id"], ctx["leche"]["id"]])
    assert all(uso.sin_lote is False and uso.lote_id is None for uso in usos)
    assert all(uso.informacion_conservada is None for uso in usos)


def test_el_detalle_muestra_la_cantidad_y_unidad_de_la_formulacion(client) -> None:
    headers = registrar(client)
    producto = crear_producto(client, headers)
    harina = crear_ingrediente(client, headers, "Harina", "har-001")
    assert client.put(
        f"/gestion/productos/{producto['id']}/formulacion",
        headers=headers,
        json={"lineas": [{"ingrediente_id": harina["id"], "cantidad": "500", "unidad": "g"}]},
    ).status_code == 200

    uso = crear_elaboracion(client, headers, producto["id"]).json()["usos"][0]

    assert (uso["cantidad"], uso["unidad"]) == ("500.000", "g")


# --- PT05-02: producto sin formulación ---------------------------------------------------


def test_pt05_02_un_producto_sin_formulacion_no_admite_elaboraciones(client, db_session) -> None:
    headers = registrar(client)
    producto = crear_producto(client, headers)

    response = crear_elaboracion(client, headers, producto["id"])

    assert response.status_code == 409
    assert "formulación" in response.json()["detail"]
    assert _filas(db_session, Elaboracion) == 0
    assert _filas(db_session, UsoInsumo) == 0
    assert _filas(db_session, VersionProducto) == 0


# --- ingredientes desactivados -----------------------------------------------------------


def test_una_formulacion_con_ingredientes_desactivados_responde_409_con_la_lista(
    client, ctx, db_session
) -> None:
    assert client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"]).status_code == 204

    response = _crear(client, ctx)

    assert response.status_code == 409
    detalle = response.json()["detail"]
    assert detalle["ingredientes"] == [{"id": ctx["harina"]["id"], "nombre": "Harina"}]
    assert "«Harina»" in detalle["mensaje"]
    assert _filas(db_session, Elaboracion) == 0
    assert _version(db_session, ctx["version"]["id"]).usada_en_elaboracion is False


def test_la_lista_incluye_todos_los_ingredientes_desactivados(client, ctx) -> None:
    for clave in ("harina", "leche"):
        client.delete(f"/gestion/ingredientes/{ctx[clave]['id']}", headers=ctx["headers"])

    detalle = _crear(client, ctx).json()["detail"]

    assert sorted(item["nombre"] for item in detalle["ingredientes"]) == ["Harina", "Leche"]


# --- PT05-03: código de elaboración ------------------------------------------------------


def test_pt05_03_un_codigo_repetido_en_el_mismo_producto_se_rechaza(client, ctx, db_session) -> None:
    assert _crear(client, ctx, codigo="E-014").status_code == 201

    response = _crear(client, ctx, codigo="E-014")

    assert response.status_code == 409
    detalle = response.json()["detail"]
    assert "E-014" in detalle["mensaje"]
    assert detalle["codigo_sugerido"] == "E-015"
    assert _filas(db_session, Elaboracion) == 1


@pytest.mark.parametrize("variante", ["e-014", "E-014 ", "  e-014"])
def test_pt05_03_el_codigo_repetido_se_detecta_sin_distinguir_mayusculas(client, ctx, db_session, variante: str) -> None:
    assert _crear(client, ctx, codigo="E-014").status_code == 201

    response = _crear(client, ctx, codigo=variante)

    assert response.status_code == 409
    assert response.json()["detail"]["codigo_sugerido"] == "E-015"
    assert _filas(db_session, Elaboracion) == 1


def test_el_mismo_codigo_en_otro_producto_se_permite(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"])
    assert _crear(client, ctx, codigo="E-001").status_code == 201

    assert crear_elaboracion(client, ctx["headers"], otro["id"], codigo="E-001").status_code == 201


def test_el_codigo_se_guarda_sin_espacios_en_los_extremos(client, ctx) -> None:
    assert _crear(client, ctx, codigo="  Lote-A7 ").json()["codigo"] == "Lote-A7"


@pytest.mark.parametrize("codigo", ["", "   ", "x" * 101])
def test_un_codigo_vacio_o_demasiado_largo_responde_422(client, ctx, db_session, codigo: str) -> None:
    assert _crear(client, ctx, codigo=codigo).status_code == 422
    assert _filas(db_session, Elaboracion) == 0


def test_los_campos_desconocidos_del_cuerpo_responden_422(client, ctx) -> None:
    assert _crear(client, ctx, estado="finalizada").status_code == 422


# --- código sugerido ---------------------------------------------------------------------


@pytest.mark.parametrize(
    ("existentes", "esperado"),
    [
        ([], "E-001"),
        (["E-001"], "E-002"),
        (["E-001", "E-007", "E-003"], "E-008"),
        (["e-010"], "E-011"),
        (["Lote-A", "E-xyz", "E-"], "E-001"),
        (["E-998", "E-999"], "E-1000"),
        (["E-0004"], "E-005"),
    ],
)
def test_sugerir_codigo_toma_el_mayor_numero_mas_uno(existentes: list[str], esperado: str) -> None:
    assert sugerir_codigo(existentes) == esperado


def test_el_endpoint_sugiere_el_siguiente_codigo_del_producto(client, ctx) -> None:
    url = f"/gestion/productos/{ctx['producto']['id']}/elaboraciones/codigo-sugerido"
    assert client.get(url, headers=ctx["headers"]).json() == {"codigo": "E-001"}

    assert _crear(client, ctx, codigo="E-007").status_code == 201

    assert client.get(url, headers=ctx["headers"]).json() == {"codigo": "E-008"}


def test_sin_codigo_se_asigna_el_sugerido(client, ctx) -> None:
    primero = _crear(client, ctx).json()
    segundo = _crear(client, ctx).json()

    assert (primero["codigo"], segundo["codigo"]) == ("E-001", "E-002")


def test_el_codigo_sugerido_es_por_producto(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"])
    _crear(client, ctx, codigo="E-020")

    sugerido = client.get(
        f"/gestion/productos/{otro['id']}/elaboraciones/codigo-sugerido", headers=ctx["headers"]
    )

    assert sugerido.json() == {"codigo": "E-001"}


# --- fecha -------------------------------------------------------------------------------


def test_sin_fecha_se_usa_hoy_en_america_santiago(client, ctx) -> None:
    assert _crear(client, ctx).json()["fecha"] == "2026-10-06"


def test_la_fecha_por_defecto_sale_de_la_zona_horaria_de_santiago(monkeypatch) -> None:
    class RelojFijo(datetime):
        @classmethod
        def now(cls, tz=None):
            # 02:30 UTC of the 7th is still the evening of the 6th in Santiago (UTC-3 in October).
            return datetime(2026, 10, 7, 2, 30, tzinfo=elaboracion_service.ZoneInfo("UTC")).astimezone(tz)

    monkeypatch.undo()
    monkeypatch.setattr(elaboracion_service, "datetime", RelojFijo)

    assert elaboracion_service.hoy_santiago() == date(2026, 10, 6)


@pytest.mark.parametrize("fecha", ["2026-10-06", "2026-10-05", "2025-01-31"])
def test_acepta_hoy_y_fechas_pasadas(client, ctx, fecha: str) -> None:
    response = _crear(client, ctx, fecha=fecha)

    assert response.status_code == 201
    assert response.json()["fecha"] == fecha


def test_una_fecha_futura_responde_422_y_no_crea_nada(client, ctx, db_session) -> None:
    response = _crear(client, ctx, fecha="2026-10-07")

    assert response.status_code == 422
    assert response.json()["detail"] == "La fecha de elaboración no puede ser futura."
    assert _filas(db_session, Elaboracion) == 0
    assert _version(db_session, ctx["version"]["id"]).usada_en_elaboracion is False


@pytest.mark.parametrize("fecha", ["no-es-fecha", "2026-13-40", 20261006])
def test_una_fecha_invalida_responde_422(client, ctx, fecha) -> None:
    assert _crear(client, ctx, fecha=fecha).status_code == 422


# --- PT05-04: insumo habitual preseleccionado --------------------------------------------


def test_pt05_04_el_insumo_habitual_activo_queda_preseleccionado(client, ctx) -> None:
    usos = {uso["ingrediente_id"]: uso for uso in _crear(client, ctx).json()["usos"]}

    leche = usos[ctx["leche"]["id"]]
    assert leche["insumo"] == {
        "id": ctx["insumo_habitual"]["id"],
        "nombre": "Leche Colun Semidescremada 1 L",
        "marca_origen": "Marca",
        "presentacion": None,
        "activo": True,
        "habitual": True,
    }
    assert leche["lote"] is None
    assert leche["sin_lote"] is False


def test_un_uso_con_insumo_pero_sin_lote_sigue_pendiente_del_lote(client, ctx) -> None:
    leche = {u["ingrediente_id"]: u for u in _crear(client, ctx).json()["usos"]}[ctx["leche"]["id"]]

    assert leche["pendiente"] is True
    assert leche["falta"] == ["lote"]


def test_un_ingrediente_sin_insumos_activos_queda_pendiente(client, ctx) -> None:
    harina = {u["ingrediente_id"]: u for u in _crear(client, ctx).json()["usos"]}[ctx["harina"]["id"]]

    assert harina["insumo"] is None
    assert harina["pendiente"] is True
    assert harina["falta"] == ["insumo", "lote"]


def test_sin_habitual_no_se_preselecciona_aunque_haya_un_solo_insumo(client, ctx) -> None:
    crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Harina Selecta 1 kg")

    harina = {u["ingrediente_id"]: u for u in _crear(client, ctx).json()["usos"]}[ctx["harina"]["id"]]

    assert harina["insumo"] is None


def test_un_habitual_desactivado_no_se_preselecciona(client, ctx) -> None:
    assert client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).status_code == 204

    leche = {u["ingrediente_id"]: u for u in _crear(client, ctx).json()["usos"]}[ctx["leche"]["id"]]

    assert leche["insumo"] is None
    assert leche["falta"] == ["insumo", "lote"]


def test_el_habitual_de_otro_productor_no_se_preselecciona(client, ctx) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    # Productor B has its own ingredient and habitual supply; they must never leak into A.
    leche_b = crear_ingrediente(client, headers_b, "Leche", "lec-001")
    crear_insumo(client, headers_b, leche_b["id"], "Leche de B", habitual=True)

    leche = {u["ingrediente_id"]: u for u in _crear(client, ctx).json()["usos"]}[ctx["leche"]["id"]]

    assert leche["insumo"]["nombre"] == "Leche Colun Semidescremada 1 L"


# --- PT05-16: pertenencia ----------------------------------------------------------------


def test_pt05_16_un_productor_no_accede_a_elaboraciones_de_otro(client, ctx, db_session) -> None:
    creada = _crear(client, ctx).json()
    headers_b = registrar(client, PRODUCTOR_B)
    producto_id = ctx["producto"]["id"]

    assert client.get(f"/gestion/elaboraciones/{creada['id']}", headers=headers_b).status_code == 404
    assert crear_elaboracion(client, headers_b, producto_id).status_code == 404
    assert client.get(
        f"/gestion/productos/{producto_id}/elaboraciones/codigo-sugerido", headers=headers_b
    ).status_code == 404
    assert client.get("/gestion/elaboraciones", headers=headers_b).json() == []
    assert client.get(f"/gestion/elaboraciones?producto_id={producto_id}", headers=headers_b).json() == []
    assert _filas(db_session, Elaboracion) == 1


def test_un_producto_o_una_elaboracion_inexistente_responde_404(client, ctx) -> None:
    assert crear_elaboracion(client, ctx["headers"], 99999).status_code == 404
    assert client.get("/gestion/productos/99999/elaboraciones/codigo-sugerido", headers=ctx["headers"]).status_code == 404
    assert client.get("/gestion/elaboraciones/99999", headers=ctx["headers"]).status_code == 404


def test_un_producto_desactivado_no_admite_elaboraciones(client, ctx, db_session) -> None:
    assert client.delete(f"/gestion/productos/{ctx['producto']['id']}", headers=ctx["headers"]).status_code in (200, 204)

    assert _crear(client, ctx).status_code == 404
    assert _filas(db_session, Elaboracion) == 0


# --- detalle y listado -------------------------------------------------------------------

def test_las_elaboraciones_de_un_producto_desactivado_siguen_siendo_consultables(client, ctx) -> None:
    """Traceability (HU08) and the public sheet (HU10) need them: only creating a new one is blocked."""
    creada = _crear(client, ctx, codigo="E-001").json()
    producto_id = ctx["producto"]["id"]
    assert client.delete(f"/gestion/productos/{producto_id}", headers=ctx["headers"]).status_code in (200, 204)

    detalle = client.get(f"/gestion/elaboraciones/{creada['id']}", headers=ctx["headers"])
    todas = client.get("/gestion/elaboraciones", headers=ctx["headers"])
    del_producto = client.get(f"/gestion/elaboraciones?producto_id={producto_id}", headers=ctx["headers"])
    borradores = client.get("/gestion/elaboraciones?estado=borrador", headers=ctx["headers"])

    assert detalle.status_code == 200
    assert detalle.json() == creada
    for respuesta in (todas, del_producto, borradores):
        assert respuesta.status_code == 200
        assert [item["id"] for item in respuesta.json()] == [creada["id"]]
    assert _crear(client, ctx).status_code == 404



def test_el_detalle_devuelve_la_misma_elaboracion_que_se_creo(client, ctx) -> None:
    creada = _crear(client, ctx, codigo="E-100", fecha="2026-10-01").json()

    detalle = client.get(f"/gestion/elaboraciones/{creada['id']}", headers=ctx["headers"])

    assert detalle.status_code == 200
    assert detalle.json() == creada


def test_el_listado_muestra_el_resumen_con_los_pendientes(client, ctx) -> None:
    creada = _crear(client, ctx, codigo="E-100", fecha="2026-10-01").json()

    lista = client.get("/gestion/elaboraciones", headers=ctx["headers"]).json()

    assert lista == [
        {
            "id": creada["id"],
            "producto": {"id": ctx["producto"]["id"], "nombre": "Queque de vainilla"},
            "version": {"id": ctx["version"]["id"], "numero_version": 1},
            "codigo": "E-100",
            "fecha": "2026-10-01",
            "estado": "borrador",
            "finalizada_at": None,
            "total_ingredientes": 2,
            "pendientes": 2,
        }
    ]


def test_el_listado_va_de_la_fecha_mas_reciente_a_la_mas_antigua(client, ctx) -> None:
    for codigo, fecha in (("E-001", "2026-10-01"), ("E-002", "2026-10-05"), ("E-003", "2026-10-05"), ("E-004", "2026-09-30")):
        _crear(client, ctx, codigo=codigo, fecha=fecha)

    codigos = [item["codigo"] for item in client.get("/gestion/elaboraciones", headers=ctx["headers"]).json()]

    assert codigos == ["E-003", "E-002", "E-001", "E-004"]


def test_el_listado_filtra_por_producto_y_por_estado(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"])
    _crear(client, ctx, codigo="E-001")
    crear_elaboracion(client, ctx["headers"], otro["id"], codigo="G-001")
    pedir = lambda query: [i["codigo"] for i in client.get(f"/gestion/elaboraciones{query}", headers=ctx["headers"]).json()]

    assert sorted(pedir("")) == ["E-001", "G-001"]
    assert pedir(f"?producto_id={ctx['producto']['id']}") == ["E-001"]
    assert pedir(f"?producto_id={otro['id']}") == ["G-001"]
    assert sorted(pedir("?estado=borrador")) == ["E-001", "G-001"]
    assert pedir("?estado=finalizada") == []
    assert pedir(f"?producto_id={otro['id']}&estado=finalizada") == []


@pytest.mark.parametrize("query", ["?estado=cancelada", "?producto_id=0", "?producto_id=abc"])
def test_el_listado_rechaza_filtros_invalidos(client, ctx, query: str) -> None:
    assert client.get(f"/gestion/elaboraciones{query}", headers=ctx["headers"]).status_code == 422


# --- todo en una sola transacción --------------------------------------------------------


def test_si_algo_falla_al_crear_no_queda_nada(client, ctx, db_session, monkeypatch) -> None:
    def falla(self, version_id):
        raise RuntimeError("falla simulada al marcar la versión")

    monkeypatch.setattr(
        "app.services.producto_formulacion_service.ProductoFormulacionService.marcar_version_usada", falla
    )

    with pytest.raises(RuntimeError, match="falla simulada"):
        _crear(client, ctx)

    assert _filas(db_session, Elaboracion) == 0
    assert _filas(db_session, UsoInsumo) == 0
    assert _version(db_session, ctx["version"]["id"]).usada_en_elaboracion is False


def test_la_creacion_reutiliza_marcar_version_usada_del_servicio_de_formulacion(client, ctx, monkeypatch) -> None:
    llamadas: list[int] = []
    original = elaboracion_service.ProductoFormulacionService.marcar_version_usada

    def espia(self, version_id):
        llamadas.append(version_id)
        return original(self, version_id)

    monkeypatch.setattr(elaboracion_service.ProductoFormulacionService, "marcar_version_usada", espia)

    assert _crear(client, ctx).status_code == 201

    assert llamadas == [ctx["version"]["id"]]
