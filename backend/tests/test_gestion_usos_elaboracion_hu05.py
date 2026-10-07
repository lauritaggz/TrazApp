"""Assignment of supplies and lots to the ingredients of a borrador (T05-03 / HU05).

PUT /gestion/elaboraciones/{id}/usos and GET /gestion/insumos/{id}/lotes. Covers PT05-05
(new lot), PT05-06 (reused lot), PT05-07 (supply without lot) and PT05-14 (changing the
supply of an ingredient does not touch the formulation), and every validation.
"""

import pytest
from sqlalchemy import func, select

from app.models import LoteInsumo, UsoInsumo, VersionProducto
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    preparar,
    registrar,
)


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg")
    ctx["elaboracion"] = crear_elaboracion(client, headers, base["producto"]["id"]).json()
    return ctx


def uso(ingrediente_id: int, insumo_id: int | None = None, lote: dict | None = None) -> dict:
    cuerpo: dict = {"ingrediente_id": ingrediente_id, "insumo_id": insumo_id}
    if lote is not None:
        cuerpo["lote"] = lote
    return cuerpo


def nuevo(codigo: str, vence: str | None = None) -> dict:
    return {"tipo": "nuevo", "codigo": codigo, "fecha_vencimiento": vence}


def existente(lote_id: int) -> dict:
    return {"tipo": "existente", "lote_id": lote_id}


SIN_LOTE = {"tipo": "sin_lote"}


def _put(client, ctx, usos: list[dict], elaboracion_id: int | None = None, headers=None):
    return client.put(
        f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}/usos",
        headers=headers or ctx["headers"],
        json={"usos": usos},
    )


def _completo(ctx, *, harina=None, leche=None) -> list[dict]:
    """Both ingredients of the formulation, in order, with the given entries."""
    return [
        harina or uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], SIN_LOTE),
        leche or uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], SIN_LOTE),
    ]


def _por_ingrediente(elaboracion: dict) -> dict[int, dict]:
    return {item["ingrediente_id"]: item for item in elaboracion["usos"]}


def _detalle(client, ctx, elaboracion_id: int | None = None) -> dict:
    return client.get(
        f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}", headers=ctx["headers"]
    ).json()


def _lotes(db_session, insumo_id: int | None = None) -> list[LoteInsumo]:
    db_session.expire_all()
    stmt = select(LoteInsumo).order_by(LoteInsumo.id)
    if insumo_id is not None:
        stmt = stmt.where(LoteInsumo.insumo_id == insumo_id)
    return list(db_session.scalars(stmt))


def _finalizar(client, ctx, elaboracion_id: int | None = None):
    return client.post(
        f"/gestion/elaboraciones/{elaboracion_id or ctx['elaboracion']['id']}/finalizar", headers=ctx["headers"]
    )


# --- autenticación -----------------------------------------------------------------------


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [("put", "/gestion/elaboraciones/1/usos"), ("get", "/gestion/insumos/1/lotes")],
)
def test_las_rutas_requieren_autenticacion(client, metodo: str, ruta: str) -> None:
    kwargs = {"json": {"usos": []}} if metodo == "put" else {}

    assert getattr(client, metodo)(ruta, **kwargs).status_code == 401


# --- PT05-05: lote nuevo -----------------------------------------------------------------


def test_pt05_05_asignar_un_insumo_con_lote_nuevo_registra_el_lote_asociado_al_uso(client, ctx, db_session) -> None:
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123", "2026-10-15"))

    response = _put(client, ctx, _completo(ctx, leche=leche))

    assert response.status_code == 200, response.text
    asignado = _por_ingrediente(response.json())[ctx["leche"]["id"]]
    assert asignado["insumo"]["id"] == ctx["insumo_habitual"]["id"]
    assert asignado["lote"]["codigo"] == "X123"
    assert asignado["lote"]["fecha_vencimiento"] == "2026-10-15"
    assert asignado["sin_lote"] is False
    assert asignado["pendiente"] is False
    [lote] = _lotes(db_session)
    assert (lote.insumo_id, lote.codigo, str(lote.fecha_vencimiento)) == (
        ctx["insumo_habitual"]["id"],
        "X123",
        "2026-10-15",
    )
    assert asignado["lote"]["id"] == lote.id
    assert db_session.scalar(select(UsoInsumo.lote_id).where(UsoInsumo.ingrediente_id == ctx["leche"]["id"])) == lote.id


