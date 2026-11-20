"""HU14 / T14-05: GET and PUT /gestion/productos/{id}/costos and the calculated cost of the product detail.

Each request gets its own session (fixture `api`), so a missing commit would show up. Runs on SQLite
and on PostgreSQL.
"""

from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import event, select

from app.db.base import Base
from app.models import (
    CantidadIngredienteProducto,
    InsumoComercial,
    OtroCostoProducto,
    Producto,
    VersionProducto,
)
from app.services.elaboracion_service import hoy_santiago
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    completar_insumo,
    crear_alergenos,
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    registrar,
)

D = Decimal


def _precio(precio: str, contenido: str, unidad: str) -> dict:
    return {"precio_referencia": precio, "contenido_cantidad": contenido, "contenido_unidad": unidad}


@pytest.fixture
def ctx(api, fabrica) -> dict:
    """Queque with harina (habitual: Harina 1 kg a $1.000) and leche (habitual: Leche 1 L a $1.100)."""
    headers = registrar(api)
    producto = crear_producto(api, headers)
    harina = crear_ingrediente(api, headers, "Harina", "har-001")
    leche = crear_ingrediente(api, headers, "Leche", "lec-001")
    i_harina = crear_insumo(api, headers, harina["id"], "Harina 1 kg", habitual=True, **_precio("1000", "1", "kg"))
    i_leche = crear_insumo(api, headers, leche["id"], "Leche 1 L", habitual=True, **_precio("1100", "1", "L"))
    i_otra = crear_insumo(api, headers, harina["id"], "Harina integral 1 kg", **_precio("2000", "1", "kg"))
    version = formular(api, headers, producto["id"], harina, leche)["version"]
    return {
        "headers": headers,
        "producto": producto,
        "pid": producto["id"],
        "harina": harina,
        "leche": leche,
        "i_harina": i_harina,
        "i_leche": i_leche,
        "i_otra": i_otra,
        "version": version,
        "fabrica": fabrica,
    }


def _url(ctx: dict) -> str:
    return f"/gestion/productos/{ctx['pid']}/costos"


def _get(api, ctx: dict, **params):
    return api.get(_url(ctx), headers=ctx["headers"], params=params or None)


def _put(api, ctx: dict, cuerpo: dict, params=None):
    return api.put(_url(ctx), headers=ctx["headers"], json=cuerpo, params=params)


def _completar(api, ctx: dict, rendimiento: int | None = 8) -> dict:
    """250 g of harina and 200 ml of leche: $250 + $220, plus $30,50 of other costs."""
    cuerpo = {
        "cantidades": [
            {"ingrediente_id": ctx["harina"]["id"], "cantidad": "250", "unidad": "g"},
            {"ingrediente_id": ctx["leche"]["id"], "cantidad": "200", "unidad": "ml"},
        ],
        "otros_costos": [{"nombre": "Gas", "monto": "30.50"}],
    }
    if rendimiento is not None:
        cuerpo["rendimiento"] = rendimiento
    respuesta = _put(api, ctx, cuerpo)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _foto(fabrica) -> dict[str, list]:
    """Every row of the tables a save of the calculator must not touch."""
    tablas = [
        "versiones_producto",
        "versiones_producto_formulacion",
        "elaboraciones",
        "usos_insumo",
        "insumos_comerciales",
    ]
    with fabrica() as sesion:
        return {
            nombre: sorted(
                (tuple(fila) for fila in sesion.execute(select(Base.metadata.tables[nombre]))),
                key=lambda fila: fila[0],
            )
            for nombre in tablas
        }


def _versiones(fabrica) -> int:
    with fabrica() as sesion:
        return len(sesion.scalars(select(VersionProducto.id)).all())


@contextmanager
def _consultas(motor):
    sentencias: list[str] = []

    def guardar(conn, cursor, statement, parameters, context, executemany):
        sentencias.append(statement)

    event.listen(motor, "before_cursor_execute", guardar)
    try:
        yield sentencias
    finally:
        event.remove(motor, "before_cursor_execute", guardar)


def _linea(datos: dict, ingrediente: dict) -> dict:
    return next(linea for linea in datos["lineas"] if linea["ingrediente_id"] == ingrediente["id"])


# --- GET: forma de la respuesta -----------------------------------------------------------------


def test_get_de_un_producto_sin_nada_guardado_indica_cada_faltante(api, ctx) -> None:
    respuesta = _get(api, ctx)

    assert respuesta.status_code == 200, respuesta.text
    datos = respuesta.json()
    assert set(datos) == {
        "producto_id",
        "producto_nombre",
        "tiene_formulacion",
        "version_id",
        "rendimiento",
        "lineas",
        "otros_costos",
        "resumen",
    }
    assert datos["producto_id"] == ctx["pid"]
    assert datos["tiene_formulacion"] is True
    assert datos["version_id"] is not None
    assert datos["rendimiento"] is None
    assert [linea["ingrediente_nombre"] for linea in datos["lineas"]] == ["Harina", "Leche"]
    harina = _linea(datos, ctx["harina"])
    assert [f["codigo"] for f in harina["faltantes"]] == ["sin_cantidad"]
    assert harina["faltantes"][0]["mensaje"]
    assert harina["insumo"]["id"] == ctx["i_harina"]["id"]
    assert harina["origen_insumo"] == "habitual"
    assert harina["aviso_insumo"] is None
    assert harina["cantidad"] is None and harina["costo"] is None
    assert {i["id"] for i in harina["insumos_disponibles"]} == {ctx["i_harina"]["id"], ctx["i_otra"]["id"]}
    assert set(harina["insumo"]) == {
        "id",
        "nombre",
        "marca_origen",
        "presentacion",
        "habitual",
        "precio_referencia",
        "precio_fuente",
        "precio_fecha",
        "contenido_cantidad",
        "contenido_unidad",
        "contenido_fuente",
    }
    resumen = datos["resumen"]
    assert resumen["completo"] is False
    assert resumen["lineas_incompletas"] == 2
    assert resumen["total_ingredientes"] is None and resumen["costo_tanda"] is None and resumen["costo_unidad"] is None
    assert resumen["total_otros_costos"] == "0.0000"


