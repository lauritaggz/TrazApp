"""Public consultation endpoint (T10-01 / HU10): GET /publico/productos/{id_publico}.

T10-02 adds the selection by `codigo` / `fecha` and `estado_elaboracion` (see the second half).
Covers PT10-01 (no session), PT10-02 (default = most recent visible), PT10-05 (supply fields),
PT10-08 / RT-03 (supply modified after finalizing), PT10-09 (no internal data) and the extra
scenarios: same answer for unpublished / deleted / unknown, hidden elaboraciones, exact whitelist,
with and without token, and no N+1. The grouped allergens and the previous-version note (T10-03)
are not part of these tasks.
"""

import logging
from datetime import timedelta

import pytest
from sqlalchemy import delete, event, update

from app.models import Alergeno, Categoria, InsumoComercial, Producto, Productor, VersionProducto
from app.models.insumo import InsumoAlergeno
from app.services.consulta_publica_service import (
    InformacionConservadaIncompletaError,
    proyectar_insumo,
)
from app.services.elaboracion_service import hoy_santiago
from app.repositories.consulta_publica_repository import ConsultaPublicaRepository
from tests.escenario_hu05 import (
    EAN_LECHE,
    PRODUCTOR_A,
    completar_insumo,
    crear_alergenos,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    preparar,
    registrar,
)

# Fixed maximum of SQL statements for one public consultation of an available product: product,
# categories, elaboraciones and conserved copies. T10-03 raises it to 5 (current-version check)
# explicitly; do not relax it before that.
CONSULTAS_MAXIMAS = 4

MENSAJE_NO_DISPONIBLE = {"detail": {"mensaje": "Información no disponible"}}
CABECERAS = {"cache-control": "no-store", "x-robots-tag": "noindex, nofollow"}

# Values that must never appear anywhere in the public response.
CENTINELAS_INTERNOS = [
    "LOTE-SECRETO",
    "2031-07-07",  # lot expiry
    PRODUCTOR_A["email"],
    "Productor A",  # productor's personal name
    "que-001",  # internal product code
    "98765",  # sale price
    "54321",  # production cost
    EAN_LECHE,
    "ficha cruda",
    "open_food_facts",
    "Caja 1 L",  # presentation of the supply
    "Producto casero",  # product description
]

RUTAS_APROBADAS = {
    "producto",
    "producto.id_publico",
    "producto.nombre",
    "producto.contenido_neto",
    "producto.unidad_medida",
    "producto.presentacion",
    "producto.imagen_url",
    "producto.categorias",
    "producto.elaborado_por",
    "elaboraciones",
    "elaboraciones[].codigo",
    "elaboraciones[].fecha",
    "elaboracion",
    "elaboracion.codigo",
    "elaboracion.fecha",
    "elaboracion.insumos",
    "elaboracion.insumos[].ingrediente",
    "elaboracion.insumos[].nombre",
    "elaboracion.insumos[].marca_origen",
    "elaboracion.insumos[].ingredientes_declarados",
    "elaboracion.insumos[].advertencias",
    "elaboracion.insumos[].alergenos",
    "elaboracion.insumos[].alergenos[].codigo",
    "elaboracion.insumos[].alergenos[].nombre",
    "elaboracion.insumos[].alergenos[].tipo",
    # T10-03
    "elaboracion.alergenos",
    "elaboracion.alergenos.contiene",
    "elaboracion.alergenos.contiene[].codigo",
    "elaboracion.alergenos.contiene[].nombre",
    "elaboracion.alergenos.puede_contener",
    "elaboracion.alergenos.puede_contener[].codigo",
    "elaboracion.alergenos.puede_contener[].nombre",
    "elaboracion.version_anterior",
    # T10-02. `coincidencias` is always present (empty unless "varias"), so its items only show
    # up in the paths when there are matches (see the "varias" whitelist test).
    "estado_elaboracion",
    "coincidencias",
}


@pytest.fixture
def ctx(client, db_session) -> dict:
    headers = registrar(client)
    base = preparar(client, headers)
    ctx = {"headers": headers, **base}
    ctx["insumo_harina"] = crear_insumo(client, headers, base["harina"]["id"], "Harina Selecta 1 kg", marca_origen="Selecta")
    ctx["alergenos"] = crear_alergenos(db_session)
    completar_insumo(client, headers, ctx["insumo_habitual"]["id"], ctx["alergenos"])
    ctx["insumo_por_ingrediente"] = {
        base["harina"]["id"]: ctx["insumo_harina"]["id"],
        base["leche"]["id"]: ctx["insumo_habitual"]["id"],
    }
    # Internal data that must stay out of the public response.
    cambio = client.patch(
        f"/gestion/productos/{base['producto']['id']}",
        headers=headers,
        json={"precio_venta": "98765.00", "costo_produccion": "54321.00", "presentacion": "Caja"},
    )
    assert cambio.status_code == 200, cambio.text
    return ctx


