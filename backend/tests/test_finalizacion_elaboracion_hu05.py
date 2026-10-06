"""Finalizing an elaboración: validation, immutable copy and read from the copy (T05-04 / HU05).

POST /gestion/elaboraciones/{id}/finalizar. Covers PT05-09 (the four kinds of problem), PT05-10
(complete elaboración), PT05-12 and CA13 (nothing done to the supply, the ingredient or the
formulation afterwards alters what was conserved) and PT05-15 (the detail shows the copy).
Persistence from an independent session and concurrency: test_persistencia_finalizacion_hu05.py.
"""

from datetime import datetime

import pytest
from sqlalchemy import select, update

from app.models import Elaboracion, LoteInsumo, UsoInsumo, VersionProducto
from tests.escenario_hu05 import (
    EAN_LECHE,
    PRODUCTOR_B,
    asignacion_completa,
    completar_insumo,
    crear_alergenos,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    formular,
    preparar,
    registrar,
)


@pytest.fixture
def ctx(client, db_session) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["alergenos"] = crear_alergenos(db_session)
    completar_insumo(client, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    ctx["elaboracion"] = crear_elaboracion(client, headers, base["producto"]["id"]).json()
    return ctx


def _url(ctx, elaboracion_id: int | None = None, sufijo: str = "") -> str:
    return f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}{sufijo}"


def _asignar(client, ctx, usos: list[dict] | None = None, elaboracion_id: int | None = None):
    response = client.put(
        _url(ctx, elaboracion_id, "/usos"),
        headers=ctx["headers"],
        json={"usos": usos if usos is not None else asignacion_completa(ctx)},
    )
    assert response.status_code == 200, response.text
    return response


def _finalizar(client, ctx, elaboracion_id: int | None = None, headers=None):
    return client.post(_url(ctx, elaboracion_id, "/finalizar"), headers=headers or ctx["headers"])


def _detalle(client, ctx, elaboracion_id: int | None = None) -> dict:
    return client.get(_url(ctx, elaboracion_id), headers=ctx["headers"]).json()


def _por_ingrediente(elaboracion: dict) -> dict[int, dict]:
    return {item["ingrediente_id"]: item for item in elaboracion["usos"]}


def _conservadas(db_session, elaboracion_id: int | None = None) -> dict[int, dict | None]:
    db_session.expire_all()
    stmt = select(UsoInsumo)
    if elaboracion_id is not None:
        stmt = stmt.where(UsoInsumo.elaboracion_id == elaboracion_id)
    return {uso.ingrediente_id: uso.informacion_conservada for uso in db_session.scalars(stmt)}


def _estado(db_session, elaboracion_id: int) -> tuple[str, object]:
    db_session.expire_all()
    elaboracion = db_session.get(Elaboracion, elaboracion_id)
    return elaboracion.estado, elaboracion.finalizada_at


def _nada_cambio(client, ctx, db_session, antes: dict) -> None:
    """A rejected finalization leaves the borrador exactly as it was."""
    assert _detalle(client, ctx) == antes
    assert _estado(db_session, ctx["elaboracion"]["id"]) == ("borrador", None)
    assert all(copia is None for copia in _conservadas(db_session).values())


# --- autenticación y pertenencia ---------------------------------------------------------


def test_la_ruta_requiere_autenticacion(client) -> None:
    assert client.post("/gestion/elaboraciones/1/finalizar").status_code == 401


def test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    antes = _detalle(client, ctx)
    headers_b = registrar(client, PRODUCTOR_B)

    assert _finalizar(client, ctx, headers=headers_b).status_code == 404
    assert _finalizar(client, ctx, elaboracion_id=99999).status_code == 404

    _nada_cambio(client, ctx, db_session, antes)


# --- PT05-10: finalizar una elaboración completa -----------------------------------------