def test_los_decimales_viajan_como_texto_con_decimales_fijos(api, ctx) -> None:
    datos = _completar(api, ctx)

    harina = _linea(datos, ctx["harina"])
    assert harina["costo"] == "250.0000"
    assert harina["cantidad"] == "250.000"
    assert harina["insumo"]["precio_referencia"] == "1000.00"
    assert harina["insumo"]["contenido_cantidad"] == "1.000"
    assert datos["otros_costos"][0]["monto"] == "30.50"
    resumen = datos["resumen"]
    assert resumen["total_ingredientes"] == "470.0000"
    assert resumen["total_otros_costos"] == "30.5000"
    assert resumen["costo_tanda"] == "500.5000"
    assert resumen["costo_unidad"] == "62.5625"
    assert datos["rendimiento"] == 8  # an integer, not a text
    for texto in (harina["costo"], harina["cantidad"], resumen["costo_tanda"]):
        assert isinstance(texto, str)


def test_un_producto_sin_formulacion_responde_sin_lineas(api, ctx) -> None:
    sin_formular = crear_producto(api, ctx["headers"], "Sin formular", "sin-001")

    respuesta = api.get(f"/gestion/productos/{sin_formular['id']}/costos", headers=ctx["headers"])

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["tiene_formulacion"] is False
    assert datos["version_id"] is None
    assert datos["lineas"] == []
    assert datos["resumen"]["costo_tanda"] is None


# --- PT14-05: cantidades ------------------------------------------------------------------------


def test_guardar_cantidades_calcula_y_no_crea_una_version(api, ctx) -> None:
    antes = _versiones(ctx["fabrica"])
    foto = _foto(ctx["fabrica"])

    datos = _completar(api, ctx, rendimiento=None)

    assert _linea(datos, ctx["harina"])["cantidad"] == "250.000"
    assert datos["resumen"]["completo"] is True
    assert _versiones(ctx["fabrica"]) == antes
    assert _foto(ctx["fabrica"]) == foto
    # and it is persisted
    again = _get(api, ctx).json()
    assert _linea(again, ctx["leche"])["cantidad"] == "200.000"
    assert _linea(again, ctx["leche"])["unidad"] == "ml"


@pytest.mark.parametrize("cantidad", ["0", "-5", "-0.001", 0, -1])
def test_cantidad_cero_o_negativa_es_422_y_no_guarda_nada(api, ctx, cantidad) -> None:
    respuesta = _put(
        api,
        ctx,
        {"rendimiento": 5, "cantidades": [{"ingrediente_id": ctx["harina"]["id"], "cantidad": cantidad, "unidad": "g"}]},
    )

    assert respuesta.status_code == 422, respuesta.text
    assert _get(api, ctx).json()["rendimiento"] is None


@pytest.mark.parametrize(
    "item",
    [
        {"cantidad": "5"},  # quantity without unit
        {"unidad": "g"},  # unit without quantity
        {"cantidad": "5", "unidad": "oz"},
        {"cantidad": "abc", "unidad": "g"},
        {"cantidad": "1.2345", "unidad": "g"},  # more than 3 decimals
        {"cantidad": "1000000000", "unidad": "g"},  # more than 12 digits
    ],
)
def test_cantidad_y_unidad_van_juntas_y_validas(api, ctx, item) -> None:
    respuesta = _put(api, ctx, {"cantidades": [{"ingrediente_id": ctx["harina"]["id"], **item}]})

    assert respuesta.status_code == 422, respuesta.text


def test_upsert_actualiza_y_los_ausentes_no_se_tocan(api, ctx) -> None:
    _completar(api, ctx)

    datos = _put(
        api, ctx, {"cantidades": [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "500", "unidad": "g"}]}
    ).json()

    assert _linea(datos, ctx["harina"])["cantidad"] == "500.000"
    assert _linea(datos, ctx["harina"])["costo"] == "500.0000"
    assert _linea(datos, ctx["leche"])["cantidad"] == "200.000"  # absent: untouched
    assert datos["rendimiento"] == 8
    assert datos["otros_costos"][0]["nombre"] == "Gas"