def _finalizar(client, ctx, codigo: str, dias: int = 1, producto_id: int | None = None) -> int:
    """Register an elaboración (`dias` days ago) with the assigned supplies and finalize it."""
    producto_id = producto_id or ctx["producto"]["id"]
    fecha = (hoy_santiago() - timedelta(days=dias)).isoformat()
    creada = crear_elaboracion(client, ctx["headers"], producto_id, codigo=codigo, fecha=fecha)
    assert creada.status_code == 201, creada.text
    elaboracion = creada.json()
    usos = [
        {
            "ingrediente_id": uso["ingrediente_id"],
            "insumo_id": ctx["insumo_por_ingrediente"][uso["ingrediente_id"]],
            "lote": {"tipo": "nuevo", "codigo": f"LOTE-SECRETO-{codigo}-{uso['ingrediente_id']}", "fecha_vencimiento": "2031-07-07"},
        }
        for uso in elaboracion["usos"]
    ]
    asignadas = client.put(f"/gestion/elaboraciones/{elaboracion['id']}/usos", headers=ctx["headers"], json={"usos": usos})
    assert asignadas.status_code == 200, asignadas.text
    final = client.post(f"/gestion/elaboraciones/{elaboracion['id']}/finalizar", headers=ctx["headers"])
    assert final.status_code == 200, final.text
    return elaboracion["id"]