def test_el_vencimiento_del_lote_es_opcional_y_el_codigo_se_guarda_recortado(client, ctx, db_session) -> None:
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("  X123  "))

    asignado = _por_ingrediente(_put(client, ctx, _completo(ctx, leche=leche)).json())[ctx["leche"]["id"]]

    assert asignado["lote"]["codigo"] == "X123"
    assert asignado["lote"]["fecha_vencimiento"] is None


def test_el_mismo_codigo_de_lote_se_permite_en_otro_insumo(client, ctx, db_session) -> None:
    harina = uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], nuevo("X123"))
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))

    assert _put(client, ctx, [harina, leche]).status_code == 200

    assert len(_lotes(db_session)) == 2


# --- PT05-06: lote reutilizado -----------------------------------------------------------


def test_pt05_06_reutilizar_un_lote_existente_no_lo_duplica(client, ctx, db_session) -> None:
    primera = ctx["elaboracion"]
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123", "2026-10-15"))
    lote_id = _por_ingrediente(_put(client, ctx, _completo(ctx, leche=leche)).json())[ctx["leche"]["id"]]["lote"]["id"]
    segunda = crear_elaboracion(client, ctx["headers"], ctx["producto"]["id"]).json()

    response = _put(
        client,
        ctx,
        _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], existente(lote_id))),
        elaboracion_id=segunda["id"],
    )

    assert response.status_code == 200, response.text
    reutilizado = _por_ingrediente(response.json())[ctx["leche"]["id"]]["lote"]
    assert reutilizado == {"id": lote_id, "codigo": "X123", "fecha_vencimiento": "2026-10-15"}
    assert len(_lotes(db_session)) == 1
    assert _por_ingrediente(_detalle(client, ctx, primera["id"]))[ctx["leche"]["id"]]["lote"]["id"] == lote_id


def test_se_puede_reenviar_el_mismo_lote_ya_asignado(client, ctx, db_session) -> None:
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))
    lote_id = _por_ingrediente(_put(client, ctx, _completo(ctx, leche=leche)).json())[ctx["leche"]["id"]]["lote"]["id"]

    again = _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], existente(lote_id))))

    assert again.status_code == 200
    assert len(_lotes(db_session)) == 1


# --- PT05-07: insumo sin lote ------------------------------------------------------------


def test_pt05_07_un_insumo_sin_lote_queda_registrado_sin_lote_y_sigue_identificable(client, ctx, db_session) -> None:
    response = _put(client, ctx, _completo(ctx))

    assert response.status_code == 200
    leche = _por_ingrediente(response.json())[ctx["leche"]["id"]]
    assert leche["sin_lote"] is True
    assert leche["lote"] is None
    assert leche["insumo"]["id"] == ctx["insumo_habitual"]["id"]
    assert leche["pendiente"] is False
    assert leche["falta"] == []
    assert _lotes(db_session) == []


def test_pasar_de_un_lote_a_sin_lote_y_de_vuelta_actualiza_ambos_campos(client, ctx, db_session) -> None:
    con_lote = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))
    _put(client, ctx, _completo(ctx, leche=con_lote))

    sin = _por_ingrediente(_put(client, ctx, _completo(ctx)).json())[ctx["leche"]["id"]]
    assert (sin["lote"], sin["sin_lote"]) == (None, True)

    lote_id = _lotes(db_session)[0].id
    de_vuelta = _por_ingrediente(
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], existente(lote_id)))).json()
    )[ctx["leche"]["id"]]
    assert (de_vuelta["lote"]["id"], de_vuelta["sin_lote"]) == (lote_id, False)


# --- avance parcial y reemplazo completo -------------------------------------------------