def test_pt05_10_finaliza_una_elaboracion_completa_y_cambia_el_estado(client, ctx, db_session) -> None:
    _asignar(client, ctx)

    response = _finalizar(client, ctx)

    assert response.status_code == 200, response.text
    cuerpo = response.json()
    assert cuerpo["estado"] == "finalizada"
    assert cuerpo["finalizada_at"] is not None
    assert cuerpo["codigo"] == ctx["elaboracion"]["codigo"]
    assert cuerpo["version"] == ctx["elaboracion"]["version"]
    assert all(item["pendiente"] is False for item in cuerpo["usos"])
    estado, finalizada_at = _estado(db_session, ctx["elaboracion"]["id"])
    assert estado == "finalizada" and finalizada_at is not None
    assert all(copia is not None for copia in _conservadas(db_session).values())
    assert _detalle(client, ctx) == cuerpo


def test_la_informacion_conservada_tiene_la_estructura_aprobada(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    cuerpo = _finalizar(client, ctx).json()
    copias = _conservadas(db_session)
    leche = copias[ctx["leche"]["id"]]
    lote = db_session.scalar(select(LoteInsumo))

    conservada_en = leche.pop("conservada_en")
    # SQLite returns finalizada_at without its zone; both are UTC.
    assert datetime.fromisoformat(conservada_en.replace("Z", "+00:00")).replace(tzinfo=None) == datetime.fromisoformat(
        cuerpo["finalizada_at"].replace("Z", "+00:00")
    ).replace(tzinfo=None)
    assert leche == {
        "esquema": 1,
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
            {"alergeno_id": ctx["alergenos"]["leche"], "codigo": "leche", "nombre": "Leche", "obligatorio_chile": True, "tipo": "contiene"},
            {"alergeno_id": ctx["alergenos"]["apio"], "codigo": "apio", "nombre": "Apio", "obligatorio_chile": False, "tipo": "contiene"},
            {"alergeno_id": ctx["alergenos"]["soya"], "codigo": "soya", "nombre": "Soya", "obligatorio_chile": True, "tipo": "trazas"},
        ],
        "lote": {"id": lote.id, "codigo": "X123", "fecha_vencimiento": "2026-10-15"},
        "sin_lote": False,
    }


def test_la_copia_no_incluye_la_ficha_cruda_de_la_fuente(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)

    for copia in _conservadas(db_session).values():
        assert "ficha" not in copia["insumo"] and "ficha" not in copia
        assert "ficha cruda" not in str(copia)
        assert "fuente" not in copia["insumo"]


def test_un_insumo_sin_lote_conserva_el_indicador_y_sigue_identificable(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)

    harina = _conservadas(db_session)[ctx["harina"]["id"]]

    assert (harina["lote"], harina["sin_lote"]) == (None, True)
    assert harina["insumo"]["id"] == ctx["insumo_harina"]["id"]
    assert harina["insumo"]["nombre"] == "Harina Selecta 1 kg"
    assert harina["alergenos"] == []
    assert harina["ingrediente"] == {"id": ctx["harina"]["id"], "nombre": "Harina"}


def test_los_alergenos_se_conservan_con_su_tipo_y_en_el_orden_de_ordenar_declarados(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)

    alergenos = _conservadas(db_session)[ctx["leche"]["id"]]["alergenos"]

    assert [(a["codigo"], a["tipo"]) for a in alergenos] == [("leche", "contiene"), ("apio", "contiene"), ("soya", "trazas")]


def test_finalizar_no_altera_el_insumo_el_lote_ni_la_version(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    antes = client.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).json()

    assert _finalizar(client, ctx).status_code == 200

    assert client.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).json() == antes
    db_session.expire_all()
    assert [(v.numero_version, v.vigente, v.usada_en_elaboracion) for v in db_session.scalars(select(VersionProducto))] == [
        (1, True, True)
    ]


def test_el_listado_muestra_la_elaboracion_finalizada(client, ctx) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)

    lista = client.get("/gestion/elaboraciones?estado=finalizada", headers=ctx["headers"]).json()

    assert [(i["codigo"], i["estado"], i["pendientes"], i["total_ingredientes"]) for i in lista] == [("E-001", "finalizada", 0, 2)]
    assert lista[0]["finalizada_at"] is not None
    assert client.get("/gestion/elaboraciones?estado=borrador", headers=ctx["headers"]).json() == []


def test_otra_elaboracion_en_borrador_no_se_ve_afectada(client, ctx) -> None:
    _asignar(client, ctx)
    segunda = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).json()

    _finalizar(client, ctx)

    assert _detalle(client, ctx, segunda["id"]) == segunda