def _publicar(client, ctx, producto_id: int | None = None) -> str:
    respuesta = client.post(f"/gestion/productos/{producto_id or ctx['producto']['id']}/publicacion", headers=ctx["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()["id_publico"]


def _ocultar(client, ctx, elaboracion_id: int) -> None:
    assert client.post(f"/gestion/elaboraciones/{elaboracion_id}/ocultar", headers=ctx["headers"]).status_code == 200


def _ficha(client, id_publico: str, headers: dict | None = None, **params):
    return client.get(f"/publico/productos/{id_publico}", headers=headers or {}, params=params or None)


@pytest.fixture
def publicado(client, ctx, db_session) -> dict:
    """Published product with one finalized elaboración (E-001) and one category."""
    ctx["elaboracion_id"] = _finalizar(client, ctx, "E-001", dias=5)
    producto = db_session.get(Producto, ctx["producto"]["id"])
    producto.categorias.append(Categoria(nombre="Panificados"))
    db_session.commit()
    ctx["id_publico"] = _publicar(client, ctx)
    return ctx


def _enteros(valor) -> list:
    """Every integer value of a JSON value (booleans are not integers here)."""
    if isinstance(valor, dict):
        return [e for hijo in valor.values() for e in _enteros(hijo)]
    if isinstance(valor, list):
        return [e for hijo in valor for e in _enteros(hijo)]
    return [valor] if isinstance(valor, int) and not isinstance(valor, bool) else []


def _sin_datos_de_version(cuerpo: dict) -> None:
    """The response carries no version number or id: no integer at all (it has none by design) and
    no key about versions other than the boolean `version_anterior`."""
    assert _enteros(cuerpo) == []
    claves = {ruta.rsplit(".", 1)[-1].replace("[]", "") for ruta in _rutas(cuerpo)}
    assert {c for c in claves if "version" in c} <= {"version_anterior"}
    assert "numero_version" not in str(cuerpo)


def _rutas(valor, prefijo: str = "") -> set[str]:
    """Every key path of a JSON value; list items are written `[]` and merged."""
    rutas: set[str] = set()
    if isinstance(valor, dict):
        for clave, hijo in valor.items():
            ruta = f"{prefijo}.{clave}" if prefijo else clave
            rutas.add(ruta)
            rutas |= _rutas(hijo, ruta)
    elif isinstance(valor, list):
        for hijo in valor:
            rutas |= _rutas(hijo, f"{prefijo}[]")
    return rutas


# --- PT10-01 / PT10-05: the ficha ------------------------------------------------------------------


def test_pt10_01_la_ficha_se_consulta_sin_sesion_y_trae_producto_y_elaboracion(client, publicado) -> None:
    respuesta = _ficha(client, publicado["id_publico"])

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["producto"] == {
        "id_publico": publicado["id_publico"],
        "nombre": "Queque de vainilla",
        "contenido_neto": "250.000",
        "unidad_medida": "g",
        "presentacion": "Caja",
        "imagen_url": None,
        "categorias": ["Panificados"],
        "elaborado_por": "Panaderia A",
    }
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-001"]
    assert cuerpo["elaboracion"]["codigo"] == "E-001"
    assert cuerpo["elaboracion"]["fecha"] == (hoy_santiago() - timedelta(days=5)).isoformat()


def test_pt10_05_cada_insumo_muestra_nombre_marca_ingredientes_advertencias_y_alergenos(client, publicado) -> None:
    insumos = _ficha(client, publicado["id_publico"]).json()["elaboracion"]["insumos"]

    # Formulation order: harina, then leche.
    assert [i["ingrediente"] for i in insumos] == ["Harina", "Leche"]
    harina, leche = insumos
    assert (harina["nombre"], harina["marca_origen"], harina["alergenos"]) == ("Harina Selecta 1 kg", "Selecta", [])
    assert leche["nombre"] == "Leche Colun Semidescremada 1 L"
    assert leche["ingredientes_declarados"] == "Leche semidescremada, vitaminas A y D"
    assert leche["advertencias"] == "Puede contener trazas de soya"
    # Contiene first (mandatory in Chile first), then the traces, with the public wording.
    assert [(a["codigo"], a["tipo"]) for a in leche["alergenos"]] == [
        ("leche", "contiene"),
        ("apio", "contiene"),
        ("soya", "puede_contener"),
    ]


def test_el_nombre_del_productor_es_solo_el_nombre_de_negocio(client, publicado, db_session) -> None:
    db_session.execute(update(Productor).values(nombre_negocio=None))
    db_session.commit()

    cuerpo = _ficha(client, publicado["id_publico"]).json()

    assert cuerpo["producto"]["elaborado_por"] is None
    assert "Productor A" not in str(cuerpo)


def test_la_identidad_del_producto_es_la_vigente(client, publicado) -> None:
    """Accepted decision (D3): the product's name is not conserved per elaboración."""
    cambio = client.patch(f"/gestion/productos/{publicado['producto']['id']}", headers=publicado["headers"], json={"nombre": "Queque nuevo"})
    assert cambio.status_code == 200, cambio.text

    assert _ficha(client, publicado["id_publico"]).json()["producto"]["nombre"] == "Queque nuevo"


# --- RT-03 / PT10-08 -------------------------------------------------------------------------------


def test_rt03_insumo_modificado_despues_de_finalizar_no_cambia_la_ficha(client, publicado, db_session) -> None:
    antes = _ficha(client, publicado["id_publico"]).json()["elaboracion"]
    assert [a["codigo"] for a in antes["alergenos"]["contiene"]] == ["leche", "apio"]  # the groups are part of the comparison
    leche_id = publicado["insumo_habitual"]["id"]
    harina_id = publicado["insumo_harina"]["id"]

    # Everything the ficha shows is changed on the live supplies: name, brand, declared ingredients,
    # warnings, allergens (removed, changed type, new one) and the supplies are deactivated.
    db_session.execute(
        update(InsumoComercial)
        .where(InsumoComercial.id.in_([leche_id, harina_id]))
        .values(
            nombre="NOMBRE MODIFICADO",
            marca_origen="MARCA MODIFICADA",
            ingredientes_declarados="INGREDIENTES MODIFICADOS",
            advertencias="ADVERTENCIA MODIFICADA",
            activo=False,
        )
    )
    db_session.execute(delete(InsumoAlergeno).where(InsumoAlergeno.insumo_id == leche_id))
    db_session.add(InsumoAlergeno(insumo_id=harina_id, alergeno_id=publicado["alergenos"]["leche"], tipo="contiene"))
    db_session.commit()
    db_session.expire_all()

    despues = _ficha(client, publicado["id_publico"])

    assert despues.status_code == 200
    assert despues.json()["elaboracion"] == antes
    assert "MODIFICAD" not in despues.text


# --- Uniform answer (D2) ---------------------------------------------------------------------------


def _forma(respuesta) -> tuple:
    return (
        respuesta.status_code,
        respuesta.json(),
        respuesta.headers.get("cache-control"),
        respuesta.headers.get("x-robots-tag"),
    )


def test_producto_no_publicado_eliminado_e_inexistente_responden_exactamente_igual(client, publicado) -> None:
    # Unpublished: it had an identifier and it is kept.
    no_publicado = publicado["id_publico"]
    assert client.delete(f"/gestion/productos/{publicado['producto']['id']}/publicacion", headers=publicado["headers"]).status_code == 200
    # Deleted: another product, published and then deleted (deleting does not unpublish it).
    otro = crear_producto(client, publicado["headers"], "Galletas", "gal-001")
    formular(client, publicado["headers"], otro["id"], publicado["harina"], publicado["leche"])
    _finalizar(client, publicado, "G-001", producto_id=otro["id"])
    eliminado = _publicar(client, publicado, otro["id"])
    assert client.delete(f"/gestion/productos/{otro['id']}", headers=publicado["headers"]).status_code == 204

    casos = {
        "no publicado": no_publicado,
        "eliminado": eliminado,
        "inexistente": "ZZZZZZZZZZZZZZZZZZZZZZ",
        "mal formado (largo)": "x" * 500,
        "mal formado (símbolos)": "a b%20c$$",
        "mal formado (unicode)": "ñandú-é",
    }
    formas = {nombre: _forma(_ficha(client, valor)) for nombre, valor in casos.items()}

    esperada = (404, MENSAJE_NO_DISPONIBLE, CABECERAS["cache-control"], CABECERAS["x-robots-tag"])
    assert formas == {nombre: esperada for nombre in casos}


# --- Visibility (HU09 rules) -----------------------------------------------------------------------


def test_una_elaboracion_oculta_o_borrador_no_aparece_en_la_lista_ni_es_la_predeterminada(client, publicado) -> None:
    e_antigua = publicado["elaboracion_id"]  # E-001, 5 days ago
    e_media = _finalizar(client, publicado, "E-002", dias=3)
    e_reciente = _finalizar(client, publicado, "E-003", dias=1)
    borrador = crear_elaboracion(client, publicado["headers"], publicado["producto"]["id"], codigo="E-004")
    assert borrador.status_code == 201

    _ocultar(client, publicado, e_reciente)
    cuerpo = _ficha(client, publicado["id_publico"]).json()
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-002", "E-001"]
    assert cuerpo["elaboracion"]["codigo"] == "E-002"
    assert "E-003" not in str(cuerpo) and "E-004" not in str(cuerpo)

    _ocultar(client, publicado, e_media)
    assert _ficha(client, publicado["id_publico"]).json()["elaboracion"]["codigo"] == "E-001"

    _ocultar(client, publicado, e_antigua)
    vacia = _ficha(client, publicado["id_publico"])
    assert vacia.status_code == 200
    assert vacia.json()["elaboraciones"] == []
    assert vacia.json()["elaboracion"] is None
    assert (vacia.json()["estado_elaboracion"], vacia.json()["coincidencias"]) == ("sin_elaboraciones", [])
    assert vacia.json()["producto"]["nombre"] == "Queque de vainilla"


def test_la_predeterminada_ordena_por_fecha_y_luego_por_id_descendente(client, publicado) -> None:
    _finalizar(client, publicado, "E-002", dias=2)
    _finalizar(client, publicado, "E-003", dias=2)  # same day, created later: bigger id
    _finalizar(client, publicado, "E-004", dias=9)  # older date, biggest id

    cuerpo = _ficha(client, publicado["id_publico"]).json()

    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-003", "E-002", "E-001", "E-004"]
    assert cuerpo["elaboracion"]["codigo"] == "E-003"


# --- Whitelist (PT10-09) ---------------------------------------------------------------------------


def test_lista_blanca_conjunto_exacto_de_claves(client, publicado) -> None:
    cuerpo = _ficha(client, publicado["id_publico"])

    assert _rutas(cuerpo.json()) == RUTAS_APROBADAS
    for centinela in CENTINELAS_INTERNOS:
        assert centinela not in cuerpo.text, centinela
    _sin_datos_de_version(cuerpo.json())


def test_la_lista_blanca_tambien_se_cumple_sin_elaboraciones_visibles(client, publicado) -> None:
    _ocultar(client, publicado, publicado["elaboracion_id"])

    rutas = _rutas(_ficha(client, publicado["id_publico"]).json())

    assert rutas <= RUTAS_APROBADAS
    assert {"producto", "elaboraciones", "elaboracion"} <= rutas


# --- Authentication and headers --------------------------------------------------------------------


def test_sin_token_con_token_de_productor_y_con_token_invalido_la_ficha_es_la_misma(client, publicado) -> None:
    sin_token = _ficha(client, publicado["id_publico"])
    con_token = _ficha(client, publicado["id_publico"], publicado["headers"])
    invalido = _ficha(client, publicado["id_publico"], {"Authorization": "Bearer no-es-un-token"})

    assert sin_token.status_code == con_token.status_code == invalido.status_code == 200
    assert sin_token.json() == con_token.json() == invalido.json()
    # The same holds for the unavailable answer: a session changes nothing.
    assert _forma(_ficha(client, "inexistente", publicado["headers"])) == _forma(_ficha(client, "inexistente"))


def test_cabeceras_no_store_y_noindex_en_exito_y_en_no_disponible(client, publicado) -> None:
    for id_publico in (publicado["id_publico"], "inexistente"):
        respuesta = _ficha(client, id_publico)
        assert respuesta.headers["cache-control"] == "no-store"
        assert respuesta.headers["x-robots-tag"] == "noindex, nofollow"


# --- Performance (OE4): no N+1 ---------------------------------------------------------------------


def _contar_consultas(client, db_session, id_publico: str, **params) -> int:
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert _ficha(client, id_publico, **params).status_code == 200
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)
    return len(sentencias)


def test_la_cantidad_de_consultas_es_constante_y_no_supera_el_maximo(client, publicado, db_session) -> None:
    pocas = _contar_consultas(client, db_session, publicado["id_publico"])

    # More elaboraciones and more supplies per elaboración (a new version with 3 more ingredients).
    extras = [crear_ingrediente(client, publicado["headers"], f"Extra {i}", f"ext-{i}") for i in range(3)]
    for extra in extras:
        insumo = crear_insumo(client, publicado["headers"], extra["id"], f"Insumo extra {extra['id']}", habitual=True)
        publicado["insumo_por_ingrediente"][extra["id"]] = insumo["id"]
    formular(client, publicado["headers"], publicado["producto"]["id"], publicado["harina"], publicado["leche"], *extras)
    for numero in range(2, 6):
        _finalizar(client, publicado, f"E-00{numero}", dias=numero)
    assert len(_ficha(client, publicado["id_publico"]).json()["elaboracion"]["insumos"]) == 5

    muchas = _contar_consultas(client, db_session, publicado["id_publico"])

    assert pocas == muchas
    assert muchas <= CONSULTAS_MAXIMAS


def test_un_producto_no_disponible_hace_una_sola_consulta(client, publicado, db_session) -> None:
    sentencias: list[str] = []
    motor = db_session.get_bind()

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert _ficha(client, "inexistente").status_code == 404
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)

    assert len(sentencias) == 1