def test_el_avance_parcial_deja_pendiente_lo_que_falta(client, ctx) -> None:
    response = _put(
        client,
        ctx,
        [uso(ctx["harina"]["id"]), uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"])],
    )

    assert response.status_code == 200
    usos = _por_ingrediente(response.json())
    assert (usos[ctx["harina"]["id"]]["falta"], usos[ctx["harina"]["id"]]["insumo"]) == (["insumo", "lote"], None)
    assert usos[ctx["leche"]["id"]]["falta"] == ["lote"]
    assert all(item["pendiente"] for item in usos.values())


def test_la_asignacion_reemplaza_la_anterior_por_completo(client, ctx, db_session) -> None:
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))))

    response = _put(client, ctx, [uso(ctx["harina"]["id"]), uso(ctx["leche"]["id"])])

    usos = _por_ingrediente(response.json())
    assert all(item["insumo"] is None and item["lote"] is None and item["sin_lote"] is False for item in usos.values())
    # The lot registered earlier stays available for reuse.
    assert [lote.codigo for lote in _lotes(db_session)] == ["X123"]


def test_cambiar_el_insumo_de_un_ingrediente_sin_indicar_lote_deja_el_lote_pendiente(client, ctx) -> None:
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))))

    cambiado = _por_ingrediente(
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_otro"]["id"]))).json()
    )[ctx["leche"]["id"]]

    assert cambiado["insumo"]["id"] == ctx["insumo_otro"]["id"]
    assert (cambiado["lote"], cambiado["sin_lote"], cambiado["falta"]) == (None, False, ["lote"])


def test_el_orden_de_los_usos_en_la_peticion_no_importa(client, ctx) -> None:
    invertido = list(reversed(_completo(ctx)))

    response = _put(client, ctx, invertido)

    assert response.status_code == 200
    assert [item["ingrediente_id"] for item in response.json()["usos"]] == [ctx["harina"]["id"], ctx["leche"]["id"]]


def test_asignar_no_cambia_el_resto_de_la_elaboracion(client, ctx) -> None:
    antes = ctx["elaboracion"]

    despues = _put(client, ctx, _completo(ctx)).json()

    for campo in ("id", "codigo", "fecha", "estado", "version", "producto", "finalizada_at"):
        assert despues[campo] == antes[campo]


def test_el_detalle_refleja_lo_asignado(client, ctx) -> None:
    respuesta = _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_otro"]["id"], nuevo("L-9", "2027-01-31"))))

    assert _detalle(client, ctx)["usos"] == respuesta.json()["usos"]
    resumen = client.get("/gestion/elaboraciones", headers=ctx["headers"]).json()[0]
    assert (resumen["total_ingredientes"], resumen["pendientes"]) == (2, 0)


# --- 404 / 409 ---------------------------------------------------------------------------


def test_una_elaboracion_ajena_o_inexistente_responde_404_y_no_cambia_nada(client, ctx, db_session) -> None:
    headers_b = registrar(client, PRODUCTOR_B)

    assert _put(client, ctx, _completo(ctx), headers=headers_b).status_code == 404
    assert _put(client, ctx, _completo(ctx), elaboracion_id=99999).status_code == 404

    assert all(item["insumo"] is None or not item["sin_lote"] for item in _detalle(client, ctx)["usos"])
    assert _lotes(db_session) == []


def test_una_elaboracion_finalizada_no_admite_cambios(client, ctx, db_session) -> None:
    assert _put(client, ctx, _completo(ctx)).status_code == 200
    assert _finalizar(client, ctx).status_code == 200
    antes = _detalle(client, ctx)

    response = _put(
        client,
        ctx,
        [uso(ctx["harina"]["id"]), uso(ctx["leche"]["id"], ctx["insumo_otro"]["id"], nuevo("Y1"))],
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "La elaboración está finalizada y no puede modificarse."
    despues = _detalle(client, ctx)
    assert despues["usos"] == antes["usos"]
    assert _lotes(db_session) == []


# --- 422: ingredientes -------------------------------------------------------------------


def test_un_ingrediente_fuera_de_la_formulacion_responde_422(client, ctx, db_session) -> None:
    azucar = crear_ingrediente(client, ctx["headers"], "Azúcar", "azu-001")

    response = _put(client, ctx, [*_completo(ctx), uso(azucar["id"])])

    assert response.status_code == 422
    assert response.json()["detail"]["ingrediente_id"] == azucar["id"]
    assert "formulación" in response.json()["detail"]["mensaje"]


def test_un_ingrediente_inexistente_responde_422(client, ctx) -> None:
    response = _put(client, ctx, [*_completo(ctx), uso(99999)])

    assert response.status_code == 422
    assert response.json()["detail"]["ingrediente_id"] == 99999


def test_un_ingrediente_repetido_responde_422(client, ctx) -> None:
    response = _put(client, ctx, [*_completo(ctx), uso(ctx["leche"]["id"])])

    assert response.status_code == 422
    assert response.json()["detail"]["ingrediente_id"] == ctx["leche"]["id"]
    assert "repetirse" in response.json()["detail"]["mensaje"]


def test_un_ingrediente_faltante_responde_422_y_lo_nombra(client, ctx) -> None:
    response = _put(client, ctx, [uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], SIN_LOTE)])

    assert response.status_code == 422
    assert response.json()["detail"] == "Faltan ingredientes de la formulación en la asignación: «Leche»."


