"""The elaboraciones list: pagination, filters and search by code (T06-01 / HU06).

GET /gestion/elaboraciones answers `{items, total, limit, offset}`. Covers PT06-01 (pages),
PT06-02 (filters, alone and combined), PT06-03 (search by code), PT06-04 (state of each row),
PT06-07 (reading changes nothing) and PT06-08 (only the productor's own elaboraciones).
"""

from datetime import date

import pytest
from sqlalchemy import func, select

from app.models import Elaboracion, LoteInsumo, UsoInsumo
from app.services import elaboracion_service
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    preparar,
    registrar,
)

HOY = date(2026, 10, 6)
URL = "/gestion/elaboraciones"


@pytest.fixture(autouse=True)
def hoy_fijo(monkeypatch) -> None:
    monkeypatch.setattr(elaboracion_service, "hoy_santiago", lambda: HOY)


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    base["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    return {"headers": headers, **base}


def _crear(client, ctx, codigo: str, fecha: str, producto_id: int | None = None, headers=None) -> dict:
    response = crear_elaboracion(
        client,
        headers or ctx["headers"],
        producto_id or ctx["producto"]["id"],
        codigo=codigo,
        fecha=fecha,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _finalizar(client, ctx, elaboracion_id: int) -> None:
    """Complete every line (no lot) and finalize."""
    usos = [
        {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": {"tipo": "sin_lote"}},
        {"ingrediente_id": ctx["leche"]["id"], "insumo_id": ctx["insumo_habitual"]["id"], "lote": {"tipo": "sin_lote"}},
    ]
    put = client.put(f"{URL}/{elaboracion_id}/usos", headers=ctx["headers"], json={"usos": usos})
    assert put.status_code == 200, put.text
    assert client.post(f"{URL}/{elaboracion_id}/finalizar", headers=ctx["headers"]).status_code == 200


def _listar(client, ctx, query: str = "") -> dict:
    response = client.get(f"{URL}{query}", headers=ctx["headers"])
    assert response.status_code == 200, response.text
    return response.json()


def _codigos(client, ctx, query: str = "") -> list[str]:
    return [item["codigo"] for item in _listar(client, ctx, query)["items"]]


def _contar(db_session, modelo) -> int:
    db_session.expire_all()
    return db_session.scalar(select(func.count()).select_from(modelo))


@pytest.fixture
def historial(client, ctx) -> dict:
    """Two products and elaboraciones on different dates, some finalized.

    Producto A (Queque): E-001 01-10 finalizada, E-002 03-10 borrador, E-003 03-10 finalizada,
    E-004 05-10 borrador. Producto B (Galletas): G-001 02-10 borrador, G-002 04-10 finalizada.
    """
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    ids = {}
    for codigo, fecha in (("E-001", "2026-10-01"), ("E-002", "2026-10-03"), ("E-003", "2026-10-03"), ("E-004", "2026-10-05")):
        ids[codigo] = _crear(client, ctx, codigo, fecha)["id"]
    for codigo, fecha in (("G-001", "2026-10-02"), ("G-002", "2026-10-04")):
        ids[codigo] = _crear(client, ctx, codigo, fecha, producto_id=otro["id"])["id"]
    for codigo in ("E-001", "E-003", "G-002"):
        _finalizar(client, ctx, ids[codigo])
    return {"otro": otro, "ids": ids}


# --- PT06-01: pagination -----------------------------------------------------------------


def test_pt06_01_responde_un_objeto_con_items_total_limit_y_offset(client, ctx) -> None:
    _crear(client, ctx, "E-001", "2026-10-01")

    cuerpo = _listar(client, ctx)

    assert set(cuerpo) == {"items", "total", "limit", "offset"}
    assert (cuerpo["total"], cuerpo["limit"], cuerpo["offset"]) == (1, 20, 0)
    assert [item["codigo"] for item in cuerpo["items"]] == ["E-001"]


def test_pt06_01_las_paginas_consecutivas_no_repiten_ni_saltan_elaboraciones(client, ctx) -> None:
    # Several share a date, so the order inside a date (id descending) matters.
    fechas = ["2026-10-01", "2026-10-02", "2026-10-02", "2026-10-03", "2026-10-03", "2026-10-03", "2026-10-04"]
    creadas = [_crear(client, ctx, f"E-{n:03d}", fecha) for n, fecha in enumerate(fechas, start=1)]
    esperado = [e["id"] for e in sorted(creadas, key=lambda e: (e["fecha"], e["id"]), reverse=True)]

    paginas = [_listar(client, ctx, f"?limit=3&offset={offset}") for offset in (0, 3, 6)]

    assert [len(p["items"]) for p in paginas] == [3, 3, 1]
    assert {p["total"] for p in paginas} == {7}
    assert [(p["limit"], p["offset"]) for p in paginas] == [(3, 0), (3, 3), (3, 6)]
    ids = [item["id"] for p in paginas for item in p["items"]]
    assert ids == esperado
    assert len(set(ids)) == 7


def test_pt06_01_un_offset_mas_alla_del_total_devuelve_una_pagina_vacia(client, ctx) -> None:
    _crear(client, ctx, "E-001", "2026-10-01")
    _crear(client, ctx, "E-002", "2026-10-02")

    cuerpo = _listar(client, ctx, "?limit=5&offset=10")

    assert cuerpo["items"] == []
    assert (cuerpo["total"], cuerpo["limit"], cuerpo["offset"]) == (2, 5, 10)


def test_pt06_01_el_limite_maximo_es_100(client, ctx) -> None:
    assert _listar(client, ctx, "?limit=100")["limit"] == 100


@pytest.mark.parametrize("query", ["?limit=0", "?limit=101", "?limit=-1", "?limit=abc", "?offset=-1", "?offset=abc"])
def test_pt06_01_limit_y_offset_fuera_de_rango_dan_422(client, ctx, query: str) -> None:
    assert client.get(f"{URL}{query}", headers=ctx["headers"]).status_code == 422


def test_el_listado_va_de_la_fecha_mas_reciente_a_la_mas_antigua_y_luego_por_id_descendente(client, ctx) -> None:
    for codigo, fecha in (("E-001", "2026-10-01"), ("E-002", "2026-10-05"), ("E-003", "2026-10-05"), ("E-004", "2026-09-30")):
        _crear(client, ctx, codigo, fecha)

    assert _codigos(client, ctx) == ["E-003", "E-002", "E-001", "E-004"]


# --- PT06-02: filters --------------------------------------------------------------------


def test_pt06_02_sin_filtros_trae_todas(client, ctx, historial) -> None:
    cuerpo = _listar(client, ctx)

    assert cuerpo["total"] == 6
    assert sorted(i["codigo"] for i in cuerpo["items"]) == ["E-001", "E-002", "E-003", "E-004", "G-001", "G-002"]


def test_pt06_02_filtra_por_producto(client, ctx, historial) -> None:
    assert sorted(_codigos(client, ctx, f"?producto_id={ctx['producto']['id']}")) == ["E-001", "E-002", "E-003", "E-004"]
    assert sorted(_codigos(client, ctx, f"?producto_id={historial['otro']['id']}")) == ["G-001", "G-002"]


def test_pt06_02_filtra_por_estado(client, ctx, historial) -> None:
    assert sorted(_codigos(client, ctx, "?estado=finalizada")) == ["E-001", "E-003", "G-002"]
    assert sorted(_codigos(client, ctx, "?estado=borrador")) == ["E-002", "E-004", "G-001"]


def test_pt06_02_el_rango_de_fechas_es_inclusivo_en_ambos_extremos(client, ctx, historial) -> None:
    assert sorted(_codigos(client, ctx, "?fecha_desde=2026-10-03")) == ["E-002", "E-003", "E-004", "G-002"]
    assert sorted(_codigos(client, ctx, "?fecha_hasta=2026-10-03")) == ["E-001", "E-002", "E-003", "G-001"]
    assert sorted(_codigos(client, ctx, "?fecha_desde=2026-10-02&fecha_hasta=2026-10-04")) == [
        "E-002", "E-003", "G-001", "G-002",
    ]
    assert sorted(_codigos(client, ctx, "?fecha_desde=2026-10-03&fecha_hasta=2026-10-03")) == ["E-002", "E-003"]


def test_pt06_02_los_filtros_se_combinan_con_y_logico(client, ctx, historial) -> None:
    producto = ctx["producto"]["id"]

    assert _codigos(client, ctx, f"?producto_id={producto}&estado=finalizada&fecha_desde=2026-10-02") == ["E-003"]
    assert _codigos(client, ctx, f"?producto_id={producto}&estado=borrador&fecha_hasta=2026-10-03") == ["E-002"]
    assert _codigos(client, ctx, "?estado=finalizada&codigo=g-") == ["G-002"]
    assert _codigos(client, ctx, f"?producto_id={producto}&estado=finalizada&fecha_desde=2026-10-04") == []


def test_pt06_02_el_total_cuenta_con_los_mismos_filtros_que_la_pagina(client, ctx, historial) -> None:
    cuerpo = _listar(client, ctx, "?estado=borrador&limit=2")

    assert cuerpo["total"] == 3
    assert len(cuerpo["items"]) == 2

    combinado = _listar(client, ctx, f"?producto_id={ctx['producto']['id']}&estado=finalizada&limit=1")
    assert combinado["total"] == 2
    assert [i["codigo"] for i in combinado["items"]] == ["E-003"]


def test_pt06_02_fecha_desde_posterior_a_fecha_hasta_da_422_con_mensaje(client, ctx, historial) -> None:
    response = client.get(f"{URL}?fecha_desde=2026-10-05&fecha_hasta=2026-10-01", headers=ctx["headers"])

    assert response.status_code == 422
    assert set(response.json()["detail"]) == {"mensaje"}
    assert "fecha" in response.json()["detail"]["mensaje"].lower()


@pytest.mark.parametrize("query", ["?fecha_desde=ayer", "?fecha_hasta=2026-13-01", "?estado=cancelada", "?producto_id=0"])
def test_pt06_02_filtros_invalidos_dan_422(client, ctx, query: str) -> None:
    assert client.get(f"{URL}{query}", headers=ctx["headers"]).status_code == 422


# --- PT06-03: search by code -------------------------------------------------------------


@pytest.fixture
def codigos(client, ctx) -> None:
    for codigo in ("E-014", "E-015", "E-120", "A_B", "AXB", "A%B", "lote-ñ"):
        _crear(client, ctx, codigo, "2026-10-01")


def test_pt06_03_codigo_exacto(client, ctx, codigos) -> None:
    assert _codigos(client, ctx, "?codigo=E-014") == ["E-014"]


def test_pt06_03_codigo_parcial(client, ctx, codigos) -> None:
    assert sorted(_codigos(client, ctx, "?codigo=E-01")) == ["E-014", "E-015"]
    assert sorted(_codigos(client, ctx, "?codigo=14")) == ["E-014"]
    assert sorted(_codigos(client, ctx, "?codigo=-01")) == ["E-014", "E-015"]
    assert _codigos(client, ctx, "?codigo=-12") == ["E-120"]


def test_pt06_03_ignora_mayusculas_y_minusculas(client, ctx, codigos) -> None:
    assert sorted(_codigos(client, ctx, "?codigo=e-01")) == ["E-014", "E-015"]
    assert _codigos(client, ctx, "?codigo=E-014") == _codigos(client, ctx, "?codigo=e-014")


def test_pt06_03_recorta_los_espacios_y_un_texto_vacio_se_ignora(client, ctx, codigos) -> None:
    assert _codigos(client, ctx, "?codigo=%20%20e-014%20%20") == ["E-014"]
    assert _listar(client, ctx, "?codigo=")["total"] == 7
    assert _listar(client, ctx, "?codigo=%20%20")["total"] == 7


def test_pt06_03_un_codigo_inexistente_devuelve_una_lista_vacia(client, ctx, codigos) -> None:
    cuerpo = _listar(client, ctx, "?codigo=zzz-999")

    assert cuerpo["items"] == []
    assert cuerpo["total"] == 0


def test_pt06_03_los_comodines_de_like_se_buscan_como_texto(client, ctx, codigos) -> None:
    assert _codigos(client, ctx, "?codigo=a_b") == ["A_B"]
    assert _codigos(client, ctx, "?codigo=a%25b") == ["A%B"]
    assert _codigos(client, ctx, "?codigo=%25") == ["A%B"]
    assert _codigos(client, ctx, "?codigo=_") == ["A_B"]


def test_pt06_03_el_texto_se_busca_sin_importar_donde_aparece(client, ctx, codigos) -> None:
    assert sorted(_codigos(client, ctx, "?codigo=b")) == ["A%B", "AXB", "A_B"]


# --- PT06-04: the state of each row ------------------------------------------------------


def test_pt06_04_cada_fila_trae_su_estado(client, ctx, historial) -> None:
    items = _listar(client, ctx)["items"]
    estados = {item["codigo"]: item["estado"] for item in items}

    assert estados == {
        "E-001": "finalizada", "E-002": "borrador", "E-003": "finalizada",
        "E-004": "borrador", "G-001": "borrador", "G-002": "finalizada",
    }
    finalizada = next(i for i in items if i["codigo"] == "E-001")
    assert finalizada["finalizada_at"] is not None and finalizada["pendientes"] == 0
    borrador = next(i for i in items if i["codigo"] == "E-002")
    assert borrador["finalizada_at"] is None and borrador["pendientes"] == borrador["total_ingredientes"]


# --- PT06-07: reading changes nothing ----------------------------------------------------


def test_pt06_07_el_listado_no_modifica_la_base(client, ctx, historial, db_session) -> None:
    def foto():
        db_session.expire_all()
        filas = db_session.execute(select(Elaboracion.id, Elaboracion.estado, Elaboracion.updated_at).order_by(Elaboracion.id)).all()
        return (
            [tuple(f) for f in filas],
            _contar(db_session, Elaboracion),
            _contar(db_session, UsoInsumo),
            _contar(db_session, LoteInsumo),
        )

    antes = foto()
    ids = historial["ids"]

    _listar(client, ctx)
    _listar(client, ctx, "?estado=borrador&limit=2&offset=1")
    _listar(client, ctx, "?codigo=e-0&fecha_desde=2026-10-01&fecha_hasta=2026-10-05")
    assert client.get(f"{URL}/{ids['E-001']}", headers=ctx["headers"]).status_code == 200
    assert client.get(f"{URL}/{ids['E-002']}", headers=ctx["headers"]).status_code == 200

    assert foto() == antes


# --- PT06-08: only the productor's own ---------------------------------------------------


@pytest.fixture
def ajeno(client) -> dict:
    headers = registrar(client, PRODUCTOR_B)
    base = preparar(client, headers)
    base["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx = {"headers": headers, **base}
    ctx["ids"] = [_crear(client, ctx, codigo, fecha)["id"] for codigo, fecha in (("E-001", "2026-10-02"), ("X-900", "2026-10-04"))]
    _finalizar(client, ctx, ctx["ids"][0])
    return ctx


def test_pt06_08_no_aparecen_elaboraciones_de_otro_productor(client, ctx, ajeno) -> None:
    _crear(client, ctx, "E-777", "2026-10-03")

    propio = _listar(client, ctx)
    del_otro = _listar(client, ajeno)

    assert [i["codigo"] for i in propio["items"]] == ["E-777"]
    assert propio["total"] == 1
    assert sorted(i["codigo"] for i in del_otro["items"]) == ["E-001", "X-900"]
    assert del_otro["total"] == 2


def test_pt06_08_filtrar_por_un_producto_ajeno_no_devuelve_nada_ni_da_error(client, ctx, ajeno) -> None:
    _crear(client, ctx, "E-777", "2026-10-03")

    cuerpo = _listar(client, ctx, f"?producto_id={ajeno['producto']['id']}")

    assert cuerpo["items"] == []
    assert cuerpo["total"] == 0


@pytest.mark.parametrize("query", ["?codigo=x-900", "?estado=finalizada", "?fecha_desde=2026-10-04", "?codigo=e-001&estado=finalizada"])
def test_pt06_08_ningun_filtro_deja_pasar_las_de_otro_productor(client, ctx, ajeno, query: str) -> None:
    assert _listar(client, ctx, query)["items"] == []


def test_pt06_08_el_detalle_de_una_ajena_responde_404(client, ctx, ajeno) -> None:
    assert client.get(f"{URL}/{ajeno['ids'][0]}", headers=ctx["headers"]).status_code == 404