# --- Fail closed -----------------------------------------------------------------------------------


COPIA_COMPLETA = {
    "ingrediente": {"nombre": "Leche"},
    "insumo": {"nombre": "Leche X", "marca_origen": "Marca X", "ingredientes_declarados": None, "advertencias": None},
    "alergenos": [{"codigo": "leche", "nombre": "Leche", "tipo": "contiene"}],
}


@pytest.mark.parametrize("clave", ["ingrediente", "insumo", "alergenos"])
def test_una_copia_sin_una_clave_obligatoria_falla_en_lugar_de_declarar_sin_alergenos(clave) -> None:
    copia = {k: v for k, v in COPIA_COMPLETA.items() if k != clave}

    with pytest.raises(InformacionConservadaIncompletaError) as error:
        proyectar_insumo(7, copia)

    assert (error.value.uso_id, error.value.clave) == (7, clave)


def test_proyectar_insumo_con_una_copia_completa_no_falla() -> None:
    assert proyectar_insumo(7, COPIA_COMPLETA).alergenos[0].tipo == "contiene"


def test_una_copia_incompleta_responde_500_sin_datos_y_el_log_solo_trae_el_uso_y_la_clave(
    client, publicado, monkeypatch, caplog
) -> None:
    copia = {**COPIA_COMPLETA, "insumo": {**COPIA_COMPLETA["insumo"], "marca_origen": "MARCA-SENSIBLE-XYZ"}}
    del copia["alergenos"]
    monkeypatch.setattr(ConsultaPublicaRepository, "copias_conservadas", lambda self, elaboracion_id: [(42, copia)])

    with caplog.at_level(logging.ERROR):
        respuesta = _ficha(client, publicado["id_publico"])

    assert respuesta.status_code == 500
    assert set(respuesta.json()["detail"]) == {"mensaje"}
    assert respuesta.headers["cache-control"] == "no-store"
    registros = " ".join(registro.getMessage() for registro in caplog.records)
    assert "42" in registros and "alergenos" in registros
    assert "MARCA-SENSIBLE-XYZ" not in registros + respuesta.text
    assert PRODUCTOR_A["email"] not in registros