def test_una_lista_vacia_responde_422(client, ctx) -> None:
    assert _put(client, ctx, []).status_code == 422


# --- 422: insumo no válido ---------------------------------------------------------------


def _insumo_no_valido(response, ingrediente_id: int) -> None:
    assert response.status_code == 422, response.text
    assert response.json()["detail"] == {"mensaje": "Insumo no válido", "ingrediente_id": ingrediente_id}


def test_un_insumo_de_otro_ingrediente_responde_422(client, ctx, db_session) -> None:
    """The harina supply cannot be used for the leche ingredient."""
    leche = uso(ctx["leche"]["id"], ctx["insumo_harina"]["id"], SIN_LOTE)

    _insumo_no_valido(_put(client, ctx, _completo(ctx, leche=leche)), ctx["leche"]["id"])


def test_un_insumo_de_otro_productor_responde_422(client, ctx) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    leche_b = crear_ingrediente(client, headers_b, "Leche", "lec-001")
    ajeno = crear_insumo(client, headers_b, leche_b["id"], "Leche de B")

    _insumo_no_valido(
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ajeno["id"], SIN_LOTE))),
        ctx["leche"]["id"],
    )


def test_un_insumo_inexistente_responde_422(client, ctx) -> None:
    _insumo_no_valido(
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], 99999, SIN_LOTE))),
        ctx["leche"]["id"],
    )


def test_un_insumo_desactivado_responde_422(client, ctx) -> None:
    assert client.delete(f"/gestion/insumos/{ctx['insumo_otro']['id']}", headers=ctx["headers"]).status_code == 204

    _insumo_no_valido(
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_otro"]["id"], SIN_LOTE))),
        ctx["leche"]["id"],
    )


def test_un_insumo_que_se_desactivo_despues_de_asignarlo_ya_no_se_acepta(client, ctx) -> None:
    assert _put(client, ctx, _completo(ctx)).status_code == 200
    assert client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"]).status_code == 204

    _insumo_no_valido(_put(client, ctx, _completo(ctx)), ctx["leche"]["id"])


def test_un_insumo_no_valido_no_deja_cambios_a_medias(client, ctx, db_session) -> None:
    antes = _detalle(client, ctx)
    harina_valida = uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], nuevo("H-1"))
    leche_invalida = uso(ctx["leche"]["id"], ctx["insumo_harina"]["id"], SIN_LOTE)

    assert _put(client, ctx, [harina_valida, leche_invalida]).status_code == 422

    assert _detalle(client, ctx)["usos"] == antes["usos"]
    assert _lotes(db_session) == []


# --- 422: lote ---------------------------------------------------------------------------


def test_un_lote_de_otro_insumo_responde_422(client, ctx, db_session) -> None:
    """A lot of the other leche supply cannot be used with the habitual one."""
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_otro"]["id"], nuevo("S-1"))))
    lote_del_otro = _lotes(db_session, ctx["insumo_otro"]["id"])[0].id

    response = _put(
        client,
        ctx,
        _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], existente(lote_del_otro))),
    )

    assert response.status_code == 422
    assert response.json()["detail"] == {"mensaje": "Lote no válido", "ingrediente_id": ctx["leche"]["id"]}