def test_cantidad_y_unidad_null_borran_la_fila(api, ctx) -> None:
    _completar(api, ctx)

    datos = _put(api, ctx, {"cantidades": [{"ingrediente_id": ctx["leche"]["id"], "cantidad": None, "unidad": None}]}).json()

    leche = _linea(datos, ctx["leche"])
    assert leche["cantidad"] is None
    assert [f["codigo"] for f in leche["faltantes"]] == ["sin_cantidad"]
    with ctx["fabrica"]() as sesion:
        filas = sesion.scalars(select(CantidadIngredienteProducto.ingrediente_id)).all()
    assert filas == [ctx["harina"]["id"]]


def test_unidades_incompatibles_se_indican_en_la_linea(api, ctx) -> None:
    datos = _put(
        api, ctx, {"cantidades": [{"ingrediente_id": ctx["leche"]["id"], "cantidad": "200", "unidad": "g"}]}
    ).json()

    assert [f["codigo"] for f in _linea(datos, ctx["leche"])["faltantes"]] == ["unidades_incompatibles"]


def test_un_ingrediente_fuera_de_la_formulacion_vigente_es_422_con_su_id_y_no_guarda_nada(api, ctx) -> None:
    azucar = crear_ingrediente(api, ctx["headers"], "Azúcar", "azu-001")

    respuesta = _put(
        api,
        ctx,
        {
            "rendimiento": 5,
            "otros_costos": [{"nombre": "Gas", "monto": "10"}],
            "cantidades": [
                {"ingrediente_id": ctx["harina"]["id"], "cantidad": "250", "unidad": "g"},
                {"ingrediente_id": azucar["id"], "cantidad": "10", "unidad": "g"},
            ],
        },
    )

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"]["ingrediente_id"] == azucar["id"]
    assert respuesta.json()["detail"]["mensaje"]
    # One transaction: nothing of the same body stayed.
    datos = _get(api, ctx).json()
    assert datos["rendimiento"] is None
    assert datos["otros_costos"] == []
    assert _linea(datos, ctx["harina"])["cantidad"] is None


def test_un_ingrediente_repetido_en_el_cuerpo_es_422_con_su_id(api, ctx) -> None:
    item = {"ingrediente_id": ctx["harina"]["id"], "cantidad": "250", "unidad": "g"}

    respuesta = _put(api, ctx, {"cantidades": [item, {**item, "cantidad": "300"}]})

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"]["ingrediente_id"] == ctx["harina"]["id"]


def test_un_ingrediente_que_salio_de_la_formulacion_conserva_su_cantidad_pero_no_se_usa(api, ctx) -> None:
    _completar(api, ctx)
    formular(api, ctx["headers"], ctx["pid"], ctx["harina"])  # leche leaves the current version

    datos = _get(api, ctx).json()

    assert [linea["ingrediente_nombre"] for linea in datos["lineas"]] == ["Harina"]
    assert datos["resumen"]["costo_tanda"] == "280.5000"  # 250 + 30,50 of other costs
    with ctx["fabrica"]() as sesion:
        assert len(sesion.scalars(select(CantidadIngredienteProducto.id)).all()) == 2
    # And now it cannot be written again: it is not in the current formulation.
    respuesta = _put(api, ctx, {"cantidades": [{"ingrediente_id": ctx["leche"]["id"], "cantidad": "1", "unidad": "ml"}]})
    assert respuesta.status_code == 422


# --- PT14-10: otros costos ----------------------------------------------------------------------


def test_agregar_editar_y_eliminar_otros_costos_cambia_el_total(api, ctx) -> None:
    _completar(api, ctx)

    agregados = _put(
        api, ctx, {"otros_costos": [{"nombre": "Gas", "monto": "30.50"}, {"nombre": "  Caja  ", "monto": "100"}]}
    ).json()
    assert [(o["nombre"], o["monto"], o["orden"]) for o in agregados["otros_costos"]] == [
        ("Gas", "30.50", 1),
        ("Caja", "100.00", 2),
    ]
    assert agregados["resumen"]["total_otros_costos"] == "130.5000"
    assert agregados["resumen"]["costo_tanda"] == "600.5000"

    editados = _put(api, ctx, {"otros_costos": [{"nombre": "Caja", "monto": "20"}]}).json()
    assert [(o["nombre"], o["monto"]) for o in editados["otros_costos"]] == [("Caja", "20.00")]
    assert editados["resumen"]["costo_tanda"] == "490.0000"

    vacios = _put(api, ctx, {"otros_costos": []}).json()
    assert vacios["otros_costos"] == []
    assert vacios["resumen"]["total_otros_costos"] == "0.0000"
    assert vacios["resumen"]["costo_tanda"] == "470.0000"
    with ctx["fabrica"]() as sesion:
        assert sesion.scalars(select(OtroCostoProducto.id)).all() == []


def test_un_put_sin_otros_costos_no_los_toca(api, ctx) -> None:
    _completar(api, ctx)

    datos = _put(api, ctx, {"rendimiento": 4}).json()

    assert [o["nombre"] for o in datos["otros_costos"]] == ["Gas"]


