"""Elaboraciones related to a specific lot (T08-02 / HU08).

GET /gestion/insumos/{insumo_id}/lotes/{lote_id}/elaboraciones. Covers PT08-02, PT08-07 (each lot of
the scenario, OE3), PT08-08 and PT08-09 (lot part), RT-03, the CA7 fields, the count `otras_sin_lote`
(D3: the elaboraciones without lot are NOT in the result, only counted) and the number of queries.

It reuses the base scenario of test_elaboraciones_relacionadas_insumo_hu08.py:
    E1 Queque   2026-10-01 finalizada  X lote L-42
    E2 Queque   2026-10-03 finalizada  X sin lote
    E3 Galletas 2026-10-04 finalizada  X lote L-43, hidden, product published
    E4 Galletas 2026-10-05 borrador    X lote L-42
    E5 Queque   2026-10-02 finalizada  Y (another supply)
    E6 Queque   2026-10-06 borrador    nothing assigned for the flour
"""

import pytest
from sqlalchemy import select

from app.models import LoteInsumo
from tests.escenario_hu05 import PRODUCTOR_B, crear_insumo, registrar
from tests.test_elaboraciones_relacionadas_insumo_hu08 import (  # noqa: F401  (fixtures and helpers)
    CONSULTAS_DE_AUTENTICACION,
    SIN_LOTE,
    _consultar,
    _elaborar,
    _foto,
    _por_codigo,
    base,
    contar_consultas,
    ctx,
    hoy_fijo,
)

# Lot query: the lot with its supply + the uses + the count of the other elaboraciones without lot.
CONSULTAS_DE_DATOS_POR_LOTE = 3


def _url(insumo_id: int, lote_id: int) -> str:
    return f"/gestion/insumos/{insumo_id}/lotes/{lote_id}/elaboraciones"