def test_un_lote_inexistente_o_de_un_insumo_ajeno_responde_422(client, ctx, db_session) -> None:
    headers_b = registrar(client, PRODUCTOR_B)
    leche_b = crear_ingrediente(client, headers_b, "Leche", "lec-001")
    insumo_b = crear_insumo(client, headers_b, leche_b["id"], "Leche de B")
    db_session.add(LoteInsumo(insumo_id=insumo_b["id"], codigo="B-1"))
    db_session.commit()
    lote_ajeno = _lotes(db_session)[0].id

    for lote_id in (99999, lote_ajeno):
        response = _put(
            client,
            ctx,
            _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], existente(lote_id))),
        )
        assert response.status_code == 422
        assert response.json()["detail"]["mensaje"] == "Lote no válido"


@pytest.mark.parametrize("codigo", ["", "   ", "x" * 101])
def test_un_codigo_de_lote_vacio_o_demasiado_largo_responde_422(client, ctx, db_session, codigo: str) -> None:
    response = _put(
        client,
        ctx,
        _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo(codigo))),
    )

    assert response.status_code == 422
    assert _lotes(db_session) == []


@pytest.mark.parametrize(
    "lote",
    [
        {"tipo": "otro"},
        {"tipo": "nuevo"},
        {"tipo": "existente"},
        {"tipo": "existente", "lote_id": 0},
        {"tipo": "nuevo", "codigo": "X1", "fecha_vencimiento": "no-es-fecha"},
        {"tipo": "sin_lote", "codigo": "X1"},
    ],
)
def test_un_lote_mal_formado_responde_422(client, ctx, lote: dict) -> None:
    leche = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], lote)

    assert _put(client, ctx, _completo(ctx, leche=leche)).status_code == 422


def test_un_lote_sin_insumo_responde_422(client, ctx) -> None:
    assert _put(client, ctx, [uso(ctx["harina"]["id"], None, SIN_LOTE), uso(ctx["leche"]["id"])]).status_code == 422


def test_los_campos_desconocidos_responden_422(client, ctx) -> None:
    cuerpo = {"usos": _completo(ctx), "estado": "finalizada"}

    response = client.put(
        f"/gestion/elaboraciones/{ctx['elaboracion']['id']}/usos", headers=ctx["headers"], json=cuerpo
    )

    assert response.status_code == 422


# --- 409: lote repetido ------------------------------------------------------------------


@pytest.mark.parametrize("variante", ["X123", "x123", " X123 "])
def test_un_lote_nuevo_con_un_codigo_existente_responde_409_para_ofrecer_usar_el_lote(
    client, ctx, db_session, variante: str
) -> None:
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))))
    [existente_] = _lotes(db_session)

    response = _put(
        client,
        ctx,
        _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo(variante))),
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": "Ya existe un lote «X123» para este insumo. Puedes usarlo.".replace("X123", variante.strip()),
        "ingrediente_id": ctx["leche"]["id"],
        "lote_id": existente_.id,
    }
    assert len(_lotes(db_session)) == 1


def test_un_lote_repetido_no_deja_cambios_a_medias(client, ctx, db_session) -> None:
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X123"))))
    antes = _detalle(client, ctx)
    harina_nueva = uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], nuevo("H-1"))
    leche_repetida = uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("x123"))

    assert _put(client, ctx, [harina_nueva, leche_repetida]).status_code == 409

    assert _detalle(client, ctx)["usos"] == antes["usos"]
    assert [lote.codigo for lote in _lotes(db_session)] == ["X123"]


# --- GET /gestion/insumos/{id}/lotes -----------------------------------------------------


def test_el_listado_de_lotes_de_un_insumo(client, ctx, db_session) -> None:
    url = f"/gestion/insumos/{ctx['insumo_habitual']['id']}/lotes"
    assert client.get(url, headers=ctx["headers"]).json() == []

    for codigo, vence in (("X1", "2026-10-15"), ("X2", None)):
        _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo(codigo, vence))))

    lotes = client.get(url, headers=ctx["headers"]).json()

    assert [(lote["codigo"], lote["fecha_vencimiento"]) for lote in lotes] == [("X2", None), ("X1", "2026-10-15")]
    assert all(lote["insumo_id"] == ctx["insumo_habitual"]["id"] and lote["id"] and lote["created_at"] for lote in lotes)