# --- ya finalizada -----------------------------------------------------------------------


def test_finalizar_dos_veces_responde_409_y_no_cambia_la_copia(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    primera = _finalizar(client, ctx).json()
    copias = _conservadas(db_session)

    segunda = _finalizar(client, ctx)

    assert segunda.status_code == 409
    assert segunda.json()["detail"] == "La elaboración ya está finalizada."
    assert _detalle(client, ctx) == primera
    assert _conservadas(db_session) == copias


# --- PT05-09: lo que impide finalizar ----------------------------------------------------


def _problemas(response) -> list[dict]:
    assert response.status_code == 409, response.text
    detalle = response.json()["detail"]
    assert detalle["mensaje"] == (
        "No se puede finalizar la elaboración: hay ingredientes con información pendiente o no disponible."
    )
    return detalle["problemas"]


def test_pt05_09_una_elaboracion_sin_asignar_indica_los_ingredientes_pendientes(client, ctx, db_session) -> None:
    antes = _detalle(client, ctx)

    problemas = _problemas(_finalizar(client, ctx))

    # Harina has no supply; leche has its habitual supply preselected but no lot yet.
    assert problemas == [
        {"ingrediente_id": ctx["harina"]["id"], "ingrediente_nombre": "Harina", "falta": "insumo"},
        {"ingrediente_id": ctx["leche"]["id"], "ingrediente_nombre": "Leche", "falta": "lote"},
    ]
    _nada_cambio(client, ctx, db_session, antes)


def test_pt05_09_falta_el_insumo(client, ctx, db_session) -> None:
    usos = asignacion_completa(ctx)
    usos[0] = {"ingrediente_id": ctx["harina"]["id"], "insumo_id": None}
    _asignar(client, ctx, usos)
    antes = _detalle(client, ctx)

    assert _problemas(_finalizar(client, ctx)) == [
        {"ingrediente_id": ctx["harina"]["id"], "ingrediente_nombre": "Harina", "falta": "insumo"}
    ]
    _nada_cambio(client, ctx, db_session, antes)


def test_pt05_09_falta_el_lote_o_la_indicacion_de_sin_lote(client, ctx, db_session) -> None:
    usos = asignacion_completa(ctx)
    del usos[1]["lote"]
    _asignar(client, ctx, usos)
    antes = _detalle(client, ctx)

    assert _problemas(_finalizar(client, ctx)) == [
        {"ingrediente_id": ctx["leche"]["id"], "ingrediente_nombre": "Leche", "falta": "lote"}
    ]
    _nada_cambio(client, ctx, db_session, antes)


def test_pt05_09_el_insumo_asignado_se_desactivo(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    assert client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).status_code == 204
    antes = _detalle(client, ctx)

    assert _problemas(_finalizar(client, ctx)) == [
        {"ingrediente_id": ctx["leche"]["id"], "ingrediente_nombre": "Leche", "falta": "insumo_desactivado"}
    ]
    _nada_cambio(client, ctx, db_session, antes)


def test_pt05_09_el_ingrediente_se_desactivo(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    assert client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"]).status_code == 204
    antes = _detalle(client, ctx)

    assert _problemas(_finalizar(client, ctx)) == [
        {"ingrediente_id": ctx["harina"]["id"], "ingrediente_nombre": "Harina", "falta": "ingrediente_desactivado"}
    ]
    _nada_cambio(client, ctx, db_session, antes)


def test_pt05_09_los_problemas_se_informan_todos_y_en_el_orden_de_la_formulacion(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"])
    client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"])

    problemas = _problemas(_finalizar(client, ctx))

    assert [(p["ingrediente_nombre"], p["falta"]) for p in problemas] == [
        ("Harina", "ingrediente_desactivado"),
        ("Leche", "insumo_desactivado"),
    ]


def test_un_ingrediente_desactivado_y_sin_insumo_informa_ambos_problemas(client, ctx) -> None:
    usos = asignacion_completa(ctx)
    usos[0] = {"ingrediente_id": ctx["harina"]["id"], "insumo_id": None}
    _asignar(client, ctx, usos)
    client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"])

    problemas = _problemas(_finalizar(client, ctx))

    assert [(p["ingrediente_nombre"], p["falta"]) for p in problemas] == [
        ("Harina", "ingrediente_desactivado"),
        ("Harina", "insumo"),
    ]


def test_corregir_los_problemas_permite_finalizar(client, ctx) -> None:
    assert _finalizar(client, ctx).status_code == 409

    _asignar(client, ctx)

    assert _finalizar(client, ctx).status_code == 200


# --- el detalle de un borrador avisa de lo desactivado -----------------------------------


def test_el_detalle_de_un_borrador_avisa_si_su_insumo_o_su_ingrediente_estan_desactivados(client, ctx) -> None:
    _asignar(client, ctx)
    normales = _por_ingrediente(_detalle(client, ctx))
    assert all(not u["insumo_desactivado"] and not u["ingrediente_desactivado"] for u in normales.values())

    client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"])
    client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"])
    usos = _por_ingrediente(_detalle(client, ctx))

    assert (usos[ctx["leche"]["id"]]["insumo_desactivado"], usos[ctx["leche"]["id"]]["ingrediente_desactivado"]) == (True, False)
    assert (usos[ctx["harina"]["id"]]["insumo_desactivado"], usos[ctx["harina"]["id"]]["ingrediente_desactivado"]) == (False, True)
    assert usos[ctx["leche"]["id"]]["insumo"]["activo"] is False


def test_el_detalle_de_un_borrador_muestra_los_alergenos_vigentes_del_insumo(client, ctx) -> None:
    _asignar(client, ctx)

    leche = _por_ingrediente(_detalle(client, ctx))[ctx["leche"]["id"]]["insumo"]

    assert [(a["codigo"], a["tipo"]) for a in leche["alergenos"]] == [("leche", "contiene"), ("apio", "contiene"), ("soya", "trazas")]
    assert leche["codigo_barras"] == EAN_LECHE
    assert (leche["activo"], leche["habitual"]) == (True, True)


# --- PT05-15: el detalle de una finalizada muestra lo conservado --------------------------


def test_pt05_15_el_detalle_de_una_finalizada_muestra_la_informacion_conservada(client, ctx) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)

    detalle = _detalle(client, ctx)

    leche = _por_ingrediente(detalle)[ctx["leche"]["id"]]
    assert leche["ingrediente_nombre"] == "Leche"
    assert leche["insumo"] == {
        "id": ctx["insumo_habitual"]["id"],
        "nombre": "Leche Colun Semidescremada 1 L",
        "marca_origen": "Marca",
        "presentacion": "Caja 1 L",
        "codigo_barras": EAN_LECHE,
        "ingredientes_declarados": "Leche semidescremada, vitaminas A y D",
        "advertencias": "Puede contener trazas de soya",
        "alergenos": [
            {"alergeno_id": ctx["alergenos"]["leche"], "codigo": "leche", "nombre": "Leche", "obligatorio_chile": True, "tipo": "contiene"},
            {"alergeno_id": ctx["alergenos"]["apio"], "codigo": "apio", "nombre": "Apio", "obligatorio_chile": False, "tipo": "contiene"},
            {"alergeno_id": ctx["alergenos"]["soya"], "codigo": "soya", "nombre": "Soya", "obligatorio_chile": True, "tipo": "trazas"},
        ],
        "activo": None,
        "habitual": None,
    }
    assert (leche["lote"]["codigo"], leche["lote"]["fecha_vencimiento"], leche["sin_lote"]) == ("X123", "2026-10-15", False)
    assert (leche["pendiente"], leche["falta"], leche["insumo_desactivado"], leche["ingrediente_desactivado"]) == (False, [], False, False)
    harina = _por_ingrediente(detalle)[ctx["harina"]["id"]]
    assert (harina["lote"], harina["sin_lote"]) == (None, True)
    assert [u["orden"] for u in detalle["usos"]] == [1, 2]


def test_una_finalizada_sin_informacion_conservada_no_se_lee_desde_el_insumo_vigente(client, ctx, db_session) -> None:
    """Defensive: a corrupted row must fail loudly instead of silently showing live data."""
    _asignar(client, ctx)
    _finalizar(client, ctx)
    db_session.execute(update(UsoInsumo).values(informacion_conservada=None))
    db_session.commit()

    with pytest.raises(RuntimeError, match="no tiene información conservada"):
        _detalle(client, ctx)


# --- PT05-12 y CA13: nada posterior altera lo conservado ---------------------------------


def _foto(client, ctx, db_session) -> tuple[dict, dict]:
    return _detalle(client, ctx), _conservadas(db_session)


def test_pt05_12_modificar_el_insumo_no_altera_la_elaboracion_finalizada(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)
    antes = _foto(client, ctx, db_session)

    cambios = {
        "nombre": "Leche Colun Entera 1 L",
        "marca_origen": "Soprole",
        "presentacion": "Botella 2 L",
        "codigo_barras": "4006381333931",
        "ingredientes_declarados": "Leche entera",
        "advertencias": "Sin advertencias",
    }
    response = client.patch(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"], json=cambios)
    assert response.status_code == 200

    assert _foto(client, ctx, db_session) == antes


def test_ca13_cambiar_los_alergenos_del_insumo_no_altera_lo_conservado(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)
    antes = _foto(client, ctx, db_session)
    base = f"/gestion/insumos/{ctx['insumo_habitual']['id']}/alergenos"

    assert client.patch(f"{base}/{ctx['alergenos']['leche']}", headers=ctx["headers"], json={"tipo": "trazas"}).status_code == 200
    assert client.delete(f"{base}/{ctx['alergenos']['apio']}", headers=ctx["headers"]).status_code == 204
    assert client.delete(f"{base}/{ctx['alergenos']['soya']}", headers=ctx["headers"]).status_code == 204

    assert _foto(client, ctx, db_session) == antes


def test_ca13_desactivar_el_insumo_o_el_ingrediente_no_altera_lo_conservado(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)
    antes = _foto(client, ctx, db_session)

    assert client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).status_code == 204
    assert client.delete(f"/gestion/insumos/{ctx['insumo_harina']['id']}", headers=ctx["headers"]).status_code == 204
    assert client.delete(f"/gestion/ingredientes/{ctx['leche']['id']}", headers=ctx["headers"]).status_code == 204
    assert client.delete(f"/gestion/ingredientes/{ctx['harina']['id']}", headers=ctx["headers"]).status_code == 204

    assert _foto(client, ctx, db_session) == antes


def test_ca13_modificar_la_formulacion_no_altera_la_elaboracion_finalizada(client, ctx, db_session) -> None:
    _asignar(client, ctx)
    _finalizar(client, ctx)
    antes = _foto(client, ctx, db_session)
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")

    formular(client, ctx["headers"], ctx["producto"]["id"], ctx["harina"], azucar)

    assert _foto(client, ctx, db_session) == antes
    assert _detalle(client, ctx)["version"]["numero_version"] == 1


def test_el_detalle_no_lee_el_lote_vigente(client, ctx, db_session) -> None:
    """Even a direct change to the lot row (there is no endpoint for it) is not shown."""
    _asignar(client, ctx)
    _finalizar(client, ctx)
    antes = _foto(client, ctx, db_session)

    db_session.execute(update(LoteInsumo).values(codigo="OTRO", fecha_vencimiento=None))
    db_session.commit()

    assert _foto(client, ctx, db_session) == antes


def test_los_cambios_posteriores_si_se_ven_en_el_insumo_y_en_una_elaboracion_nueva(client, ctx) -> None:
    """The copy is frozen, the supply is not: a new elaboración reads the current supply."""
    _asignar(client, ctx)
    _finalizar(client, ctx)
    client.patch(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"], json={"nombre": "Leche Colun Entera 1 L"})

    segunda = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).json()

    nuevo = _por_ingrediente(segunda)[ctx["leche"]["id"]]["insumo"]
    assert nuevo["nombre"] == "Leche Colun Entera 1 L"
    assert _por_ingrediente(_detalle(client, ctx))[ctx["leche"]["id"]]["insumo"]["nombre"] == "Leche Colun Semidescremada 1 L"