@pytest.mark.parametrize(
    "otro",
    [
        {"nombre": "Gas", "monto": "-1"},
        {"nombre": "Gas", "monto": "-0.01"},
        {"nombre": "   ", "monto": "10"},
        {"nombre": "", "monto": "10"},
        {"nombre": "x" * 101, "monto": "10"},
        {"nombre": "Gas", "monto": "10.123"},
        {"nombre": "Gas", "monto": "abc"},
        {"nombre": "Gas"},
        {"monto": "10"},
        {"nombre": "Gas", "monto": "10", "extra": 1},
    ],
)
def test_otro_costo_invalido_es_422(api, ctx, otro) -> None:
    respuesta = _put(api, ctx, {"otros_costos": [otro]})

    assert respuesta.status_code == 422, respuesta.text


def test_el_monto_cero_y_el_nombre_de_100_caracteres_son_validos(api, ctx) -> None:
    respuesta = _put(api, ctx, {"otros_costos": [{"nombre": "x" * 100, "monto": "0"}]})

    assert respuesta.status_code == 200, respuesta.text


def test_los_limites_de_listas(api, ctx) -> None:
    ok = _put(api, ctx, {"otros_costos": [{"nombre": f"c{i}", "monto": "1"} for i in range(50)]})
    demasiados = _put(api, ctx, {"otros_costos": [{"nombre": f"c{i}", "monto": "1"} for i in range(51)]})
    muchas = _put(
        api,
        ctx,
        {"cantidades": [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "1", "unidad": "g"}] * 201},
    )

    assert ok.status_code == 200
    assert demasiados.status_code == 422
    assert muchas.status_code == 422


# --- PT14-11: rendimiento -----------------------------------------------------------------------


def test_rendimiento_8_da_el_costo_por_unidad_y_null_lo_borra(api, ctx) -> None:
    datos = _completar(api, ctx, rendimiento=8)
    assert datos["resumen"]["costo_tanda"] == "500.5000"
    assert datos["resumen"]["costo_unidad"] == "62.5625"

    sin = _put(api, ctx, {"rendimiento": None}).json()
    assert sin["rendimiento"] is None
    assert sin["resumen"]["costo_tanda"] == "500.5000"
    assert sin["resumen"]["costo_unidad"] is None


def test_un_put_sin_rendimiento_no_lo_toca(api, ctx) -> None:
    _completar(api, ctx, rendimiento=8)

    datos = _put(api, ctx, {"otros_costos": []}).json()

    assert datos["rendimiento"] == 8


@pytest.mark.parametrize("rendimiento", [0, -1, 1_000_001, "x", 2.5])
def test_rendimiento_invalido_es_422(api, ctx, rendimiento) -> None:
    respuesta = _put(api, ctx, {"rendimiento": rendimiento})

    assert respuesta.status_code == 422, respuesta.text


def test_el_rendimiento_maximo_es_valido(api, ctx) -> None:
    assert _put(api, ctx, {"rendimiento": 1_000_000}).json()["rendimiento"] == 1_000_000


# --- cuerpo del PUT -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"desconocido": 1},
        {"rendimiento": 2, "precio_venta": "10"},
        {"cantidades": [{"ingrediente_id": 1, "cantidad": "1", "unidad": "g", "x": 1}]},
        {"cantidades": None},
        {"otros_costos": None},
        {"cantidades": "no es lista"},
    ],
)
def test_un_cuerpo_con_campos_desconocidos_o_mal_formado_es_422(api, ctx, cuerpo) -> None:
    assert _put(api, ctx, cuerpo).status_code == 422


def test_un_cuerpo_vacio_no_cambia_nada_y_responde_el_calculo(api, ctx) -> None:
    _completar(api, ctx)
    antes = _get(api, ctx).json()

    respuesta = _put(api, ctx, {})

    assert respuesta.status_code == 200
    assert respuesta.json() == antes


# --- PT14-04: insumo alternativo ----------------------------------------------------------------


def test_el_parametro_insumo_recalcula_y_el_get_siguiente_vuelve_a_la_preseleccion(api, ctx) -> None:
    _completar(api, ctx)
    harina_id = ctx["harina"]["id"]

    elegido = _get(api, ctx, insumo=f"{harina_id}:{ctx['i_otra']['id']}").json()

    linea = _linea(elegido, ctx["harina"])
    assert linea["insumo"]["id"] == ctx["i_otra"]["id"]
    assert linea["origen_insumo"] == "elegido"
    assert linea["costo"] == "500.0000"
    assert elegido["resumen"]["costo_tanda"] == "750.5000"

    siguiente = _get(api, ctx).json()
    linea = _linea(siguiente, ctx["harina"])
    assert linea["insumo"]["id"] == ctx["i_harina"]["id"]
    assert linea["origen_insumo"] == "habitual"
    assert siguiente["resumen"]["costo_tanda"] == "500.5000"


def test_el_put_acepta_el_insumo_alternativo_y_tampoco_lo_guarda(api, ctx) -> None:
    harina_id = ctx["harina"]["id"]

    respuesta = api.put(
        _url(ctx),
        headers=ctx["headers"],
        params={"insumo": f"{harina_id}:{ctx['i_otra']['id']}"},
        json={"cantidades": [{"ingrediente_id": harina_id, "cantidad": "250", "unidad": "g"}]},
    )

    assert respuesta.status_code == 200, respuesta.text
    linea = _linea(respuesta.json(), ctx["harina"])
    assert linea["origen_insumo"] == "elegido"
    assert linea["costo"] == "500.0000"
    assert _linea(_get(api, ctx).json(), ctx["harina"])["origen_insumo"] == "habitual"