# =================================================================================================
# T10-02: selection by code or date, estado_elaboracion
# =================================================================================================

ESTADOS = {"ok", "no_disponible", "varias", "sin_elaboraciones"}


@pytest.fixture
def varias_elaboraciones(client, publicado) -> dict:
    """E-001 (5 days ago, from `publicado`), E-002 (3), E-003 (1, hidden) and a borrador E-004."""
    publicado["ids"] = {
        "E-001": publicado["elaboracion_id"],
        "E-002": _finalizar(client, publicado, "E-002", dias=3),
        "E-003": _finalizar(client, publicado, "E-003", dias=1),
    }
    _ocultar(client, publicado, publicado["ids"]["E-003"])
    assert crear_elaboracion(client, publicado["headers"], publicado["producto"]["id"], codigo="E-004").status_code == 201
    return publicado


def _dia(dias: int) -> str:
    return (hoy_santiago() - timedelta(days=dias)).isoformat()


def test_pt10_02_por_defecto_la_mas_reciente_visible_con_estado_ok(client, varias_elaboraciones) -> None:
    cuerpo = _ficha(client, varias_elaboraciones["id_publico"]).json()

    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["elaboracion"]["codigo"] == "E-002"
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-002", "E-001"]
    assert cuerpo["coincidencias"] == []


@pytest.mark.parametrize("escrito", ["E-001", "e-001", "  E-001  ", " e-001\t"])
def test_pt10_03_seleccion_por_codigo_con_otra_capitalizacion_y_espacios_en_los_extremos(
    client, varias_elaboraciones, escrito
) -> None:
    cuerpo = _ficha(client, varias_elaboraciones["id_publico"], codigo=escrito).json()

    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["elaboracion"]["codigo"] == "E-001"
    assert cuerpo["elaboracion"]["fecha"] == _dia(5)
    assert len(cuerpo["elaboracion"]["insumos"]) == 2
    # The list does not depend on the selection.
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-002", "E-001"]


def test_no_se_colapsan_los_espacios_internos_del_codigo(client, varias_elaboraciones) -> None:
    cuerpo = _ficha(client, varias_elaboraciones["id_publico"], codigo="E -001").json()

    assert (cuerpo["estado_elaboracion"], cuerpo["elaboracion"]) == ("no_disponible", None)


def test_pt10_03_seleccion_por_fecha(client, varias_elaboraciones) -> None:
    cuerpo = _ficha(client, varias_elaboraciones["id_publico"], fecha=_dia(5)).json()

    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["elaboracion"]["codigo"] == "E-001"
    assert cuerpo["coincidencias"] == []


def test_pt10_04_un_codigo_inexistente_es_no_disponible_sin_error(client, varias_elaboraciones) -> None:
    respuesta = _ficha(client, varias_elaboraciones["id_publico"], codigo="NO-EXISTE")

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert (cuerpo["estado_elaboracion"], cuerpo["elaboracion"], cuerpo["coincidencias"]) == ("no_disponible", None, [])
    assert [e["codigo"] for e in cuerpo["elaboraciones"]] == ["E-002", "E-001"]
    assert cuerpo["producto"]["nombre"] == "Queque de vainilla"


