"""Elaboraciones related to a supply (T08-01 / HU08).

GET /gestion/insumos/{insumo_id}/elaboraciones. Covers PT08-01, PT08-03, PT08-04, PT08-05, PT08-06
(API part), PT08-07 (supply part, OE3), PT08-08 and PT08-09 (supply part), plus RT-03, the three
equivalence tests of D1 (the use columns of a finalizada equal its conserved copy) and the absence
of N+1. The lot query (PT08-02) belongs to T08-02 and the screen (PT08-10) to T08-04.

Base scenario (supply X "Harina Selecta 1 kg", lots L-42 and L-43; supply Y is another flour):
    E1 Queque   2026-10-01 finalizada  X lote L-42
    E2 Queque   2026-10-03 finalizada  X sin lote
    E3 Galletas 2026-10-04 finalizada  X lote L-43, hidden, product published
    E4 Galletas 2026-10-05 borrador    X lote L-42
    E5 Queque   2026-10-02 finalizada  Y (does not use X)
    E6 Queque   2026-10-06 borrador    nothing assigned (does not use X)
"""

from datetime import date

import pytest
from sqlalchemy import event, select

from app.models import (
    Elaboracion,
    ElaboracionOculta,
    InsumoComercial,
    LoteInsumo,
    Producto,
    UsoInsumo,
)
from app.services import elaboracion_service
from tests.escenario_hu05 import PRODUCTOR_B, crear_elaboracion, crear_insumo, crear_producto, formular, preparar, registrar

HOY = date(2026, 10, 6)
SIN_LOTE = {"tipo": "sin_lote"}


@pytest.fixture(autouse=True)
def hoy_fijo(monkeypatch) -> None:
    monkeypatch.setattr(elaboracion_service, "hoy_santiago", lambda: HOY)


def _asignar(client, headers, elaboracion_id: int, ctx: dict, harina: dict | None, leche: dict | None = None) -> None:
    """PUT the assignment: `harina` / `leche` are {insumo_id, lote} or None (nothing chosen)."""
    leche = leche if leche is not None else {"insumo_id": ctx["insumo_habitual"]["id"], "lote": SIN_LOTE}
    usos = []
    for ingrediente, valor in ((ctx["harina"], harina), (ctx["leche"], leche)):
        uso = {"ingrediente_id": ingrediente["id"]}
        if valor is not None:
            uso["insumo_id"] = valor["insumo_id"]
            if valor.get("lote") is not None:
                uso["lote"] = valor["lote"]
        usos.append(uso)
    respuesta = client.put(f"/gestion/elaboraciones/{elaboracion_id}/usos", headers=headers, json={"usos": usos})
    assert respuesta.status_code == 200, respuesta.text


def _elaborar(client, ctx: dict, producto_id: int, codigo: str, fecha: str, harina, *, finalizar: bool = True) -> int:
    respuesta = crear_elaboracion(client, ctx["headers"], producto_id, codigo=codigo, fecha=fecha)
    assert respuesta.status_code == 201, respuesta.text
    elaboracion_id = respuesta.json()["id"]
    # A new borrador inherits the assignment of the last finalizada of its product: always set it.
    _asignar(client, ctx["headers"], elaboracion_id, ctx, harina)
    if finalizar:
        final = client.post(f"/gestion/elaboraciones/{elaboracion_id}/finalizar", headers=ctx["headers"])
        assert final.status_code == 200, final.text
    return elaboracion_id