def _por_lote(client, base: dict, codigo_lote: str, headers=None) -> dict:
    respuesta = client.get(_url(base["x"], base["lotes"][codigo_lote]), headers=headers or base["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _ids(cuerpo: dict) -> set[int]:
    return {e["id"] for e in cuerpo["elaboraciones"]}


# --- PT08-02 / CA2, CA8 ------------------------------------------------------------------------------


def test_pt08_02_por_lote_devuelve_solo_las_elaboraciones_de_ese_lote(client, base) -> None:
    l42 = _por_lote(client, base, "L-42")
    l43 = _por_lote(client, base, "L-43")

    # Order of the history (date desc, id desc). Not the second lot, nor the one without lot.
    assert [e["codigo"] for e in l42["elaboraciones"]] == ["E4", "E1"]
    assert [e["codigo"] for e in l43["elaboraciones"]] == ["E3"]
    for cuerpo in (l42, l43):
        codigos = {e["codigo"] for e in cuerpo["elaboraciones"]}
        assert not codigos & {"E2", "E5", "E6"}
    # Every use shown is of the consulted lot.
    assert {uso["lote"]["codigo"] for e in l42["elaboraciones"] for uso in e["usos"]} == {"L-42"}
    assert {uso["lote_estado"] for e in l42["elaboraciones"] for uso in e["usos"]} == {"con_lote"}


def test_el_encabezado_lleva_el_insumo_y_el_lote_y_el_resumen_no_trae_sin_lote(client, base) -> None:
    cuerpo = _por_lote(client, base, "L-42")

    assert set(cuerpo) == {"insumo", "lote", "resumen", "otras_sin_lote", "elaboraciones"}
    assert cuerpo["insumo"] == {"id": base["x"], "nombre": "Harina Selecta 1 kg", "activo": True}
    assert cuerpo["lote"] == {"id": base["lotes"]["L-42"], "codigo": "L-42"}
    assert cuerpo["resumen"] == {
        "total_elaboraciones": 2,
        "total_productos": 2,
        "finalizadas": 1,
        "borradores": 1,
        "visibles_publicamente": 0,
    }
    assert "elaboraciones_sin_lote" not in cuerpo["resumen"]


# --- PT08-07 (OE3): expected set against returned set, for each lot ------------------------------------


def test_pt08_07_cada_lote_devuelve_el_100_por_ciento_de_las_relacionadas_y_el_0_por_ciento_de_las_otras(client, base) -> None:
    ids = base["ids"]
    esperados = {"L-42": {ids["E1"], ids["E4"]}, "L-43": {ids["E3"]}}
    todas = set(ids.values())
    for codigo_lote, relacionadas in esperados.items():
        devueltas = _ids(_por_lote(client, base, codigo_lote))
        no_relacionadas = todas - relacionadas

        encontradas = len(devueltas & relacionadas) / len(relacionadas)
        de_mas = len(devueltas & no_relacionadas) / len(no_relacionadas)

        assert encontradas == 1.0
        assert de_mas == 0.0
        assert devueltas == relacionadas


# --- CA4: borradores ---------------------------------------------------------------------------------


def test_un_borrador_que_usa_el_lote_aparece_con_estado_borrador_y_datos_vigentes(client, base) -> None:
    e4 = _por_codigo(_por_lote(client, base, "L-42"))["E4"]

    assert e4["id"] == base["ids"]["E4"]
    assert e4["estado"] == "borrador"
    assert e4["origen_datos"] == "vigente"
    assert e4["finalizada_at"] is None
    assert e4["usos"][0]["lote"]["codigo"] == "L-42"


# --- RT-03 ---------------------------------------------------------------------------------------------


def test_rt03_el_codigo_del_lote_mostrado_en_una_finalizada_es_el_conservado(client, base, db_session) -> None:
    db_session.get(LoteInsumo, base["lotes"]["L-42"]).codigo = "CAMBIADO-HOY"
    db_session.commit()

    por_codigo = _por_codigo(_por_lote(client, base, "L-42"))

    # The finalizada keeps what was copied; the borrador shows the current lot.
    assert por_codigo["E1"]["usos"][0]["lote"]["codigo"] == "L-42"
    assert por_codigo["E1"]["origen_datos"] == "conservada"
    assert por_codigo["E4"]["usos"][0]["lote"]["codigo"] == "CAMBIADO-HOY"


# --- D3: otras_sin_lote --------------------------------------------------------------------------------


def test_otras_sin_lote_en_el_escenario_base_cuenta_la_elaboracion_sin_lote_y_no_la_incluye(client, base) -> None:
    for codigo_lote in ("L-42", "L-43"):
        cuerpo = _por_lote(client, base, codigo_lote)

        assert cuerpo["otras_sin_lote"] == {"sin_lote": 1, "lote_pendiente": 0}
        assert base["ids"]["E2"] not in _ids(cuerpo)


def test_otras_sin_lote_cuenta_finalizadas_y_borradores_sin_lote_y_borradores_con_lote_pendiente(client, base) -> None:
    x, queque, galletas = base["x"], base["producto"]["id"], base["galletas"]["id"]
    e7 = _elaborar(client, base, queque, "E7", "2026-10-02", {"insumo_id": x, "lote": None}, finalizar=False)  # pendiente
    e8 = _elaborar(client, base, galletas, "E8", "2026-10-03", {"insumo_id": x, "lote": SIN_LOTE}, finalizar=False)  # borrador sin lote
    e9 = _elaborar(client, base, galletas, "E9", "2026-10-02", {"insumo_id": x, "lote": SIN_LOTE})  # finalizada sin lote

    cuerpo = _por_lote(client, base, "L-42")

    # E2 (finalizada), E8 (borrador) and E9 (finalizada) have no lot; E7 is a borrador with the lot pending.
    assert cuerpo["otras_sin_lote"] == {"sin_lote": 3, "lote_pendiente": 1}
    assert _ids(cuerpo) == {base["ids"]["E1"], base["ids"]["E4"]}
    assert not _ids(cuerpo) & {base["ids"]["E2"], e7, e8, e9}
    # The same elaboraciones appear marked "sin lote" in the query by supply, which the screen links to.
    por_insumo = _consultar(client, base, x)
    assert por_insumo["resumen"]["elaboraciones_sin_lote"] == cuerpo["otras_sin_lote"]["sin_lote"]
    assert {c for c, e in _por_codigo(por_insumo).items() if e["usos"][0]["lote_estado"] == "pendiente"} == {"E7"}


def test_otras_sin_lote_no_cuenta_otros_insumos_ni_otras_elaboraciones_con_lote(client, base) -> None:
    # E5 uses supply Y without lot: it is not an "other without lot" of X.
    for codigo_lote in ("L-42", "L-43"):
        assert _por_lote(client, base, codigo_lote)["otras_sin_lote"]["sin_lote"] == 1
    assert base["ids"]["E5"] not in _ids(_por_lote(client, base, "L-42"))


# --- CA7 -----------------------------------------------------------------------------------------------


def test_los_campos_de_ca7_estan_tambien_en_la_consulta_por_lote(client, base) -> None:
    por_codigo = _por_codigo(_por_lote(client, base, "L-43"))

    e3 = por_codigo["E3"]
    assert set(e3) == {
        "id", "codigo", "fecha", "estado", "finalizada_at", "producto", "oculta",
        "visible_publicamente", "origen_datos", "usos",
    }  # fmt: skip
    assert e3["producto"]["publicado"] is True
    assert e3["oculta"] is True
    assert e3["visible_publicamente"] is False
    assert e3["producto"]["nombre"] == "Galletas"
    e1 = _por_codigo(_por_lote(client, base, "L-42"))["E1"]
    assert e1["producto"]["publicado"] is False
    assert e1["oculta"] is False


# --- PT08-08 / CA9 --------------------------------------------------------------------------------------


def test_pt08_08_la_consulta_por_lote_no_modifica_ninguna_tabla(client, base, db_session) -> None:
    antes = _foto(db_session)

    primera = _por_lote(client, base, "L-42")
    segunda = _por_lote(client, base, "L-43")

    assert _foto(db_session) == antes
    assert primera["elaboraciones"] and segunda["elaboraciones"]


# --- PT08-09 / CA10 ---------------------------------------------------------------------------------------


def test_pt08_09_lote_de_otro_productor_inexistente_o_de_otro_insumo_responden_404_con_el_mismo_cuerpo(client, base) -> None:
    otro = registrar(client, PRODUCTOR_B)
    # A lot of ANOTHER supply of the same productor: Y gets its own lot.
    _elaborar(client, base, base["producto"]["id"], "EY", "2026-10-02", {"insumo_id": base["insumo_y"]["id"], "lote": {"tipo": "nuevo", "codigo": "Y-1", "fecha_vencimiento": None}})
    lote_y = client.get(f"/gestion/insumos/{base['insumo_y']['id']}/lotes", headers=base["headers"]).json()[0]["id"]
    l42 = base["lotes"]["L-42"]

    casos = {
        "otro productor": client.get(_url(base["x"], l42), headers=otro),
        "lote inexistente": client.get(_url(base["x"], 999999), headers=base["headers"]),
        "lote de otro insumo": client.get(_url(base["x"], lote_y), headers=base["headers"]),
        "insumo inexistente": client.get(_url(999999, l42), headers=base["headers"]),
        "insumo de otro productor": client.get(_url(base["x"], l42), headers=otro),
    }

    for nombre, respuesta in casos.items():
        assert respuesta.status_code == 404, nombre
    assert len({respuesta.text for respuesta in casos.values()}) == 1
    assert casos["lote inexistente"].json() == {"detail": "Lote no encontrado"}
    # The lot of the other supply does answer under its own supply.
    assert client.get(_url(base["insumo_y"]["id"], lote_y), headers=base["headers"]).status_code == 200


def test_el_lote_de_otro_productor_con_el_mismo_codigo_no_mezcla_elaboraciones(client, base) -> None:
    otro = registrar(client, PRODUCTOR_B)
    # Productor B has its own flour supply and lot "L-42": its elaboraciones never reach A's result.
    from tests.escenario_hu05 import crear_elaboracion, preparar

    ajeno = preparar(client, otro)
    insumo_b = crear_insumo(client, otro, ajeno["harina"]["id"], "Harina de B")
    elaboracion = crear_elaboracion(client, otro, ajeno["producto"]["id"], codigo="B-1")
    assert elaboracion.status_code == 201
    usos = client.put(
        f"/gestion/elaboraciones/{elaboracion.json()['id']}/usos",
        headers=otro,
        json={"usos": [
            {"ingrediente_id": ajeno["harina"]["id"], "insumo_id": insumo_b["id"], "lote": {"tipo": "nuevo", "codigo": "L-42", "fecha_vencimiento": None}},
            {"ingrediente_id": ajeno["leche"]["id"], "insumo_id": ajeno["insumo_habitual"]["id"], "lote": SIN_LOTE},
        ]},
    )  # fmt: skip
    assert usos.status_code == 200, usos.text

    cuerpo = _por_lote(client, base, "L-42")

    assert "B-1" not in _por_codigo(cuerpo)
    assert _ids(cuerpo) == {base["ids"]["E1"], base["ids"]["E4"]}


def test_requiere_autenticacion(client, base) -> None:
    assert client.get(_url(base["x"], base["lotes"]["L-42"])).status_code in (401, 403)


# --- Performance: exact number of queries ---------------------------------------------------------------


def test_la_consulta_por_lote_hace_un_numero_constante_de_consultas(client, base, db_session) -> None:
    url = _url(base["x"], base["lotes"]["L-42"])
    pocas = contar_consultas(client, db_session, url, base["headers"])

    for numero in range(10, 16):
        _elaborar(client, base, base["producto"]["id"], f"M-{numero}", "2026-10-02", {"insumo_id": base["x"], "lote": {"tipo": "existente", "lote_id": base["lotes"]["L-42"]}})
        _elaborar(client, base, base["galletas"]["id"], f"S-{numero}", "2026-10-03", {"insumo_id": base["x"], "lote": SIN_LOTE}, finalizar=False)
    assert _por_lote(client, base, "L-42")["resumen"]["total_elaboraciones"] == 8

    muchas = contar_consultas(client, db_session, url, base["headers"])

    assert pocas == muchas == (CONSULTAS_DE_AUTENTICACION, CONSULTAS_DE_DATOS_POR_LOTE)


def test_los_usos_de_la_consulta_por_lote_son_los_de_las_filas_de_la_base(client, base, db_session) -> None:
    """Cross-check against the database: the ids returned are those whose use points to the lot."""
    from app.models import UsoInsumo

    db_session.expire_all()
    en_base = set(db_session.scalars(select(UsoInsumo.elaboracion_id).where(UsoInsumo.lote_id == base["lotes"]["L-42"])))

    assert _ids(_por_lote(client, base, "L-42")) == en_base