def test_oculta_borrador_y_de_otro_producto_dan_el_mismo_cuerpo_que_un_codigo_inexistente(
    client, varias_elaboraciones
) -> None:
    ctx = varias_elaboraciones
    otro = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    formular(client, ctx["headers"], otro["id"], ctx["harina"], ctx["leche"])
    _finalizar(client, ctx, "G-001", producto_id=otro["id"])
    _publicar(client, ctx, otro["id"])

    cuerpos = {
        codigo: _ficha(client, ctx["id_publico"], codigo=codigo)
        for codigo in ("NO-EXISTE", "E-003", "E-004", "G-001")  # unknown, hidden, borrador, other product
    }

    assert {c.status_code for c in cuerpos.values()} == {200}
    assert cuerpos["E-003"].json()["estado_elaboracion"] == "no_disponible"
    referencia = cuerpos["NO-EXISTE"].json()
    assert {codigo: r.json() for codigo, r in cuerpos.items()} == {codigo: referencia for codigo in cuerpos}
    assert "E-003" not in cuerpos["E-003"].text and "E-004" not in cuerpos["E-004"].text


def test_fecha_con_una_visible_y_una_oculta_el_mismo_dia_es_ok_con_la_visible(client, varias_elaboraciones) -> None:
    ctx = varias_elaboraciones
    # E-003 (hidden) is from 1 day ago: a visible one is added the same day it was made.
    visible_ese_dia = _finalizar(client, ctx, "E-005", dias=1)
    assert visible_ese_dia

    cuerpo = _ficha(client, ctx["id_publico"], fecha=_dia(1)).json()

    assert cuerpo["estado_elaboracion"] == "ok"
    assert cuerpo["elaboracion"]["codigo"] == "E-005"
    assert cuerpo["coincidencias"] == []
    assert "E-003" not in str(cuerpo)


def test_fecha_con_dos_visibles_es_varias_con_las_coincidencias_en_orden_y_sin_elegir(client, varias_elaboraciones) -> None:
    ctx = varias_elaboraciones
    _finalizar(client, ctx, "E-006", dias=3)  # same day as E-002, created later: bigger id

    cuerpo = _ficha(client, ctx["id_publico"], fecha=_dia(3)).json()

    assert cuerpo["estado_elaboracion"] == "varias"
    assert cuerpo["elaboracion"] is None
    assert cuerpo["coincidencias"] == [
        {"codigo": "E-006", "fecha": _dia(3)},
        {"codigo": "E-002", "fecha": _dia(3)},
    ]
    assert [e["codigo"] for e in cuerpo["elaboraciones"]][:2] == ["E-006", "E-002"]


def test_fecha_sin_elaboraciones_es_no_disponible_y_la_de_una_oculta_tambien(client, varias_elaboraciones) -> None:
    ctx = varias_elaboraciones

    sin_nada = _ficha(client, ctx["id_publico"], fecha=_dia(20)).json()
    solo_oculta = _ficha(client, ctx["id_publico"], fecha=_dia(1)).json()  # only E-003, hidden

    assert sin_nada["estado_elaboracion"] == "no_disponible"
    assert solo_oculta == sin_nada
    assert sin_nada["elaboracion"] is None and sin_nada["coincidencias"] == []


def test_con_parametros_y_sin_elaboraciones_visibles_es_sin_elaboraciones(client, publicado) -> None:
    _ocultar(client, publicado, publicado["elaboracion_id"])

    for params in ({"codigo": "E-001"}, {"fecha": _dia(5)}, {}):
        cuerpo = _ficha(client, publicado["id_publico"], **params).json()
        assert cuerpo["estado_elaboracion"] == "sin_elaboraciones", params
        assert (cuerpo["elaboracion"], cuerpo["elaboraciones"], cuerpo["coincidencias"]) == (None, [], [])


@pytest.mark.parametrize(
    "params",
    [
        {"codigo": "E-001", "fecha": "2026-01-01"},
        {"fecha": "01-02-2026"},
        {"fecha": "20260101"},
        {"fecha": "2026-1-1"},
        {"fecha": "2026-13-45"},
        {"fecha": "2026-02-30"},
        {"fecha": "abc"},
        {"fecha": ""},
    ],
)
def test_parametros_invalidos_dan_422_identico_con_id_publico_existente_e_inexistente(client, publicado, params) -> None:
    existente = _ficha(client, publicado["id_publico"], **params)
    inexistente = _ficha(client, "ZZZZZZZZZZZZZZZZZZZZZZ", **params)

    assert existente.status_code == 422
    assert set(existente.json()["detail"]) == {"mensaje"}
    assert _forma(existente) == _forma(inexistente)


def test_un_producto_no_publicado_con_codigo_o_fecha_validos_responde_el_404_uniforme(client, publicado) -> None:
    assert client.delete(f"/gestion/productos/{publicado['producto']['id']}/publicacion", headers=publicado["headers"]).status_code == 200
    esperada = (404, MENSAJE_NO_DISPONIBLE, CABECERAS["cache-control"], CABECERAS["x-robots-tag"])

    assert _forma(_ficha(client, publicado["id_publico"], codigo="E-001")) == esperada
    assert _forma(_ficha(client, publicado["id_publico"], fecha=_dia(5))) == esperada
    assert _forma(_ficha(client, "inexistente", codigo="E-001")) == esperada


