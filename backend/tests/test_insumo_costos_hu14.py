"""Reference price and net content of a supply, and "Actualizar precio desde Jumbo" (HU14 / T14-03).

Through the real API, with a session per request (what the request commits is what the next one sees).
Jumbo answers with recorded fixtures: no test reaches the network.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

import httpx
import pytest

from app.api.dependencies import get_fuente_busqueda_nombre
from app.main import app
from tests.escenario_hu05 import PRODUCTOR_A, PRODUCTOR_B, crear_ingrediente, registrar
from tests.test_fuente_combinada_hu07 import SLUGS_QUILQUE, _jumbo, _leer

QUILQUE_500 = SLUGS_QUILQUE[0]
GRANEL = "queso-mantecoso-las-parcelas-valdivia-granel"
INSUMOS = "/gestion/insumos"
RECUPERACION = datetime(2026, 11, 1, 15, 30, tzinfo=timezone.utc)


@pytest.fixture
def ana(api) -> dict[str, str]:
    return registrar(api, PRODUCTOR_A)


@pytest.fixture
def beto(api, ana) -> dict[str, str]:
    return registrar(api, PRODUCTOR_B)


@pytest.fixture
def queso(api, ana) -> int:
    return crear_ingrediente(api, ana, "Queso", "que-001")["id"]


def _cuerpo(ingrediente_id: int, **extra) -> dict:
    return {
        "ingrediente_id": ingrediente_id,
        "nombre": "Queso mantecoso Quilque 500 g",
        "marca_origen": "Soprole",
        **extra,
    }


def _crear(api, headers, ingrediente_id: int, **extra) -> dict:
    respuesta = api.post(INSUMOS, headers=headers, json=_cuerpo(ingrediente_id, **extra))
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def _leer_insumo(api, headers, insumo_id: int) -> dict:
    respuesta = api.get(f"{INSUMOS}/{insumo_id}", headers=headers)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _fecha(texto: str) -> datetime:
    fecha = datetime.fromisoformat(texto)
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


def _es_reciente(texto: str) -> bool:
    return abs(datetime.now(timezone.utc) - _fecha(texto)) < timedelta(minutes=1)


def _desde_busqueda(**extra) -> dict:
    """What the form sends when the productor confirms the proposal of a Jumbo sheet, untouched."""
    return {
        "fuente": "jumbo",
        "fecha_recuperacion": RECUPERACION.isoformat(),
        "ficha": {"slug": QUILQUE_500, "url": f"https://www.jumbo.cl/{QUILQUE_500}/p"},
        "fuentes_campos": {
            "nombre": "jumbo",
            "marca_origen": "jumbo",
            "precio_referencia": "jumbo",
            "contenido": "jumbo",
        },
        "precio_referencia": "5900",
        "contenido_cantidad": "500",
        "contenido_unidad": "g",
        **extra,
    }


# --- crear ---


def test_un_insumo_nuevo_sin_precio_ni_contenido_los_expone_nulos(api, ana, queso) -> None:
    creado = _crear(api, ana, queso)

    for campo in (
        "precio_referencia",
        "precio_fuente",
        "precio_fecha",
        "contenido_cantidad",
        "contenido_unidad",
        "contenido_fuente",
    ):
        assert creado[campo] is None


def test_crear_manual_deja_la_fuente_manual_con_la_fecha_de_hoy(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, precio_referencia="1990.50", contenido_cantidad="1.5", contenido_unidad="kg")

    leido = _leer_insumo(api, ana, creado["id"])
    assert Decimal(leido["precio_referencia"]) == Decimal("1990.50")
    assert leido["precio_fuente"] == "manual"
    assert _es_reciente(leido["precio_fecha"])
    assert (Decimal(leido["contenido_cantidad"]), leido["contenido_unidad"]) == (Decimal("1.5"), "kg")
    assert leido["contenido_fuente"] == "manual"


def test_crear_desde_una_busqueda_conserva_la_fuente_jumbo_y_la_fecha_de_recuperacion(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    leido = _leer_insumo(api, ana, creado["id"])
    assert Decimal(leido["precio_referencia"]) == Decimal("5900")
    assert leido["precio_fuente"] == "jumbo"
    assert _fecha(leido["precio_fecha"]) == RECUPERACION
    assert (Decimal(leido["contenido_cantidad"]), leido["contenido_unidad"]) == (Decimal("500"), "g")
    assert leido["contenido_fuente"] == "jumbo"
    # El origen de los demás campos (HU07) no cambia ni se mezcla con el de los costos.
    assert leido["ficha"]["fuentes"] == [
        {"fuente": "jumbo", "fecha": RECUPERACION.isoformat(), "campos": ["nombre", "marca_origen"]}
    ]


def test_crear_con_el_contenido_de_open_food_facts_conserva_esa_fuente(api, ana, queso) -> None:
    cuerpo = _desde_busqueda(precio_referencia=None)
    cuerpo["fuentes_campos"] = {"nombre": "open_food_facts", "contenido": "open_food_facts"}
    cuerpo["fuente"] = "combinada"
    cuerpo["contenido_cantidad"], cuerpo["contenido_unidad"] = "1", "L"

    creado = _crear(api, ana, queso, **cuerpo)

    assert creado["contenido_fuente"] == "open_food_facts"
    assert creado["precio_referencia"] is None and creado["precio_fuente"] is None


def test_crear_con_un_valor_editado_antes_de_confirmar_lo_pasa_a_manual(api, ana, queso) -> None:
    creado = _crear(
        api,
        ana,
        queso,
        **_desde_busqueda(precio_referencia="6200", campos_editados=["precio_referencia"]),
    )

    assert Decimal(creado["precio_referencia"]) == Decimal("6200")
    assert creado["precio_fuente"] == "manual"
    assert _es_reciente(creado["precio_fecha"])
    # El contenido no se tocó: conserva su fuente.
    assert creado["contenido_fuente"] == "jumbo"


def test_crear_con_el_contenido_editado_lo_pasa_a_manual_y_deja_el_precio_de_jumbo(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda(contenido_cantidad="450", campos_editados=["contenido"]))

    assert creado["contenido_fuente"] == "manual"
    assert creado["precio_fuente"] == "jumbo"
    assert _fecha(creado["precio_fecha"]) == RECUPERACION


def test_crear_sin_fuentes_campos_no_puede_declararse_externo(api, ana, queso) -> None:
    cuerpo = _desde_busqueda()
    del cuerpo["fuentes_campos"]

    creado = _crear(api, ana, queso, **cuerpo)

    assert creado["precio_fuente"] == "manual"
    assert creado["contenido_fuente"] == "manual"


@pytest.mark.parametrize(
    "extra",
    [
        {"precio_fuente": "jumbo"},
        {"precio_fecha": "2026-11-01T00:00:00+00:00"},
        {"contenido_fuente": "jumbo"},
        {"precio_referencia": "100", "precio_fuente": "manual", "precio_fecha": "2026-11-01T00:00:00+00:00"},
    ],
)
def test_el_cliente_no_puede_enviar_la_fuente_ni_la_fecha_de_los_costos(api, ana, queso, extra) -> None:
    respuesta = api.post(INSUMOS, headers=ana, json=_cuerpo(queso, **extra))

    assert respuesta.status_code == 422


@pytest.mark.parametrize(
    "extra",
    [
        {"precio_referencia": "-1"},
        {"precio_referencia": "100.123"},
        {"contenido_cantidad": "0", "contenido_unidad": "g"},
        {"contenido_cantidad": "-2", "contenido_unidad": "g"},
        {"contenido_cantidad": "1"},
        {"contenido_unidad": "kg"},
        {"contenido_cantidad": "1", "contenido_unidad": "litro"},
        {"precio_referencia": "100", "fuente": "open_food_facts", "fecha_recuperacion": RECUPERACION.isoformat(),
         "fuentes_campos": {"precio_referencia": "open_food_facts"}},
    ],
)
def test_crear_con_precio_o_contenido_invalido_responde_422(api, ana, queso, extra) -> None:
    respuesta = api.post(INSUMOS, headers=ana, json=_cuerpo(queso, **extra))

    assert respuesta.status_code == 422


# --- editar (PT14-07, parte API) ---


def test_editar_el_precio_pasa_la_fuente_a_manual_con_la_fecha_del_cambio(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    respuesta = api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"precio_referencia": "6500"})

    assert respuesta.status_code == 200, respuesta.text
    leido = _leer_insumo(api, ana, creado["id"])
    assert Decimal(leido["precio_referencia"]) == Decimal("6500")
    assert leido["precio_fuente"] == "manual"
    assert _es_reciente(leido["precio_fecha"])
    assert _fecha(leido["precio_fecha"]) > RECUPERACION
    # El contenido no cambió, así que conserva su fuente.
    assert leido["contenido_fuente"] == "jumbo"


def test_enviar_el_mismo_precio_no_cambia_su_fuente_ni_su_fecha(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"precio_referencia": "5900.00"})

    leido = _leer_insumo(api, ana, creado["id"])
    assert leido["precio_fuente"] == "jumbo"
    assert _fecha(leido["precio_fecha"]) == RECUPERACION


def test_borrar_el_precio_limpia_su_fuente_y_su_fecha(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    respuesta = api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"precio_referencia": None})

    assert respuesta.status_code == 200, respuesta.text
    leido = _leer_insumo(api, ana, creado["id"])
    assert leido["precio_referencia"] is None
    assert leido["precio_fuente"] is None
    assert leido["precio_fecha"] is None
    assert leido["contenido_fuente"] == "jumbo"


def test_un_precio_de_cero_es_valido(api, ana, queso) -> None:
    creado = _crear(api, ana, queso)

    respuesta = api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"precio_referencia": "0"})

    assert respuesta.status_code == 200, respuesta.text
    assert Decimal(respuesta.json()["precio_referencia"]) == 0
    assert respuesta.json()["precio_fuente"] == "manual"


def test_editar_el_contenido_lo_pasa_a_manual(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"contenido_cantidad": "1", "contenido_unidad": "kg"})

    leido = _leer_insumo(api, ana, creado["id"])
    assert (Decimal(leido["contenido_cantidad"]), leido["contenido_unidad"]) == (Decimal("1"), "kg")
    assert leido["contenido_fuente"] == "manual"
    assert leido["precio_fuente"] == "jumbo"


def test_cambiar_solo_la_unidad_del_contenido_es_un_cambio_manual(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"contenido_unidad": "kg"})

    leido = _leer_insumo(api, ana, creado["id"])
    assert (Decimal(leido["contenido_cantidad"]), leido["contenido_unidad"]) == (Decimal("500"), "kg")
    assert leido["contenido_fuente"] == "manual"


def test_enviar_el_mismo_contenido_no_cambia_su_fuente(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"contenido_cantidad": "500.000", "contenido_unidad": "g"})

    assert _leer_insumo(api, ana, creado["id"])["contenido_fuente"] == "jumbo"


def test_borrar_el_contenido_limpia_cantidad_unidad_y_fuente(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    respuesta = api.patch(
        f"{INSUMOS}/{creado['id']}", headers=ana, json={"contenido_cantidad": None, "contenido_unidad": None}
    )

    assert respuesta.status_code == 200, respuesta.text
    leido = _leer_insumo(api, ana, creado["id"])
    assert (leido["contenido_cantidad"], leido["contenido_unidad"], leido["contenido_fuente"]) == (None, None, None)
    assert leido["precio_fuente"] == "jumbo"


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"contenido_cantidad": None},
        {"contenido_unidad": None},
        {"contenido_cantidad": "2", "contenido_unidad": None},
    ],
)
def test_dejar_el_contenido_a_medias_responde_422_y_no_cambia_nada(api, ana, queso, cuerpo) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    respuesta = api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json=cuerpo)

    assert respuesta.status_code == 422
    assert _leer_insumo(api, ana, creado["id"]) == creado


@pytest.mark.parametrize(
    "cuerpo",
    [
        {"precio_fuente": "manual"},
        {"precio_fecha": "2026-11-01T00:00:00+00:00"},
        {"contenido_fuente": "manual"},
        {"precio_referencia": "100", "precio_fuente": "jumbo"},
    ],
)
def test_enviar_la_fuente_o_la_fecha_al_editar_responde_422(api, ana, queso, cuerpo) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    respuesta = api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json=cuerpo)

    assert respuesta.status_code == 422
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_editar_otros_campos_no_toca_el_precio_ni_el_contenido(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    api.patch(f"{INSUMOS}/{creado['id']}", headers=ana, json={"nombre": "Queso Quilque"})

    leido = _leer_insumo(api, ana, creado["id"])
    for campo in ("precio_referencia", "precio_fuente", "precio_fecha", "contenido_cantidad", "contenido_fuente"):
        assert leido[campo] == creado[campo]


def test_el_listado_expone_el_precio_y_el_contenido(api, ana, queso) -> None:
    creado = _crear(api, ana, queso, **_desde_busqueda())

    (fila,) = api.get(INSUMOS, headers=ana).json()

    assert fila["id"] == creado["id"]
    assert Decimal(fila["precio_referencia"]) == Decimal("5900")
    assert fila["precio_fuente"] == "jumbo"


# --- POST /gestion/insumos/{id}/actualizar-precio ---


def _actualizar(api, headers, insumo_id: int):
    return api.post(f"{INSUMOS}/{insumo_id}/actualizar-precio", headers=headers)


def _usar_jumbo(fichas=None, falla=None):
    jumbo, peticiones = _jumbo(fichas, falla=falla)
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo
    return peticiones


def _con_ficha(api, headers, ingrediente_id: int, ficha: dict | None, **extra) -> dict:
    return _crear(api, headers, ingrediente_id, ficha=ficha, **extra)


def test_actualizar_el_precio_desde_jumbo_con_exito(api, ana, queso) -> None:
    creado = _con_ficha(
        api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000", contenido_cantidad="1", contenido_unidad="kg"
    )
    peticiones = _usar_jumbo()

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert Decimal(cuerpo["precio_referencia"]) == Decimal("5900")
    assert cuerpo["precio_fuente"] == "jumbo"
    assert _es_reciente(cuerpo["precio_fecha"])
    assert (Decimal(cuerpo["contenido_cantidad"]), cuerpo["contenido_unidad"], cuerpo["contenido_fuente"]) == (
        Decimal("500"),
        "g",
        "jumbo",
    )
    assert _leer_insumo(api, ana, creado["id"]) == cuerpo
    # Exactamente una consulta a Jumbo: la ficha del producto, sin búsqueda.
    assert len(peticiones) == 1
    assert peticiones[0].method == "GET"
    assert peticiones[0].url.path == f"/{QUILQUE_500}/p"
    assert peticiones[0].url.query == b""


def test_actualizar_sobrescribe_un_precio_manual(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="123")
    assert creado["precio_fuente"] == "manual"
    _usar_jumbo()

    cuerpo = _actualizar(api, ana, creado["id"]).json()

    assert Decimal(cuerpo["precio_referencia"]) == Decimal("5900")
    assert cuerpo["precio_fuente"] == "jumbo"


def test_actualizar_reconoce_el_slug_de_una_ficha_combinada(api, ana, queso) -> None:
    ficha = {"product_name": "Queso", "jumbo": {"slug": QUILQUE_500, "url": "https://www.jumbo.cl/x/p"}}
    creado = _con_ficha(api, ana, queso, ficha)
    peticiones = _usar_jumbo()

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 200, respuesta.text
    assert len(peticiones) == 1


def test_si_jumbo_no_trae_contenido_se_actualiza_el_precio_y_se_conserva_el_contenido(api, ana, queso) -> None:
    creado = _con_ficha(
        api, ana, queso, {"slug": QUILQUE_500}, contenido_cantidad="2", contenido_unidad="kg"
    )
    _usar_jumbo({QUILQUE_500: _leer("ficha_quilque_500g.html").replace('"Contenido Neto"', '"Otra"')})

    cuerpo = _actualizar(api, ana, creado["id"]).json()

    assert Decimal(cuerpo["precio_referencia"]) == Decimal("5900")
    assert (Decimal(cuerpo["contenido_cantidad"]), cuerpo["contenido_unidad"], cuerpo["contenido_fuente"]) == (
        Decimal("2"),
        "kg",
        "manual",
    )


@pytest.mark.parametrize(
    "ficha",
    [None, {}, {"url": "https://off.test/product/1", "quantity": "500 g"}, {"jumbo": {}}, {"slug": ""}, {"slug": 7}],
)
def test_sin_slug_de_jumbo_responde_409_sin_consultar_ni_cambiar_nada(api, ana, queso, ficha) -> None:
    creado = _con_ficha(api, ana, queso, ficha, precio_referencia="4000")
    peticiones = _usar_jumbo()

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"]["mensaje"]
    assert peticiones == []
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_un_slug_invalido_en_la_ficha_responde_409_sin_consultar(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": "../../admin"}, precio_referencia="4000")
    peticiones = _usar_jumbo()

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert peticiones == []
    assert _leer_insumo(api, ana, creado["id"]) == creado


@pytest.mark.parametrize(
    "falla",
    [httpx.ConnectError("sin red"), httpx.ReadTimeout("lento")],
    ids=["sin_conexion", "timeout"],
)
def test_si_jumbo_falla_responde_409_y_la_base_no_cambia(api, ana, queso, falla) -> None:
    creado = _con_ficha(
        api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000", contenido_cantidad="1", contenido_unidad="kg"
    )
    peticiones = _usar_jumbo(falla=falla)

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    detalle = respuesta.json()["detail"]
    assert detalle["mensaje"]
    assert detalle["motivo"] in {"sin_conexion", "timeout"}
    assert len(peticiones) == 1
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_si_jumbo_responde_error_del_servidor_responde_409_sin_cambios(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000")
    jumbo = _jumbo()[0]
    jumbo._transport = httpx.MockTransport(lambda request: httpx.Response(503))
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"]["motivo"] == "error_servidor"
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_si_el_producto_ya_no_esta_en_jumbo_responde_409_sin_cambios(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": "producto-retirado"}, precio_referencia="4000")
    _usar_jumbo()

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_si_jumbo_no_trae_precio_responde_409_sin_cambios(api, ana, queso) -> None:
    creado = _con_ficha(
        api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000", contenido_cantidad="1", contenido_unidad="kg"
    )
    _usar_jumbo({QUILQUE_500: _leer("ficha_quilque_500g.html").replace('"price": 5900', '"nota": 5900')})

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert "precio" in respuesta.json()["detail"]["mensaje"]
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_un_producto_a_granel_responde_409_sin_cambios(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": GRANEL}, precio_referencia="4000")
    _usar_jumbo({GRANEL: "ficha_granel_parcelas_valdivia.html"})

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert "granel" in respuesta.json()["detail"]["mensaje"]
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_un_granel_que_no_dice_granel_se_detecta_por_el_gtin_y_responde_409_sin_cambios(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000")
    _usar_jumbo({QUILQUE_500: _leer("ficha_quilque_500g.html").replace("7802900001193", "2000000000008")})

    respuesta = _actualizar(api, ana, creado["id"])

    assert respuesta.status_code == 409
    assert "granel" in respuesta.json()["detail"]["mensaje"]
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_el_insumo_de_otro_productor_responde_404_sin_consultar_a_jumbo(api, ana, beto, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": QUILQUE_500}, precio_referencia="4000")
    peticiones = _usar_jumbo()

    respuesta = _actualizar(api, beto, creado["id"])

    assert respuesta.status_code == 404
    assert peticiones == []
    assert _leer_insumo(api, ana, creado["id"]) == creado


def test_un_insumo_inexistente_responde_404(api, ana) -> None:
    peticiones = _usar_jumbo()

    assert _actualizar(api, ana, 99999).status_code == 404
    assert peticiones == []


def test_actualizar_el_precio_exige_autenticacion(api, ana, queso) -> None:
    creado = _con_ficha(api, ana, queso, {"slug": QUILQUE_500})
    peticiones = _usar_jumbo()

    assert api.post(f"{INSUMOS}/{creado['id']}/actualizar-precio").status_code == 401
    assert peticiones == []