def test_el_listado_de_lotes_solo_incluye_los_del_insumo(client, ctx) -> None:
    _put(client, ctx, [
        uso(ctx["harina"]["id"], ctx["insumo_harina"]["id"], nuevo("H-1")),
        uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("L-1")),
    ])

    harina = client.get(f"/gestion/insumos/{ctx['insumo_harina']['id']}/lotes", headers=ctx["headers"]).json()
    otro = client.get(f"/gestion/insumos/{ctx['insumo_otro']['id']}/lotes", headers=ctx["headers"]).json()

    assert [lote["codigo"] for lote in harina] == ["H-1"]
    assert otro == []


def test_los_lotes_de_un_insumo_desactivado_siguen_siendo_consultables(client, ctx) -> None:
    _put(client, ctx, _completo(ctx, leche=uso(ctx["leche"]["id"], ctx["insumo_habitual"]["id"], nuevo("X1"))))
    client.delete(f"/gestion/insumos/{ctx['insumo_habitual']['id']}", headers=ctx["headers"])

    lotes = client.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}/lotes", headers=ctx["headers"])

    assert [lote["codigo"] for lote in lotes.json()] == ["X1"]


def test_los_lotes_de_un_insumo_ajeno_o_inexistente_responden_404(client, ctx) -> None:
    headers_b = registrar(client, PRODUCTOR_B)

    assert client.get(f"/gestion/insumos/{ctx['insumo_habitual']['id']}/lotes", headers=headers_b).status_code == 404
    assert client.get("/gestion/insumos/99999/lotes", headers=ctx["headers"]).status_code == 404


# --- PT05-14 (cierra PT03-12) ------------------------------------------------------------


def test_pt05_14_cambiar_el_insumo_de_un_ingrediente_no_cambia_la_version_de_la_formulacion(
    client, ctx, db_session
) -> None:
    """Two supplies of the same ingredient, two elaboraciones and a reassignment in a borrador:
    the formulation keeps its single version and its lines (replaces the RT-01 prototype test)."""
    producto_id = ctx["producto"]["id"]
    primera = ctx["elaboracion"]
    lineas_antes = client.get(
        f"/gestion/productos/{producto_id}/versiones/{ctx['version']['id']}/formulacion", headers=ctx["headers"]
    ).json()
    leche_id = ctx["leche"]["id"]

    assert _put(client, ctx, _completo(ctx, leche=uso(leche_id, ctx["insumo_habitual"]["id"], nuevo("COL-1")))).status_code == 200
    segunda = crear_elaboracion(client, ctx["headers"], producto_id).json()
    assert _put(
        client, ctx, _completo(ctx, leche=uso(leche_id, ctx["insumo_habitual"]["id"], nuevo("COL-2"))),
        elaboracion_id=segunda["id"],
    ).status_code == 200
    reasignada = _put(
        client, ctx, _completo(ctx, leche=uso(leche_id, ctx["insumo_otro"]["id"], nuevo("SOP-1"))),
        elaboracion_id=segunda["id"],
    )

    assert reasignada.status_code == 200
    assert _por_ingrediente(reasignada.json())[leche_id]["insumo"]["id"] == ctx["insumo_otro"]["id"]
    # The first elaboración keeps its own supply: the reassignment is per elaboración.
    assert _por_ingrediente(_detalle(client, ctx, primera["id"]))[leche_id]["insumo"]["id"] == ctx["insumo_habitual"]["id"]
    # No new version: still one, current, used, with the same lines; both elaboraciones point to it.
    db_session.expire_all()
    versiones = [
        (v.numero_version, v.vigente, v.usada_en_elaboracion)
        for v in db_session.scalars(select(VersionProducto).where(VersionProducto.producto_id == producto_id))
    ]
    assert versiones == [(1, True, True)]
    assert _detalle(client, ctx, primera["id"])["version"]["id"] == ctx["version"]["id"]
    assert _detalle(client, ctx, segunda["id"])["version"]["id"] == ctx["version"]["id"]
    assert client.get(
        f"/gestion/productos/{producto_id}/versiones/{ctx['version']['id']}/formulacion", headers=ctx["headers"]
    ).json() == lineas_antes
    assert db_session.scalar(select(func.count()).select_from(VersionProducto)) == 1