def test_la_seleccion_por_codigo_y_por_fecha_no_supera_el_maximo_de_consultas(client, varias_elaboraciones, db_session) -> None:
    ctx = varias_elaboraciones
    _finalizar(client, ctx, "E-006", dias=3)

    por_defecto = _contar_consultas(client, db_session, ctx["id_publico"])
    cantidades = {
        "codigo": _contar_consultas(client, db_session, ctx["id_publico"], codigo="e-001"),
        "codigo inexistente": _contar_consultas(client, db_session, ctx["id_publico"], codigo="NO-EXISTE"),
        "fecha": _contar_consultas(client, db_session, ctx["id_publico"], fecha=_dia(5)),
        "fecha varias": _contar_consultas(client, db_session, ctx["id_publico"], fecha=_dia(3)),
    }

    assert por_defecto <= CONSULTAS_MAXIMAS
    assert all(cantidad <= CONSULTAS_MAXIMAS for cantidad in cantidades.values()), cantidades


def test_lista_blanca_de_t10_02_estado_y_coincidencias(client, varias_elaboraciones) -> None:
    ctx = varias_elaboraciones
    _finalizar(client, ctx, "E-006", dias=3)
    sin_elaboracion = {r for r in RUTAS_APROBADAS if not r.startswith("elaboracion.")}

    ok = _rutas(_ficha(client, ctx["id_publico"]).json())
    varias = _ficha(client, ctx["id_publico"], fecha=_dia(3))

    assert ok == RUTAS_APROBADAS
    assert varias.json()["estado_elaboracion"] == "varias"
    assert _rutas(varias.json()) == sin_elaboracion | {"coincidencias[].codigo", "coincidencias[].fecha"}
    assert {_ficha(client, ctx["id_publico"], **p).json()["estado_elaboracion"] for p in ({}, {"codigo": "x"}, {"fecha": _dia(3)}, {"fecha": _dia(20)})} <= ESTADOS


# =================================================================================================
# T10-03: grouped allergens (CA5) and previous version (CA6)
# =================================================================================================


def _declarar(client, db_session, ctx, insumo_id: int, declarados: dict[str, str]) -> None:
    """Replace the allergens the live supply declares (code -> "contiene" | "trazas")."""
    db_session.execute(delete(InsumoAlergeno).where(InsumoAlergeno.insumo_id == insumo_id))
    db_session.commit()
    for codigo, tipo in declarados.items():
        respuesta = client.post(
            f"/gestion/insumos/{insumo_id}/alergenos",
            headers=ctx["headers"],
            json={"alergeno_id": ctx["alergenos"][codigo], "tipo": tipo},
        )
        assert respuesta.status_code == 201, respuesta.text


def _grupos(client, db_session, ctx, codigo: str, *, leche: dict[str, str], harina: dict[str, str]) -> dict:
    """Declare allergens on the two supplies, finalize an elaboración and read its public groups."""
    _declarar(client, db_session, ctx, ctx["insumo_habitual"]["id"], leche)
    _declarar(client, db_session, ctx, ctx["insumo_harina"]["id"], harina)
    _finalizar(client, ctx, codigo, dias=2)
    cuerpo = _ficha(client, ctx["id_publico"], codigo=codigo).json()
    assert cuerpo["estado_elaboracion"] == "ok"
    grupos = cuerpo["elaboracion"]["alergenos"]
    assert set(grupos) == {"contiene", "puede_contener"}
    return {nombre: [a["codigo"] for a in lista] for nombre, lista in grupos.items()}


def test_pt10_06_contiene_leche_y_trazas_de_soya_y_leche_leche_no_se_repite_en_trazas(client, publicado, db_session) -> None:
    grupos = _grupos(
        client, db_session, publicado, "A-1", leche={"leche": "contiene"}, harina={"soya": "trazas", "leche": "trazas"}
    )

    assert grupos == {"contiene": ["leche"], "puede_contener": ["soya"]}


def test_el_mismo_alergeno_contiene_en_dos_insumos_aparece_una_sola_vez(client, publicado, db_session) -> None:
    grupos = _grupos(client, db_session, publicado, "A-2", leche={"leche": "contiene"}, harina={"leche": "contiene"})

    assert grupos == {"contiene": ["leche"], "puede_contener": []}


def test_el_mismo_alergeno_en_trazas_en_dos_insumos_aparece_una_sola_vez(client, publicado, db_session) -> None:
    grupos = _grupos(client, db_session, publicado, "A-3", leche={"soya": "trazas"}, harina={"soya": "trazas"})

    assert grupos == {"contiene": [], "puede_contener": ["soya"]}


def test_solo_trazas_deja_contiene_vacio(client, publicado, db_session) -> None:
    grupos = _grupos(client, db_session, publicado, "A-4", leche={"soya": "trazas"}, harina={"apio": "trazas"})

    assert grupos["contiene"] == []
    assert len(grupos["puede_contener"]) == 2


def test_sin_alergenos_en_ningun_insumo_ambas_listas_quedan_vacias(client, publicado, db_session) -> None:
    grupos = _grupos(client, db_session, publicado, "A-5", leche={}, harina={})

    assert grupos == {"contiene": [], "puede_contener": []}