def test_varios_insumo_alternativos_se_aplican_juntos(api, ctx) -> None:
    otra_leche = crear_insumo(api, ctx["headers"], ctx["leche"]["id"], "Leche entera", **_precio("2200", "1", "L"))
    _completar(api, ctx)

    datos = api.get(
        _url(ctx),
        headers=ctx["headers"],
        params=[
            ("insumo", f"{ctx['harina']['id']}:{ctx['i_otra']['id']}"),
            ("insumo", f"{ctx['leche']['id']}:{otra_leche['id']}"),
        ],
    ).json()

    assert _linea(datos, ctx["harina"])["costo"] == "500.0000"
    assert _linea(datos, ctx["leche"])["costo"] == "440.0000"


@pytest.mark.parametrize("valor", ["abc", "1", ":", "1:", ":2", "1:2:3", "1:x", "x:1", "0:1", "1:0", "-1:2", "1: 2", "1.5:2", ""])
def test_un_parametro_insumo_mal_formado_es_422_con_mensaje(api, ctx, valor) -> None:
    respuesta = _get(api, ctx, insumo=valor)

    assert respuesta.status_code == 422, respuesta.text
    assert respuesta.json()["detail"]["mensaje"]


def test_un_ingrediente_repetido_en_el_parametro_insumo_es_422(api, ctx) -> None:
    harina_id = ctx["harina"]["id"]

    respuesta = api.get(
        _url(ctx),
        headers=ctx["headers"],
        params=[("insumo", f"{harina_id}:{ctx['i_harina']['id']}"), ("insumo", f"{harina_id}:{ctx['i_otra']['id']}")],
    )

    assert respuesta.status_code == 422
    assert "más de una vez" in respuesta.json()["detail"]["mensaje"]


def test_el_parametro_mal_formado_tambien_es_422_en_el_put(api, ctx) -> None:
    respuesta = api.put(_url(ctx), headers=ctx["headers"], params={"insumo": "abc"}, json={})

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["mensaje"]


def test_una_alternativa_inactiva_de_otro_ingrediente_de_otro_productor_o_fuera_de_la_formulacion_es_422(
    api, ctx
) -> None:
    fabrica = ctx["fabrica"]
    inactivo = crear_insumo(api, ctx["headers"], ctx["harina"]["id"], "Harina vieja", **_precio("1", "1", "kg"))
    with fabrica() as sesion:
        sesion.get(InsumoComercial, inactivo["id"]).activo = False
        sesion.commit()
    otro_productor = registrar(api, PRODUCTOR_B)
    ajeno_ingrediente = crear_ingrediente(api, otro_productor, "Harina", "har-001")
    ajeno = crear_insumo(api, otro_productor, ajeno_ingrediente["id"], "Harina ajena", **_precio("1", "1", "kg"))
    azucar = crear_ingrediente(api, ctx["headers"], "Azúcar", "azu-001")
    de_azucar = crear_insumo(api, ctx["headers"], azucar["id"], "Azúcar 1 kg", **_precio("1", "1", "kg"))
    harina_id = ctx["harina"]["id"]

    casos = {
        "inactivo": f"{harina_id}:{inactivo['id']}",
        "de otro ingrediente": f"{harina_id}:{ctx['i_leche']['id']}",
        "de otro productor": f"{harina_id}:{ajeno['id']}",
        "inexistente": f"{harina_id}:999999",
        "ingrediente fuera de la formulación": f"{azucar['id']}:{de_azucar['id']}",
    }
    for descripcion, valor in casos.items():
        respuesta = _get(api, ctx, insumo=valor)
        assert respuesta.status_code == 422, (descripcion, respuesta.text)
        assert respuesta.json()["detail"]["mensaje"], descripcion
        assert respuesta.json()["detail"]["ingrediente_id"] in (harina_id, azucar["id"]), descripcion


# --- costo calculado del detalle (PT14-13) -------------------------------------------------------


