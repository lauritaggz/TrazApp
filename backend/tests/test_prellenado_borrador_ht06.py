"""A new borrador starts from the last finalized elaboración of the product (HT06-04).

The supply the last finalized elaboración used for each ingredient is preselected when it is still
active and still belongs to that ingredient; otherwise the active habitual one; otherwise the line
stays empty. A lot is NEVER assigned: the detail of a borrador only SUGGESTS it (`lote_sugerido`)
and tells whether the allergens of the assigned supply were reviewed (`alergenos_revisados`).
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import text, update

from app.models import Elaboracion, InsumoComercial
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

VIEJA = "2026-03-01"
MEDIA = "2026-03-05"
RECIENTE = "2026-03-10"


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    return ctx


# --- ayudas ------------------------------------------------------------------------------


def _linea(ingrediente_id: int, insumo_id: int | None, lote: dict | None = None) -> dict:
    cuerpo: dict = {"ingrediente_id": ingrediente_id, "insumo_id": insumo_id}
    if lote is not None:
        cuerpo["lote"] = lote
    return cuerpo


def _sin_lote() -> dict:
    return {"tipo": "sin_lote"}


def _lote_nuevo(codigo: str, vencimiento: str | None = None) -> dict:
    return {"tipo": "nuevo", "codigo": codigo, "fecha_vencimiento": vencimiento}


def _borrador(client, ctx, codigo: str | None = None, fecha: str | None = None, producto_id: int | None = None) -> dict:
    cuerpo = {k: v for k, v in (("codigo", codigo), ("fecha", fecha)) if v is not None}
    respuesta = crear_elaboracion(client, ctx["headers"], producto_id or ctx["producto"]["id"], **cuerpo)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _asignar(client, ctx, elaboracion_id: int, *lineas: dict):
    respuesta = client.put(
        f"/gestion/elaboraciones/{elaboracion_id}/usos", headers=ctx["headers"], json={"usos": list(lineas)}
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _finalizada(
    client,
    ctx,
    codigo: str,
    fecha: str,
    *,
    leche: int | None = None,
    lote_leche: dict | None = None,
    harina: int | None = None,
    lote_harina: dict | None = None,
    producto_id: int | None = None,
) -> int:
    """Create, assign and finalize an elaboración. Returns its id."""
    borrador = _borrador(client, ctx, codigo, fecha, producto_id)
    _asignar(
        client,
        ctx,
        borrador["id"],
        _linea(ctx["harina"]["id"], harina or ctx["insumo_harina"]["id"], lote_harina or _sin_lote()),
        _linea(ctx["leche"]["id"], leche or ctx["insumo_habitual"]["id"], lote_leche or _lote_nuevo(f"L-{codigo}")),
    )
    respuesta = client.post(f"/gestion/elaboraciones/{borrador['id']}/finalizar", headers=ctx["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return borrador["id"]


def _detalle(client, ctx, elaboracion_id: int) -> dict:
    respuesta = client.get(f"/gestion/elaboraciones/{elaboracion_id}", headers=ctx["headers"])
    assert respuesta.status_code == 200
    return respuesta.json()


def _de(detalle: dict, ingrediente_id: int) -> dict:
    return {uso["ingrediente_id"]: uso for uso in detalle["usos"]}[ingrediente_id]


def _insumo_de(detalle: dict, ingrediente_id: int) -> int | None:
    insumo = _de(detalle, ingrediente_id)["insumo"]
    return None if insumo is None else insumo["id"]


def _fijar(db_session, elaboracion_id: int, **valores) -> None:
    """Change columns of a finalizada. PostgreSQL forbids it with a trigger: lift it and put it back."""
    postgresql = db_session.get_bind().dialect.name == "postgresql"
    if postgresql:
        db_session.execute(text("ALTER TABLE elaboraciones DISABLE TRIGGER trg_elaboraciones_inmutables"))
        db_session.commit()
    try:
        db_session.execute(update(Elaboracion).where(Elaboracion.id == elaboracion_id).values(**valores))
        db_session.commit()
    finally:
        db_session.rollback()
        if postgresql:
            db_session.execute(text("ALTER TABLE elaboraciones ENABLE TRIGGER trg_elaboraciones_inmutables"))
            db_session.commit()


def _momento(hora: int) -> datetime:
    return datetime(2026, 3, 5, hora, 0, tzinfo=timezone.utc)


# --- el prellenado ---------------------------------------------------------------------------


def test_el_primer_borrador_de_un_producto_sin_finalizadas_se_comporta_como_antes(client, ctx) -> None:
    detalle = _borrador(client, ctx)

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]
    assert _insumo_de(detalle, ctx["harina"]["id"]) is None  # no habitual, nothing before
    for uso in detalle["usos"]:
        assert (uso["lote"], uso["sin_lote"], uso["lote_sugerido"]) == (None, False, None)


def test_el_borrador_parte_del_insumo_de_la_ultima_finalizada(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, leche=ctx["insumo_otro"]["id"])

    detalle = _borrador(client, ctx, "E-002")

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_otro"]["id"]  # not the habitual one
    assert _insumo_de(detalle, ctx["harina"]["id"]) == ctx["insumo_harina"]["id"]  # no habitual at all
    assert _de(detalle, ctx["leche"]["id"])["insumo"]["habitual"] is False


def test_nunca_asigna_un_lote_ni_sin_lote(client, ctx, db_session) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1", "2027-12-31"), lote_harina=_sin_lote())

    detalle = _borrador(client, ctx, "E-002")

    for uso in detalle["usos"]:
        assert (uso["lote"], uso["sin_lote"]) == (None, False)
        assert uso["pendiente"] is True and "lote" in uso["falta"]
    # Also when the detail is read again later.
    for uso in _detalle(client, ctx, detalle["id"])["usos"]:
        assert (uso["lote"], uso["sin_lote"]) == (None, False)


def test_ignora_los_borradores(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, leche=ctx["insumo_otro"]["id"])
    reciente = _borrador(client, ctx, "E-002", RECIENTE)
    _asignar(
        client,
        ctx,
        reciente["id"],
        _linea(ctx["harina"]["id"], ctx["insumo_harina"]["id"], _sin_lote()),
        _linea(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], _lote_nuevo("L-2")),
    )

    detalle = _borrador(client, ctx, "E-003")

    # The borrador E-002 is newer but it is not finalized: the starting point is still E-001.
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_otro"]["id"]


def test_ignora_las_finalizadas_de_otros_productos(client, ctx) -> None:
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    _finalizada(client, ctx, "G-001", RECIENTE, leche=ctx["insumo_otro"]["id"], producto_id=otro["id"])

    detalle = _borrador(client, ctx)

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]
    assert _insumo_de(detalle, ctx["harina"]["id"]) is None


def test_ignora_las_finalizadas_de_otros_productores(client, ctx) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    base_b = preparar(client, headers_b)
    ctx_b = {"headers": headers_b, **base_b}
    ctx_b["insumo_harina"] = crear_insumo(client, headers_b, base_b["harina"]["id"], "Harina B")
    _finalizada(client, ctx_b, "B-001", RECIENTE, leche=ctx_b["insumo_otro"]["id"])

    detalle = _borrador(client, ctx)

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]
    assert _insumo_de(detalle, ctx["harina"]["id"]) is None


# --- el desempate de «la última» ------------------------------------------------------------


def test_la_ultima_se_decide_primero_por_fecha_de_elaboracion(client, ctx) -> None:
    """E-001 is the newest by date even though E-002 was finalized after it."""
    _finalizada(client, ctx, "E-001", RECIENTE, leche=ctx["insumo_otro"]["id"])
    _finalizada(client, ctx, "E-002", VIEJA, leche=ctx["insumo_habitual"]["id"])

    detalle = _borrador(client, ctx, "E-003")

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_otro"]["id"]


def test_con_la_misma_fecha_gana_la_finalizada_mas_reciente(client, ctx, db_session) -> None:
    primera = _finalizada(client, ctx, "E-001", MEDIA, leche=ctx["insumo_otro"]["id"])
    segunda = _finalizada(client, ctx, "E-002", MEDIA, leche=ctx["insumo_habitual"]["id"])
    _fijar(db_session, primera, finalizada_at=_momento(10))
    _fijar(db_session, segunda, finalizada_at=_momento(11))

    detalle = _borrador(client, ctx, "E-003")
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]

    # finalizada_at decides before the id: the first one (lower id) finalized last wins.
    _fijar(db_session, primera, finalizada_at=_momento(12))
    detalle = _borrador(client, ctx, "E-004")
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_otro"]["id"]


def test_con_la_misma_fecha_y_la_misma_finalizacion_gana_el_id_mayor(client, ctx, db_session) -> None:
    primera = _finalizada(client, ctx, "E-001", MEDIA, leche=ctx["insumo_otro"]["id"])
    segunda = _finalizada(client, ctx, "E-002", MEDIA, leche=ctx["insumo_habitual"]["id"])
    assert segunda > primera
    _fijar(db_session, primera, finalizada_at=_momento(10))
    _fijar(db_session, segunda, finalizada_at=_momento(10))

    detalle = _borrador(client, ctx, "E-003")

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]


# --- cuándo cae al habitual -------------------------------------------------------------------


def test_un_insumo_anterior_desactivado_cae_al_habitual(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, leche=ctx["insumo_otro"]["id"])
    assert client.delete(f"/gestion/insumos/{ctx['insumo_otro']['id']}", headers=ctx["headers"]).status_code == 204

    detalle = _borrador(client, ctx, "E-002")

    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]


def test_un_insumo_anterior_desactivado_sin_habitual_deja_la_linea_vacia(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA)
    assert client.delete(f"/gestion/insumos/{ctx['insumo_harina']['id']}", headers=ctx["headers"]).status_code == 204

    detalle = _borrador(client, ctx, "E-002")

    harina = _de(detalle, ctx["harina"]["id"])
    assert harina["insumo"] is None and harina["falta"] == ["insumo", "lote"]
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]  # the other line still prefills


def test_un_insumo_que_cambio_de_ingrediente_cae_al_habitual_o_queda_vacio(client, ctx) -> None:
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")
    _finalizada(client, ctx, "E-001", VIEJA, leche=ctx["insumo_otro"]["id"])
    for insumo in (ctx["insumo_otro"], ctx["insumo_harina"]):
        cambio = client.patch(
            f"/gestion/insumos/{insumo['id']}", headers=ctx["headers"], json={"ingrediente_id": azucar["id"]}
        )
        assert cambio.status_code == 200, cambio.text

    detalle = _borrador(client, ctx, "E-002")

    # Leche falls back to its habitual supply; harina has none, so the line is empty.
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_habitual"]["id"]
    assert _insumo_de(detalle, ctx["harina"]["id"]) is None


def test_un_ingrediente_nuevo_en_la_version_vigente_cae_al_habitual(client, ctx) -> None:
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")
    habitual_azucar = crear_insumo(client, ctx["headers"], azucar["id"], "Azúcar Iansa 1 kg", habitual=True)
    _finalizada(client, ctx, "E-001", VIEJA, leche=ctx["insumo_otro"]["id"])
    formular(client, ctx["headers"], ctx["producto"]["id"], ctx["harina"], ctx["leche"], azucar)

    detalle = _borrador(client, ctx, "E-002")

    assert detalle["version"]["id"] != ctx["version"]["id"]
    assert _insumo_de(detalle, azucar["id"]) == habitual_azucar["id"]  # no previous use: the habitual one
    assert _insumo_de(detalle, ctx["leche"]["id"]) == ctx["insumo_otro"]["id"]  # the rest follows E-001
    assert _insumo_de(detalle, ctx["harina"]["id"]) == ctx["insumo_harina"]["id"]


def test_un_ingrediente_nuevo_sin_habitual_queda_vacio(client, ctx) -> None:
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")
    crear_insumo(client, ctx["headers"], azucar["id"], "Azúcar Iansa 1 kg")  # active but not habitual
    _finalizada(client, ctx, "E-001", VIEJA)
    formular(client, ctx["headers"], ctx["producto"]["id"], ctx["harina"], ctx["leche"], azucar)

    detalle = _borrador(client, ctx, "E-002")

    assert _insumo_de(detalle, azucar["id"]) is None


# --- lote_sugerido ------------------------------------------------------------------------------


def _sugerido(detalle: dict, ingrediente_id: int):
    return _de(detalle, ingrediente_id)["lote_sugerido"]


def test_sugiere_el_lote_de_la_ultima_finalizada_si_sigue_siendo_valido(client, ctx) -> None:
    primera = _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1", "2027-12-31"))
    anterior = _detalle(client, ctx, primera)

    borrador = _borrador(client, ctx, "E-002")

    sugerido = _sugerido(borrador, ctx["leche"]["id"])
    assert sugerido == {
        "id": _de(anterior, ctx["leche"]["id"])["lote"]["id"],
        "codigo": "L-1",
        "fecha_vencimiento": "2027-12-31",
    }
    # It is only a suggestion: the line still has no lot and is still pending.
    leche = _de(borrador, ctx["leche"]["id"])
    assert (leche["lote"], leche["sin_lote"], leche["pendiente"]) == (None, False, True)
    assert _sugerido(_detalle(client, ctx, borrador["id"]), ctx["leche"]["id"]) == sugerido


def test_no_sugiere_nada_si_el_uso_anterior_fue_sin_lote(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_harina=_sin_lote())

    borrador = _borrador(client, ctx, "E-002")

    assert _sugerido(borrador, ctx["harina"]["id"]) is None
    assert _sugerido(borrador, ctx["leche"]["id"]) is not None


def test_no_sugiere_el_lote_si_el_insumo_de_la_linea_cambio(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1"))
    borrador = _borrador(client, ctx, "E-002")
    assert _sugerido(borrador, ctx["leche"]["id"]) is not None
    harina = _linea(ctx["harina"]["id"], ctx["insumo_harina"]["id"])

    otro_insumo = _asignar(client, ctx, borrador["id"], harina, _linea(ctx["leche"]["id"], ctx["insumo_otro"]["id"]))
    assert _sugerido(otro_insumo, ctx["leche"]["id"]) is None  # the lot belongs to the previous supply

    de_vuelta = _asignar(client, ctx, borrador["id"], harina, _linea(ctx["leche"]["id"], ctx["insumo_habitual"]["id"]))
    assert _sugerido(de_vuelta, ctx["leche"]["id"])["codigo"] == "L-1"


@pytest.mark.parametrize(
    ("vencimiento", "fecha_borrador", "se_sugiere"),
    [
        ("2026-03-10", "2026-03-09", True),  # not expired yet
        ("2026-03-10", "2026-03-10", True),  # expires the same day: still valid
        ("2026-03-10", "2026-03-11", False),  # expired the day before
        (None, "2026-03-11", True),  # no expiry date
    ],
)
def test_un_lote_vencido_no_se_sugiere(client, ctx, vencimiento, fecha_borrador, se_sugiere) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1", vencimiento))

    borrador = _borrador(client, ctx, "E-002", fecha_borrador)

    assert (_sugerido(borrador, ctx["leche"]["id"]) is not None) is se_sugiere


def test_el_vencimiento_se_compara_con_la_fecha_actual_del_borrador(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1", "2026-03-10"))
    borrador = _borrador(client, ctx, "E-002", "2026-03-10")
    assert _sugerido(borrador, ctx["leche"]["id"]) is not None

    cambiado = client.patch(f"/gestion/elaboraciones/{borrador['id']}", headers=ctx["headers"], json={"fecha": "2026-03-11"})

    assert cambiado.status_code == 200
    assert _sugerido(_detalle(client, ctx, borrador["id"]), ctx["leche"]["id"]) is None


def test_no_hay_sugerencia_cuando_la_linea_ya_tiene_lote_o_sin_lote(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1"))
    borrador = _borrador(client, ctx, "E-002")
    harina = _linea(ctx["harina"]["id"], ctx["insumo_harina"]["id"], _sin_lote())

    con_lote = _asignar(client, ctx, borrador["id"], harina, _linea(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], _lote_nuevo("L-9")))
    assert _sugerido(con_lote, ctx["leche"]["id"]) is None

    con_sin_lote = _asignar(client, ctx, borrador["id"], harina, _linea(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], _sin_lote()))
    assert _sugerido(con_sin_lote, ctx["leche"]["id"]) is None


def test_no_hay_sugerencia_en_una_linea_sin_insumo(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1"))
    borrador = _borrador(client, ctx, "E-002")

    sin_insumo = _asignar(
        client,
        ctx,
        borrador["id"],
        _linea(ctx["harina"]["id"], ctx["insumo_harina"]["id"]),
        _linea(ctx["leche"]["id"], None),
    )

    assert _sugerido(sin_insumo, ctx["leche"]["id"]) is None


def test_en_una_finalizada_el_lote_sugerido_es_null(client, ctx) -> None:
    _finalizada(client, ctx, "E-001", VIEJA, lote_leche=_lote_nuevo("L-1"))
    segunda = _finalizada(client, ctx, "E-002", RECIENTE, lote_leche=_lote_nuevo("L-2"))

    detalle = _detalle(client, ctx, segunda)

    assert detalle["estado"] == "finalizada"
    assert all(uso["lote_sugerido"] is None for uso in detalle["usos"])


# --- alergenos_revisados por línea ----------------------------------------------------------------


def test_cada_linea_indica_si_los_alergenos_de_su_insumo_estan_revisados(client, ctx, db_session) -> None:
    sin_revisar = crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Harina sin revisar", revisado=False)
    borrador = _borrador(client, ctx)
    harina, leche = ctx["harina"]["id"], ctx["leche"]["id"]

    assert _de(borrador, harina)["alergenos_revisados"] is False  # no supply at all
    assert _de(borrador, leche)["alergenos_revisados"] is True  # the habitual one was created reviewed

    asignado = _asignar(client, ctx, borrador["id"], _linea(harina, sin_revisar["id"]), _linea(leche, ctx["insumo_habitual"]["id"]))
    assert _de(asignado, harina)["alergenos_revisados"] is False  # a supply nobody reviewed

    revisado = client.put(f"/gestion/insumos/{sin_revisar['id']}/alergenos", headers=ctx["headers"], json={"alergenos": []})
    assert revisado.status_code == 200
    assert _de(_detalle(client, ctx, borrador["id"]), harina)["alergenos_revisados"] is True  # "reviewed, no allergens"

    db_session.execute(update(InsumoComercial).where(InsumoComercial.id == ctx["insumo_habitual"]["id"]).values(alergenos_revisados_at=None))
    db_session.commit()
    db_session.expire_all()
    assert _de(_detalle(client, ctx, borrador["id"]), leche)["alergenos_revisados"] is False


def test_en_una_finalizada_alergenos_revisados_sale_de_la_copia(client, ctx, db_session) -> None:
    finalizada = _finalizada(client, ctx, "E-001", VIEJA)
    # The supply is un-reviewed afterwards: the finalized elaboración still shows what it conserved.
    db_session.execute(update(InsumoComercial).values(alergenos_revisados_at=None))
    db_session.commit()
    db_session.expire_all()

    detalle = _detalle(client, ctx, finalizada)

    assert all(uso["alergenos_revisados"] is True for uso in detalle["usos"])
    assert all(uso["insumo"]["alergenos_revisados_at"] is not None for uso in detalle["usos"])