def test_los_grupos_se_ordenan_primero_obligatorios_en_chile_y_luego_por_nombre(client, publicado, db_session) -> None:
    # Catalog in the test schema: leche and soya are mandatory in Chile; apio is not. Add two more
    # non-mandatory ones to check the tie-break by name.
    extra = {
        codigo: Alergeno(codigo=codigo, nombre=nombre, obligatorio_chile=False)
        for codigo, nombre in (("mostaza", "Mostaza"), ("altramuz", "Altramuz"))
    }
    db_session.add_all(extra.values())
    db_session.commit()
    publicado["alergenos"].update({codigo: alergeno.id for codigo, alergeno in extra.items()})

    grupos = _grupos(
        client,
        db_session,
        publicado,
        "A-6",
        leche={"mostaza": "contiene", "apio": "contiene", "leche": "contiene"},
        harina={"altramuz": "trazas", "soya": "trazas", "apio": "trazas"},
    )

    # Mandatory first (leche), then by name (Apio, Mostaza). Apio is in contiene, so not in trazas.
    assert grupos == {"contiene": ["leche", "apio", "mostaza"], "puede_contener": ["soya", "altramuz"]}


def test_una_copia_sin_la_clave_alergenos_sigue_dando_500_y_una_lista_vacia_no(client, publicado, monkeypatch) -> None:
    sin_clave = {k: v for k, v in COPIA_COMPLETA.items() if k != "alergenos"}
    vacia = {**COPIA_COMPLETA, "alergenos": []}
    monkeypatch.setattr(ConsultaPublicaRepository, "copias_conservadas", lambda self, elaboracion_id: [(1, vacia)])
    assert _ficha(client, publicado["id_publico"]).json()["elaboracion"]["alergenos"] == {"contiene": [], "puede_contener": []}

    monkeypatch.setattr(ConsultaPublicaRepository, "copias_conservadas", lambda self, elaboracion_id: [(1, sin_clave)])
    assert _ficha(client, publicado["id_publico"]).status_code == 500


def test_rt03_los_grupos_no_cambian_al_modificar_los_alergenos_del_insumo(client, publicado, db_session) -> None:
    antes = _ficha(client, publicado["id_publico"]).json()["elaboracion"]["alergenos"]
    assert antes["contiene"] and antes["puede_contener"]

    # Live supplies change: the milk supply declares nothing now and the flour supply contains milk.
    _declarar(client, db_session, publicado, publicado["insumo_habitual"]["id"], {})
    _declarar(client, db_session, publicado, publicado["insumo_harina"]["id"], {"leche": "contiene"})

    assert _ficha(client, publicado["id_publico"]).json()["elaboracion"]["alergenos"] == antes


# --- version_anterior (CA6, PT10-07) -------------------------------------------------------------


def _reformular(client, ctx) -> None:
    """A new current version of the recipe (one more ingredient); the earlier version was used."""
    extra = crear_ingrediente(client, ctx["headers"], "Extra versión", "ext-ver")
    insumo = crear_insumo(client, ctx["headers"], extra["id"], "Insumo extra versión", habitual=True)
    ctx["insumo_por_ingrediente"][extra["id"]] = insumo["id"]
    formular(client, ctx["headers"], ctx["producto"]["id"], ctx["harina"], ctx["leche"], extra)


def _version_anterior(client, ctx, **params) -> bool:
    cuerpo = _ficha(client, ctx["id_publico"], **params).json()
    assert cuerpo["estado_elaboracion"] == "ok"
    return cuerpo["elaboracion"]["version_anterior"]


def test_pt10_07_una_elaboracion_de_la_version_vigente_no_es_version_anterior(client, publicado) -> None:
    assert _version_anterior(client, publicado) is False


def test_pt10_07_una_elaboracion_de_una_version_anterior_lo_indica_sin_numero_ni_id(client, publicado) -> None:
    _reformular(client, publicado)
    _finalizar(client, publicado, "E-002", dias=2)  # made with the new current version

    anterior = _ficha(client, publicado["id_publico"], codigo="E-001")
    vigente = _ficha(client, publicado["id_publico"], codigo="E-002")

    assert anterior.json()["elaboracion"]["version_anterior"] is True
    assert vigente.json()["elaboracion"]["version_anterior"] is False
    for respuesta in (anterior, vigente):
        _sin_datos_de_version(respuesta.json())
    # The current version's content (its extra ingredient) is not exposed on the old elaboración.
    assert "Extra versión" not in anterior.text


def test_un_producto_sin_version_vigente_marca_version_anterior(client, publicado, db_session) -> None:
    db_session.execute(update(VersionProducto).where(VersionProducto.producto_id == publicado["producto"]["id"]).values(vigente=False))
    db_session.commit()

    assert _version_anterior(client, publicado) is True


def test_version_anterior_no_aplica_sin_elaboracion(client, publicado) -> None:
    cuerpo = _ficha(client, publicado["id_publico"], codigo="NO-EXISTE").json()

    assert cuerpo["elaboracion"] is None
    assert "version_anterior" not in str(cuerpo)


def test_las_consultas_no_superan_el_maximo_con_varios_insumos_y_version_anterior(client, publicado, db_session) -> None:
    _reformular(client, publicado)
    _finalizar(client, publicado, "E-002", dias=2)
    _finalizar(client, publicado, "E-003", dias=1)

    cantidades = {
        "defecto": _contar_consultas(client, db_session, publicado["id_publico"]),
        "version anterior": _contar_consultas(client, db_session, publicado["id_publico"], codigo="E-001"),
        "version vigente": _contar_consultas(client, db_session, publicado["id_publico"], codigo="E-002"),
    }

    assert all(cantidad <= CONSULTAS_MAXIMAS for cantidad in cantidades.values()), cantidades
    assert len(set(cantidades.values())) == 1