def _detalle(api, ctx: dict) -> dict:
    respuesta = api.get(f"/gestion/productos/{ctx['pid']}", headers=ctx["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _costo_produccion_en_base(fabrica, producto_id: int):
    with fabrica() as sesion:
        return sesion.get(Producto, producto_id).costo_produccion


def test_el_detalle_trae_el_costo_calculado_y_no_toca_el_costo_de_produccion(api, ctx) -> None:
    assert api.patch(
        f"/gestion/productos/{ctx['pid']}", headers=ctx["headers"], json={"costo_produccion": "54321.00"}
    ).status_code == 200
    _completar(api, ctx, rendimiento=8)

    detalle = _detalle(api, ctx)

    assert detalle["costo_calculado"] == "62.5625"
    assert detalle["costo_produccion"] == "54321.00"
    assert _costo_produccion_en_base(ctx["fabrica"], ctx["pid"]) == D("54321.00")


def test_el_costo_calculado_es_null_sin_rendimiento_sin_formulacion_o_con_un_dato_faltante(api, ctx) -> None:
    sin_rendimiento = _detalle(api, ctx)
    assert sin_rendimiento["costo_calculado"] is None

    _completar(api, ctx, rendimiento=8)
    assert _detalle(api, ctx)["costo_calculado"] == "62.5625"
    # A price is erased: the calculation is no longer complete and the detail goes back to the manual value.
    assert api.patch(
        f"/gestion/insumos/{ctx['i_harina']['id']}", headers=ctx["headers"], json={"precio_referencia": None}
    ).status_code == 200
    assert _detalle(api, ctx)["costo_calculado"] is None
    assert _put(api, ctx, {"rendimiento": None}).status_code == 200

    sin_formular = crear_producto(api, ctx["headers"], "Sin formular", "sin-001")
    assert api.get(f"/gestion/productos/{sin_formular['id']}", headers=ctx["headers"]).json()["costo_calculado"] is None


def test_costo_calculado_solo_en_el_detalle_y_en_el_patch_no_en_el_listado_ni_en_el_post(api, ctx) -> None:
    _completar(api, ctx, rendimiento=8)

    listado = api.get("/gestion/productos", headers=ctx["headers"]).json()
    parchado = api.patch(f"/gestion/productos/{ctx['pid']}", headers=ctx["headers"], json={"descripcion": "Nueva"})
    creado = api.post(
        "/gestion/productos",
        headers=ctx["headers"],
        json={"codigo_interno": "nuevo-001", "nombre": "Nuevo", "descripcion": "x", "contenido_neto": "1", "unidad_medida": "g"},
    )

    assert [p["costo_calculado"] for p in listado] == [None]
    assert parchado.status_code == 200
    assert parchado.json()["costo_calculado"] == "62.5625"
    assert creado.status_code == 201
    assert creado.json()["costo_calculado"] is None


def test_el_costo_calculado_cambia_con_el_precio_del_insumo_y_el_manual_no(api, ctx) -> None:
    assert api.patch(
        f"/gestion/productos/{ctx['pid']}", headers=ctx["headers"], json={"costo_produccion": "99.00"}
    ).status_code == 200
    _completar(api, ctx, rendimiento=1)
    assert _detalle(api, ctx)["costo_calculado"] == "500.5000"

    assert api.patch(
        f"/gestion/insumos/{ctx['i_harina']['id']}", headers=ctx["headers"], json={"precio_referencia": "2000"}
    ).status_code == 200

    detalle = _detalle(api, ctx)
    assert detalle["costo_calculado"] == "750.5000"
    assert detalle["costo_produccion"] == "99.00"


def _instante(texto: str) -> datetime:
    """ISO 8601 text as a naive UTC instant, so SQLite and PostgreSQL serializations compare equal."""
    valor = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    return valor.astimezone(UTC).replace(tzinfo=None) if valor.tzinfo else valor


def test_pt14_07_editar_el_precio_de_un_insumo_usado_en_dos_productos_cambia_ambos_calculos(api, ctx) -> None:
    """PT14-07: one supply, two products; the price lives in the supply, so both calculations follow it."""
    # Product 1 (ctx): 250 g of harina + 200 ml of leche + $30,50 of other costs, yield 1 = $500,50.
    _completar(api, ctx, rendimiento=1)
    # Product 2: only harina, 500 g, yield 1 = $500 (harina 1 kg a $1.000, the same supply).
    pan = crear_producto(api, ctx["headers"], "Pan de molde", "pan-001")
    formular(api, ctx["headers"], pan["id"], ctx["harina"])
    ctx_pan = {**ctx, "pid": pan["id"]}
    guardado = _put(
        api,
        ctx_pan,
        {"cantidades": [{"ingrediente_id": ctx["harina"]["id"], "cantidad": "500", "unidad": "g"}], "rendimiento": 1},
    )
    assert guardado.status_code == 200, guardado.text
    # Both products really use the same supply.
    assert _linea(_get(api, ctx).json(), ctx["harina"])["insumo"]["id"] == ctx["i_harina"]["id"]
    assert _linea(_get(api, ctx_pan).json(), ctx["harina"])["insumo"]["id"] == ctx["i_harina"]["id"]
    assert _get(api, ctx).json()["resumen"]["costo_unidad"] == "500.5000"
    assert _get(api, ctx_pan).json()["resumen"]["costo_unidad"] == "500.0000"

    # The price comes from Jumbo with an old date, so the change to «manual» is visible.
    viejo = datetime(2026, 1, 1, tzinfo=UTC)
    with ctx["fabrica"]() as sesion:
        insumo = sesion.get(InsumoComercial, ctx["i_harina"]["id"])
        insumo.precio_fuente = "jumbo"
        insumo.precio_fecha = viejo
        sesion.commit()

    antes = datetime.now(UTC).replace(tzinfo=None)
    editado = api.patch(
        f"/gestion/insumos/{ctx['i_harina']['id']}", headers=ctx["headers"], json={"precio_referencia": "2000"}
    )
    assert editado.status_code == 200, editado.text

    # Harina now costs $2.000 per kg: 250 g = $500 (+ $220 + $30,50) and 500 g = $1.000.
    primero = _get(api, ctx).json()
    segundo = _get(api, ctx_pan).json()
    assert primero["resumen"]["costo_unidad"] == "750.5000"
    assert segundo["resumen"]["costo_unidad"] == "1000.0000"
    assert _detalle(api, ctx)["costo_calculado"] == "750.5000"
    assert _detalle(api, ctx_pan)["costo_calculado"] == "1000.0000"

    # The source is «manual», with the date of the change (not the old one).
    leido = api.get(f"/gestion/insumos/{ctx['i_harina']['id']}", headers=ctx["headers"]).json()
    assert leido["precio_referencia"] == "2000.00"
    assert leido["precio_fuente"] == "manual"
    assert _instante(leido["precio_fecha"]) >= antes - timedelta(seconds=5)
    assert _instante(leido["precio_fecha"]) > viejo.replace(tzinfo=None)
    # Product 2 only uses harina, so its oldest price is that very date.
    assert _instante(segundo["resumen"]["precio_mas_antiguo"]) == _instante(leido["precio_fecha"])


# --- PT14-14: lo conservado no cambia ------------------------------------------------------------


def test_guardar_no_cambia_versiones_elaboraciones_usos_ni_la_informacion_conservada(api, ctx, fabrica) -> None:
    with fabrica() as sesion:
        alergenos = crear_alergenos(sesion)
    ctx_hu05 = {"headers": ctx["headers"], "pid": ctx["pid"]}
    completar_insumo(api, ctx["headers"], ctx["i_leche"]["id"], alergenos)
    fecha = (hoy_santiago() - timedelta(days=1)).isoformat()
    creada = crear_elaboracion(api, ctx_hu05["headers"], ctx["pid"], codigo="E-1", fecha=fecha)
    assert creada.status_code == 201, creada.text
    elaboracion = creada.json()
    usos = [
        {
            "ingrediente_id": uso["ingrediente_id"],
            "insumo_id": ctx["i_harina"]["id"] if uso["ingrediente_id"] == ctx["harina"]["id"] else ctx["i_leche"]["id"],
            "lote": {"tipo": "sin_lote"},
        }
        for uso in elaboracion["usos"]
    ]
    assert api.put(f"/gestion/elaboraciones/{elaboracion['id']}/usos", headers=ctx["headers"], json={"usos": usos}).status_code == 200
    final = api.post(f"/gestion/elaboraciones/{elaboracion['id']}/finalizar", headers=ctx["headers"])
    assert final.status_code == 200, final.text
    antes = _foto(fabrica)
    assert any(fila[-3] for fila in antes["usos_insumo"]) or antes["usos_insumo"]  # there are uses to compare

    _completar(api, ctx)
    harina_id = ctx["harina"]["id"]
    api.get(_url(ctx), headers=ctx["headers"], params={"insumo": f"{harina_id}:{ctx['i_otra']['id']}"})
    _put(api, ctx, {"cantidades": [{"ingrediente_id": harina_id, "cantidad": "999", "unidad": "kg"}], "otros_costos": []})

    assert _foto(fabrica) == antes


def test_la_preseleccion_usa_el_insumo_de_la_ultima_elaboracion_finalizada(api, ctx, fabrica) -> None:
    with fabrica() as sesion:
        alergenos = crear_alergenos(sesion)
    completar_insumo(api, ctx["headers"], ctx["i_leche"]["id"], alergenos)
    fecha = (hoy_santiago() - timedelta(days=1)).isoformat()
    elaboracion = crear_elaboracion(api, ctx["headers"], ctx["pid"], codigo="E-1", fecha=fecha).json()
    usos = [
        {
            "ingrediente_id": uso["ingrediente_id"],
            # the not-habitual flour is used
            "insumo_id": ctx["i_otra"]["id"] if uso["ingrediente_id"] == ctx["harina"]["id"] else ctx["i_leche"]["id"],
            "lote": {"tipo": "sin_lote"},
        }
        for uso in elaboracion["usos"]
    ]
    api.put(f"/gestion/elaboraciones/{elaboracion['id']}/usos", headers=ctx["headers"], json={"usos": usos})
    assert api.post(f"/gestion/elaboraciones/{elaboracion['id']}/finalizar", headers=ctx["headers"]).status_code == 200

    linea = _linea(_get(api, ctx).json(), ctx["harina"])

    assert linea["origen_insumo"] == "ultima_elaboracion"
    assert linea["insumo"]["id"] == ctx["i_otra"]["id"]


# --- PT14-15: aislamiento y autenticación --------------------------------------------------------


def test_un_producto_de_otro_productor_o_inexistente_es_404_en_get_y_put(api, ctx) -> None:
    otro = registrar(api, PRODUCTOR_B)
    cuerpo = {"rendimiento": 5, "otros_costos": [{"nombre": "Gas", "monto": "1"}]}

    for producto_id, headers in ((ctx["pid"], otro), (999999, ctx["headers"])):
        url = f"/gestion/productos/{producto_id}/costos"
        lectura = api.get(url, headers=headers)
        escritura = api.put(url, headers=headers, json=cuerpo)
        assert lectura.status_code == 404, lectura.text
        assert escritura.status_code == 404, escritura.text
        assert isinstance(lectura.json()["detail"], str)
        assert isinstance(escritura.json()["detail"], str)

    # The foreign PUT changed nothing.
    datos = _get(api, ctx).json()
    assert datos["rendimiento"] is None and datos["otros_costos"] == []


def test_un_producto_dado_de_baja_es_404(api, ctx) -> None:
    assert api.delete(f"/gestion/productos/{ctx['pid']}", headers=ctx["headers"]).status_code == 204

    assert _get(api, ctx).status_code == 404
    assert _put(api, ctx, {"rendimiento": 2}).status_code == 404


def test_sin_token_es_401(api, ctx) -> None:
    assert api.get(_url(ctx)).status_code == 401
    assert api.put(_url(ctx), json={}).status_code == 401
    assert api.get(_url(ctx), headers={"Authorization": "Bearer invalido"}).status_code == 401


def test_el_404_y_el_422_no_se_confunden_con_los_datos_de_otro_productor(api, ctx) -> None:
    """A parameter pointing at a supply of another productor is a 422 of the owner, never a leak."""
    otro = registrar(api, PRODUCTOR_B)
    ingrediente = crear_ingrediente(api, otro, "Harina", "har-001")
    ajeno = crear_insumo(api, otro, ingrediente["id"], "Ajena", **_precio("1", "1", "kg"))

    respuesta = _get(api, ctx, insumo=f"{ctx['harina']['id']}:{ajeno['id']}")

    assert respuesta.status_code == 422
    assert "Ajena" not in respuesta.text


# --- consultas ----------------------------------------------------------------------------------


def _producto_con_n_lineas(api, headers, n: int, prefijo: str) -> int:
    producto = crear_producto(api, headers, f"Producto {prefijo}", f"{prefijo}-p")
    ingredientes = []
    cuerpo = {"rendimiento": 4, "cantidades": [], "otros_costos": [{"nombre": "Gas", "monto": "10"}]}
    for i in range(n):
        ingrediente = crear_ingrediente(api, headers, f"{prefijo} ing {i}", f"{prefijo}-{i}")
        crear_insumo(api, headers, ingrediente["id"], f"{prefijo} H {i}", habitual=True, **_precio("1000", "1", "kg"))
        crear_insumo(api, headers, ingrediente["id"], f"{prefijo} O {i}", **_precio("2000", "1", "kg"))
        ingredientes.append(ingrediente)
        cuerpo["cantidades"].append({"ingrediente_id": ingrediente["id"], "cantidad": "100", "unidad": "g"})
    formular(api, headers, producto["id"], *ingredientes)
    assert api.put(f"/gestion/productos/{producto['id']}/costos", headers=headers, json=cuerpo).status_code == 200
    return producto["id"]


def test_el_numero_de_consultas_del_get_y_del_detalle_no_depende_del_numero_de_lineas(api, motor) -> None:
    headers = registrar(api)
    dos = _producto_con_n_lineas(api, headers, 2, "dos")
    ocho = _producto_con_n_lineas(api, headers, 8, "och")
    cantidades: dict[str, list[int]] = {"get": [], "detalle": [], "put": []}

    for producto_id in (dos, ocho):
        with _consultas(motor) as sentencias:
            assert api.get(f"/gestion/productos/{producto_id}/costos", headers=headers).status_code == 200
        cantidades["get"].append(len(sentencias))
        with _consultas(motor) as sentencias:
            detalle = api.get(f"/gestion/productos/{producto_id}", headers=headers)
        esperado = {dos: "52.5000", ocho: "202.5000"}[producto_id]  # (n x $100 + $10 of gas) / 4
        assert detalle.json()["costo_calculado"] == esperado
        cantidades["detalle"].append(len(sentencias))
        with _consultas(motor) as sentencias:
            assert api.put(f"/gestion/productos/{producto_id}/costos", headers=headers, json={"rendimiento": 4}).status_code == 200
        cantidades["put"].append(len(sentencias))

    assert cantidades["get"][0] == cantidades["get"][1]
    assert cantidades["detalle"][0] == cantidades["detalle"][1]
    assert cantidades["put"][0] == cantidades["put"][1]
    # Exact numbers, authentication included (1 query). A product with no finalized elaboración: with one
    # there is one more query (its uses) in each calculation.
    assert cantidades["get"][0] == 8
    assert cantidades["put"][0] == 9
    assert cantidades["detalle"][0] == 13  # +1 since HU11 (T11-03): grouped count of evaluaciones


def test_sin_rendimiento_o_sin_formulacion_el_detalle_no_hace_consultas_de_costos(api, motor) -> None:
    headers = registrar(api)
    completo = _producto_con_n_lineas(api, headers, 2, "dos")
    sin_formular = crear_producto(api, headers, "Sin formular", "sin-001")["id"]
    api.put(f"/gestion/productos/{completo}/costos", headers=headers, json={"rendimiento": None})

    def consultas_de_detalle(producto_id: int) -> int:
        with _consultas(motor) as sentencias:
            assert api.get(f"/gestion/productos/{producto_id}", headers=headers).status_code == 200
        return len(sentencias)

    sin_rendimiento = consultas_de_detalle(completo)
    sin_formulacion = consultas_de_detalle(sin_formular)
    api.put(f"/gestion/productos/{completo}/costos", headers=headers, json={"rendimiento": 4})
    con_rendimiento = consultas_de_detalle(completo)

    assert sin_rendimiento == sin_formulacion == 6  # +1 since HU11 (T11-03): grouped count of evaluaciones
    assert con_rendimiento - sin_rendimiento == 7  # 8 when the product has a finalized elaboración