def _lotes(client, ctx: dict, insumo_id: int) -> dict[str, int]:
    respuesta = client.get(f"/gestion/insumos/{insumo_id}/lotes", headers=ctx["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return {lote["codigo"]: lote["id"] for lote in respuesta.json()}


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    base["insumo_x"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    base["insumo_y"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Otra Marca 1 kg")
    galletas = crear_producto(client, headers, "Galletas", "gal-001")
    formular(client, headers, galletas["id"], base["harina"], base["leche"])
    base["galletas"] = galletas
    return {"headers": headers, **base}


@pytest.fixture
def base(client, ctx) -> dict:
    """The base scenario of the plan (section 7 of the HU08 context)."""
    x = ctx["insumo_x"]["id"]
    queque, galletas = ctx["producto"]["id"], ctx["galletas"]["id"]
    ids = {}
    ids["E1"] = _elaborar(
        client, ctx, queque, "E1", "2026-10-01", {"insumo_id": x, "lote": {"tipo": "nuevo", "codigo": "L-42", "fecha_vencimiento": "2026-12-01"}}
    )
    ids["E2"] = _elaborar(client, ctx, queque, "E2", "2026-10-03", {"insumo_id": x, "lote": SIN_LOTE})
    ids["E3"] = _elaborar(
        client, ctx, galletas, "E3", "2026-10-04", {"insumo_id": x, "lote": {"tipo": "nuevo", "codigo": "L-43", "fecha_vencimiento": None}}
    )
    lotes = _lotes(client, ctx, x)
    ids["E4"] = _elaborar(
        client, ctx, galletas, "E4", "2026-10-05", {"insumo_id": x, "lote": {"tipo": "existente", "lote_id": lotes["L-42"]}}, finalizar=False
    )
    ids["E5"] = _elaborar(client, ctx, queque, "E5", "2026-10-02", {"insumo_id": ctx["insumo_y"]["id"], "lote": SIN_LOTE})
    ids["E6"] = _elaborar(client, ctx, queque, "E6", "2026-10-06", None, finalizar=False)
    # Galletas published, E3 hidden. Queque stays unpublished.
    assert client.post(f"/gestion/productos/{galletas}/publicacion", headers=ctx["headers"]).status_code == 200
    assert client.post(f"/gestion/elaboraciones/{ids['E3']}/ocultar", headers=ctx["headers"]).status_code == 200
    return {**ctx, "ids": ids, "lotes": lotes, "x": x}


def _consultar(client, ctx: dict, insumo_id: int, headers=None) -> dict:
    respuesta = client.get(f"/gestion/insumos/{insumo_id}/elaboraciones", headers=headers or ctx["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _por_codigo(cuerpo: dict) -> dict[str, dict]:
    return {e["codigo"]: e for e in cuerpo["elaboraciones"]}


# --- PT08-01 / CA1, CA3 ---------------------------------------------------------------------------


def test_pt08_01_consulta_por_insumo_devuelve_las_cuatro_con_producto_fecha_y_codigo(client, base) -> None:
    cuerpo = _consultar(client, base, base["x"])

    assert cuerpo["insumo"] == {"id": base["x"], "nombre": "Harina Selecta 1 kg", "activo": True}
    # Order of the history: date desc, id desc.
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E4", "E3", "E2", "E1"]
    e1 = _por_codigo(cuerpo)["E1"]
    assert e1["id"] == base["ids"]["E1"]
    assert e1["fecha"] == "2026-10-01"
    assert e1["producto"]["nombre"] == "Queque de vainilla"
    assert _por_codigo(cuerpo)["E3"]["producto"]["nombre"] == "Galletas"
    assert cuerpo["resumen"]["total_elaboraciones"] == 4
    assert cuerpo["resumen"]["total_productos"] == 2


def test_la_respuesta_solo_tiene_los_campos_acordados(client, base) -> None:
    cuerpo = _consultar(client, base, base["x"])

    assert set(cuerpo) == {"insumo", "resumen", "elaboraciones"}
    assert set(cuerpo["resumen"]) == {
        "total_elaboraciones",
        "total_productos",
        "finalizadas",
        "borradores",
        "visibles_publicamente",
        "elaboraciones_sin_lote",
    }
    elaboracion = cuerpo["elaboraciones"][0]
    assert set(elaboracion) == {
        "id", "codigo", "fecha", "estado", "finalizada_at", "producto", "oculta",
        "visible_publicamente", "origen_datos", "usos",
    }  # fmt: skip
    assert set(elaboracion["producto"]) == {"id", "nombre", "publicado"}
    assert set(elaboracion["usos"][0]) == {"ingrediente", "insumo_nombre", "lote", "lote_estado"}


# --- PT08-03 / CA4 --------------------------------------------------------------------------------


def test_pt08_03_distingue_finalizadas_y_borrador_con_el_origen_de_los_datos(client, base) -> None:
    cuerpo = _consultar(client, base, base["x"])
    por_codigo = _por_codigo(cuerpo)

    assert [por_codigo[c]["estado"] for c in ("E1", "E2", "E3", "E4")] == ["finalizada", "finalizada", "finalizada", "borrador"]
    assert [por_codigo[c]["origen_datos"] for c in ("E1", "E2", "E3", "E4")] == ["conservada", "conservada", "conservada", "vigente"]
    assert por_codigo["E1"]["finalizada_at"] is not None
    assert por_codigo["E4"]["finalizada_at"] is None
    assert cuerpo["resumen"]["finalizadas"] == 3
    assert cuerpo["resumen"]["borradores"] == 1


def test_borrador_con_lote_pendiente_se_marca_pendiente_y_el_borrador_muestra_datos_vigentes(client, base) -> None:
    pendiente = _elaborar(client, base, base["producto"]["id"], "E7", "2026-10-05", {"insumo_id": base["x"], "lote": None}, finalizar=False)

    por_codigo = _por_codigo(_consultar(client, base, base["x"]))

    uso = por_codigo["E7"]["usos"][0]
    assert por_codigo["E7"]["id"] == pendiente
    assert uso["lote_estado"] == "pendiente"
    assert uso["lote"] is None
    assert uso["insumo_nombre"] == "Harina Selecta 1 kg"
    # The borrador with a lot reads the current lot.
    assert por_codigo["E4"]["usos"][0]["lote"]["codigo"] == "L-42"
    assert por_codigo["E4"]["usos"][0]["lote_estado"] == "con_lote"


# --- PT08-04 / CA5, RT-03 -------------------------------------------------------------------------


def test_pt08_04_las_finalizadas_siguen_identificadas_tras_cambiar_el_insumo_en_otro_borrador_y_la_ficha(client, base, db_session) -> None:
    x, y = base["x"], base["insumo_y"]["id"]
    # E6 (borrador) uses X: it appears. Then its ingredient changes to another supply: it leaves.
    _asignar(client, base["headers"], base["ids"]["E6"], base, {"insumo_id": x, "lote": SIN_LOTE})
    assert "E6" in _por_codigo(_consultar(client, base, x))
    _asignar(client, base["headers"], base["ids"]["E6"], base, {"insumo_id": y, "lote": SIN_LOTE})
    # The ficha of X changes after the finalizations.
    cambio = client.patch(
        f"/gestion/insumos/{x}",
        headers=base["headers"],
        json={"nombre": "Harina Renombrada 2 kg", "presentacion": "Bolsa 2 kg", "advertencias": "Cambió la ficha"},
    )
    assert cambio.status_code == 200, cambio.text

    cuerpo = _consultar(client, base, x)
    por_codigo = _por_codigo(cuerpo)

    assert sorted(por_codigo) == ["E1", "E2", "E3", "E4"]
    for codigo in ("E1", "E2", "E3"):
        assert por_codigo[codigo]["usos"][0]["insumo_nombre"] == "Harina Selecta 1 kg"
    # The header and the borrador show what is current today.
    assert cuerpo["insumo"]["nombre"] == "Harina Renombrada 2 kg"
    assert por_codigo["E4"]["usos"][0]["insumo_nombre"] == "Harina Renombrada 2 kg"


def test_rt03_el_codigo_del_lote_mostrado_en_una_finalizada_es_el_conservado(client, base, db_session) -> None:
    lote = db_session.get(LoteInsumo, base["lotes"]["L-42"])
    lote.codigo = "CAMBIADO-HOY"
    db_session.commit()

    por_codigo = _por_codigo(_consultar(client, base, base["x"]))

    assert por_codigo["E1"]["usos"][0]["lote"]["codigo"] == "L-42"
    assert por_codigo["E1"]["usos"][0]["lote"]["fecha_vencimiento"] == "2026-12-01"
    assert por_codigo["E4"]["usos"][0]["lote"]["codigo"] == "CAMBIADO-HOY"


# --- D1: the columns of a finalizada equal its conserved copy --------------------------------------


def _usos_finalizados(db_session) -> list[UsoInsumo]:
    db_session.expire_all()
    stmt = select(UsoInsumo).join(Elaboracion, Elaboracion.id == UsoInsumo.elaboracion_id).where(Elaboracion.estado == "finalizada")
    return list(db_session.scalars(stmt))


def _verificar_invariante(db_session) -> int:
    usos = _usos_finalizados(db_session)
    for uso in usos:
        copia = uso.informacion_conservada
        assert copia is not None
        assert copia["insumo"]["id"] == uso.insumo_id
        assert (copia["lote"]["id"] if copia["lote"] else None) == uso.lote_id
        assert copia["sin_lote"] == uso.sin_lote
    return len(usos)


def test_d1_en_toda_finalizada_las_columnas_coinciden_con_la_copia_conservada(client, base, db_session) -> None:
    total = _verificar_invariante(db_session)

    usos = _usos_finalizados(db_session)
    # E1, E2, E3, E5 have two uses each: the check covers lot, no lot and both supplies.
    assert total == 8
    assert any(uso.lote_id is not None for uso in usos)
    assert any(uso.sin_lote for uso in usos)
    assert {uso.insumo_id for uso in usos} >= {base["x"], base["insumo_y"]["id"]}


def test_d1_el_invariante_se_mantiene_tras_cambios_vigentes(client, base, db_session) -> None:
    assert client.patch(f"/gestion/insumos/{base['x']}", headers=base["headers"], json={"nombre": "Otro nombre"}).status_code == 200
    db_session.get(LoteInsumo, base["lotes"]["L-42"]).codigo = "OTRO"
    db_session.commit()
    _asignar(client, base["headers"], base["ids"]["E4"], base, {"insumo_id": base["insumo_y"]["id"], "lote": SIN_LOTE})
    assert client.delete(f"/gestion/insumos/{base['x']}", headers=base["headers"]).status_code == 204

    assert _verificar_invariante(db_session) == 8


def test_d1_las_finalizadas_devueltas_son_las_que_dicen_las_copias(client, base, db_session) -> None:
    """Oracle: the set computed only from the JSON copies equals the one the API returns."""
    esperado = {
        uso.elaboracion_id
        for uso in _usos_finalizados(db_session)
        if uso.informacion_conservada["insumo"]["id"] == base["x"]
    }

    devuelto = {e["id"] for e in _consultar(client, base, base["x"])["elaboraciones"] if e["estado"] == "finalizada"}

    assert devuelto == esperado == {base["ids"][c] for c in ("E1", "E2", "E3")}


# --- PT08-05 / CA6 --------------------------------------------------------------------------------


def test_pt08_05_la_elaboracion_sin_lote_aparece_indicada_y_se_cuenta_en_el_resumen(client, base) -> None:
    cuerpo = _consultar(client, base, base["x"])
    por_codigo = _por_codigo(cuerpo)

    assert por_codigo["E2"]["usos"][0]["lote_estado"] == "sin_lote"
    assert por_codigo["E2"]["usos"][0]["lote"] is None
    for codigo in ("E1", "E3", "E4"):
        assert por_codigo[codigo]["usos"][0]["lote_estado"] == "con_lote"
    assert cuerpo["resumen"]["elaboraciones_sin_lote"] == 1


# --- PT08-06 / CA7 --------------------------------------------------------------------------------


def test_pt08_06_indica_producto_publicado_y_elaboracion_oculta(client, base) -> None:
    cuerpo = _consultar(client, base, base["x"])
    por_codigo = _por_codigo(cuerpo)

    assert por_codigo["E3"]["producto"]["publicado"] is True
    assert por_codigo["E3"]["oculta"] is True
    assert por_codigo["E4"]["producto"]["publicado"] is True
    assert por_codigo["E1"]["producto"]["publicado"] is False
    assert [por_codigo[c]["oculta"] for c in ("E1", "E2", "E4")] == [False, False, False]
    # Nothing is visible yet: Queque is not published, E3 is hidden and E4 is a borrador.
    assert [e["visible_publicamente"] for e in cuerpo["elaboraciones"]] == [False] * 4
    assert cuerpo["resumen"]["visibles_publicamente"] == 0


def test_la_visibilidad_publica_sigue_la_regla_de_hu09(client, base) -> None:
    assert client.post(f"/gestion/productos/{base['producto']['id']}/publicacion", headers=base["headers"]).status_code == 200

    cuerpo = _consultar(client, base, base["x"])
    por_codigo = _por_codigo(cuerpo)

    assert por_codigo["E1"]["visible_publicamente"] is True
    assert por_codigo["E2"]["visible_publicamente"] is True
    assert por_codigo["E3"]["visible_publicamente"] is False
    assert por_codigo["E4"]["visible_publicamente"] is False
    assert cuerpo["resumen"]["visibles_publicamente"] == 2

    assert client.post(f"/gestion/elaboraciones/{base['ids']['E3']}/mostrar", headers=base["headers"]).status_code == 200
    assert _consultar(client, base, base["x"])["resumen"]["visibles_publicamente"] == 3


# --- PT08-07 / CA8 (OE3): expected set against returned set -----------------------------------------


def test_pt08_07_el_conjunto_devuelto_es_el_esperado_100_por_ciento_relacionadas_0_por_ciento_no_relacionadas(client, base) -> None:
    ids = base["ids"]
    esperados = {
        base["x"]: {ids["E1"], ids["E2"], ids["E3"], ids["E4"]},
        base["insumo_y"]["id"]: {ids["E5"]},
    }
    todas = set(ids.values())
    for insumo_id, relacionadas in esperados.items():
        devueltas = {e["id"] for e in _consultar(client, base, insumo_id)["elaboraciones"]}
        no_relacionadas = todas - relacionadas

        encontradas = len(devueltas & relacionadas) / len(relacionadas)
        de_mas = len(devueltas & no_relacionadas) / len(no_relacionadas)

        assert encontradas == 1.0
        assert de_mas == 0.0
        assert devueltas == relacionadas


def test_un_insumo_sin_usos_devuelve_lista_vacia_y_resumen_en_cero(client, base) -> None:
    sin_usos = crear_insumo(client, base["headers"], base["harina"]["id"], "Harina nunca usada")

    cuerpo = _consultar(client, base, sin_usos["id"])

    assert cuerpo["elaboraciones"] == []
    assert cuerpo["resumen"] == {
        "total_elaboraciones": 0,
        "total_productos": 0,
        "finalizadas": 0,
        "borradores": 0,
        "visibles_publicamente": 0,
        "elaboraciones_sin_lote": 0,
    }


def test_cada_elaboracion_aparece_una_sola_vez_con_un_uso_del_insumo(client, base) -> None:
    """A supply belongs to one ingredient, so an elaboración has at most one use of it."""
    cuerpo = _consultar(client, base, base["x"])

    codigos = [e["codigo"] for e in cuerpo["elaboraciones"]]
    assert len(codigos) == len(set(codigos)) == 4
    assert all(len(e["usos"]) == 1 for e in cuerpo["elaboraciones"])
    assert all(e["usos"][0]["ingrediente"]["nombre"] == "Harina" for e in cuerpo["elaboraciones"])


def test_un_insumo_desactivado_sigue_siendo_consultable(client, base) -> None:
    assert client.delete(f"/gestion/insumos/{base['x']}", headers=base["headers"]).status_code == 204

    cuerpo = _consultar(client, base, base["x"])

    assert cuerpo["insumo"]["activo"] is False
    assert cuerpo["resumen"]["total_elaboraciones"] == 4


# --- PT08-08 / CA9: reading changes nothing ----------------------------------------------------------


def _foto(db_session) -> dict:
    db_session.expire_all()
    foto = {}
    for modelo in (Elaboracion, UsoInsumo, InsumoComercial, LoteInsumo, ElaboracionOculta, Producto):
        columnas = [columna.key for columna in modelo.__table__.columns]
        filas = [tuple(repr(getattr(fila, nombre)) for nombre in columnas) for fila in db_session.scalars(select(modelo))]
        foto[modelo.__tablename__] = sorted(filas)
    return foto


def test_pt08_08_la_consulta_no_modifica_ningun_registro(client, base, db_session) -> None:
    antes = _foto(db_session)

    primera = _consultar(client, base, base["x"])
    segunda = _consultar(client, base, base["x"])

    assert _foto(db_session) == antes
    assert primera == segunda
    assert sum(len(filas) for filas in antes.values()) > 20


# --- PT08-09 / CA10: only the authenticated productor's data -----------------------------------------


def test_pt08_09_un_insumo_de_otro_productor_responde_404(client, base) -> None:
    otro = registrar(client, PRODUCTOR_B)

    respuesta = client.get(f"/gestion/insumos/{base['x']}/elaboraciones", headers=otro)

    assert respuesta.status_code == 404
    assert respuesta.json() == client.get("/gestion/insumos/999999/elaboraciones", headers=otro).json()


def test_un_insumo_inexistente_responde_404(client, base) -> None:
    assert client.get("/gestion/insumos/999999/elaboraciones", headers=base["headers"]).status_code == 404


def test_ca10_nunca_incluye_elaboraciones_de_otro_productor(client, base, db_session) -> None:
    """Even if a row of another productor pointed to this supply, the result would not include it."""
    otro = registrar(client, PRODUCTOR_B)
    ajeno = preparar(client, otro)
    elaboracion = crear_elaboracion(client, otro, ajeno["producto"]["id"], codigo="AJENA")
    assert elaboracion.status_code == 201, elaboracion.text
    uso = db_session.scalar(
        select(UsoInsumo).where(
            UsoInsumo.elaboracion_id == elaboracion.json()["id"],
            UsoInsumo.ingrediente_id == ajeno["harina"]["id"],
        )
    )
    uso.insumo_id = base["x"]
    db_session.commit()

    cuerpo = _consultar(client, base, base["x"])

    assert "AJENA" not in _por_codigo(cuerpo)
    assert {e["id"] for e in cuerpo["elaboraciones"]} == {base["ids"][c] for c in ("E1", "E2", "E3", "E4")}
    assert cuerpo["resumen"]["total_elaboraciones"] == 4


def test_requiere_autenticacion(client, base) -> None:
    assert client.get(f"/gestion/insumos/{base['x']}/elaboraciones").status_code in (401, 403)


# --- Performance: no N+1 -------------------------------------------------------------------------------


def _contar_consultas(client, db_session, ctx: dict, insumo_id: int) -> int:
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert client.get(f"/gestion/insumos/{insumo_id}/elaboraciones", headers=ctx["headers"]).status_code == 200
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)
    return len(sentencias)


def test_la_cantidad_de_consultas_es_constante_sin_n_mas_1(client, base, db_session) -> None:
    pocas = _contar_consultas(client, db_session, base, base["x"])

    for numero in range(10, 16):
        _elaborar(client, base, base["producto"]["id"], f"M-{numero}", "2026-10-02", {"insumo_id": base["x"], "lote": SIN_LOTE})
    _elaborar(client, base, base["galletas"]["id"], "M-20", "2026-10-03", {"insumo_id": base["x"], "lote": None}, finalizar=False)
    assert _consultar(client, base, base["x"])["resumen"]["total_elaboraciones"] == 11

    muchas = _contar_consultas(client, db_session, base, base["x"])

    assert pocas == muchas
    assert muchas <= CONSULTAS_MAXIMAS


# Authentication (token + productor), ownership of the supply and the single query of the uses.
CONSULTAS_MAXIMAS = 4
