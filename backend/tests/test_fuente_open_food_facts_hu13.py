"""Open Food Facts adapter, with simulated HTTP answers (T13-03 / HU13).

No test here reaches the network: every answer comes from an `httpx.MockTransport`.
"""

import httpx
import pytest

from app.core.config import Settings
from app.services.recuperacion.base import (
    MOTIVO_ERROR_SERVIDOR,
    MOTIVO_LIMITE_DE_USO,
    MOTIVO_RESPUESTA_INVALIDA,
    MOTIVO_SIN_CONEXION,
    MOTIVO_TIMEOUT,
    FuenteNoDisponibleError,
)
from app.services.recuperacion.open_food_facts import CAMPOS, OpenFoodFactsFuente
from tests.sin_red import RedRealBloqueadaError

CODIGO = "7802910000971"


def _settings(**extra) -> Settings:
    return Settings(_env_file=None, **extra)


def _fuente(respuesta, **extra) -> tuple[OpenFoodFactsFuente, list[httpx.Request]]:
    """Adapter whose transport answers with `respuesta` (a function or a ready Response)."""
    peticiones: list[httpx.Request] = []

    def manejar(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        if callable(respuesta):
            return respuesta(request)
        return respuesta

    fuente = OpenFoodFactsFuente(_settings(**extra), transport=httpx.MockTransport(manejar))
    return fuente, peticiones


def _json(cuerpo, status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=cuerpo)


def _encontrado(**producto) -> httpx.Response:
    return _json({"code": CODIGO, "status": 1, "product": producto})


# --- la petición ---


def test_pide_el_producto_con_los_campos_necesarios() -> None:
    fuente, peticiones = _fuente(_encontrado(product_name="Leche"))

    fuente.buscar(CODIGO)

    (peticion,) = peticiones
    assert peticion.method == "GET"
    assert peticion.url.host == "world.openfoodfacts.org"
    assert peticion.url.path == f"/api/v2/product/{CODIGO}.json"
    assert peticion.url.params["fields"] == ",".join(CAMPOS)


def test_se_identifica_con_el_user_agent_de_la_configuracion() -> None:
    fuente, peticiones = _fuente(_encontrado(), off_user_agent="TrazApp/9.9 (prueba)")

    fuente.buscar(CODIGO)

    assert peticiones[0].headers["user-agent"] == "TrazApp/9.9 (prueba)"


def test_el_user_agent_por_defecto_es_valido_y_ascii() -> None:
    # A non-ASCII character in a header value makes httpx fail before sending anything.
    fuente, peticiones = _fuente(_encontrado())

    fuente.buscar(CODIGO)

    agente = peticiones[0].headers["user-agent"]
    assert agente.startswith("TrazApp/")
    assert agente.isascii()


def test_la_espera_maxima_viene_de_la_configuracion() -> None:
    fuente, peticiones = _fuente(_encontrado(), off_timeout_seconds=3.5)

    fuente.buscar(CODIGO)

    espera = peticiones[0].extensions["timeout"]
    assert espera == {"connect": 3.5, "read": 3.5, "write": 3.5, "pool": 3.5}


def test_la_url_base_viene_de_la_configuracion() -> None:
    fuente, peticiones = _fuente(_encontrado(), off_base_url="https://off.ejemplo.test/")

    producto = fuente.buscar(CODIGO)

    assert peticiones[0].url.host == "off.ejemplo.test"
    assert producto is not None
    assert producto.url == f"https://off.ejemplo.test/product/{CODIGO}"


def test_no_envia_credenciales() -> None:
    fuente, peticiones = _fuente(_encontrado())

    fuente.buscar(CODIGO)

    assert "authorization" not in peticiones[0].headers
    assert "cookie" not in peticiones[0].headers


# --- interpretar la respuesta ---


def test_interpreta_un_producto_completo() -> None:
    fuente, _ = _fuente(
        _encontrado(
            product_name="Leche",
            product_name_es="Leche sin lactosa",
            brands="Loncoleche",
            quantity="1 L",
            ingredients_text="Milk",
            ingredients_text_es="Leche descremada, vitaminas",
            allergens_tags=["en:milk"],
            traces_tags=["en:soybeans", "en:nuts"],
            countries_tags=["en:chile"],
            last_modified_t=1700000000,
        )
    )

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert producto.codigo_barras == CODIGO
    assert producto.nombre == "Leche sin lactosa"
    assert producto.marca == "Loncoleche"
    assert producto.presentacion == "1 L"
    assert producto.ingredientes == "Leche descremada, vitaminas"
    assert producto.etiquetas_alergenos == ("en:milk",)
    assert producto.etiquetas_trazas == ("en:soybeans", "en:nuts")


def test_usa_el_nombre_y_los_ingredientes_genericos_si_falta_el_texto_en_espanol() -> None:
    fuente, _ = _fuente(
        _encontrado(product_name="Milk", product_name_es="", ingredients_text="Milk, salt")
    )

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert producto.nombre == "Milk"
    assert producto.ingredientes == "Milk, salt"


def test_con_varias_marcas_se_queda_con_la_primera() -> None:
    fuente, _ = _fuente(_encontrado(brands=" Colun , Nestlé,Soprole"))

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert producto.marca == "Colun"


def test_un_producto_con_campos_faltantes_se_devuelve_con_valores_nulos() -> None:
    fuente, _ = _fuente(_encontrado())

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert producto.nombre is None
    assert producto.marca is None
    assert producto.presentacion is None
    assert producto.ingredientes is None
    assert producto.etiquetas_alergenos == ()
    assert producto.etiquetas_trazas == ()


def test_los_textos_vacios_o_con_otro_tipo_cuentan_como_ausentes() -> None:
    fuente, _ = _fuente(
        _encontrado(
            product_name="   ",
            brands=42,
            quantity=None,
            ingredients_text="",
            allergens_tags="en:milk",
            traces_tags=["en:soybeans", 3, ""],
        )
    )

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert (producto.nombre, producto.marca, producto.presentacion, producto.ingredientes) == (
        None,
        None,
        None,
        None,
    )
    assert producto.etiquetas_alergenos == ()
    assert producto.etiquetas_trazas == ("en:soybeans",)


def test_la_ficha_conserva_solo_el_subconjunto_pedido_y_la_url() -> None:
    fuente, _ = _fuente(
        _encontrado(
            product_name="Leche",
            brands="Colun",
            allergens_tags=["en:milk"],
            image_url="https://imagenes.ejemplo.test/leche.jpg",
            nutriments={"energy": 42},
        )
    )

    producto = fuente.buscar(CODIGO)

    assert producto is not None
    assert producto.ficha == {
        "product_name": "Leche",
        "brands": "Colun",
        "allergens_tags": ["en:milk"],
        "url": f"https://world.openfoodfacts.org/product/{CODIGO}",
    }


def test_producto_no_encontrado_con_estado_cero() -> None:
    fuente, _ = _fuente(_json({"code": CODIGO, "status": 0, "status_verbose": "product not found"}))

    assert fuente.buscar(CODIGO) is None


def test_producto_no_encontrado_con_respuesta_404() -> None:
    fuente, _ = _fuente(_json({"code": CODIGO, "status": 0}, status=404))

    assert fuente.buscar(CODIGO) is None


# --- la fuente no responde ---


def _lanza(error: Exception):
    def manejar(request: httpx.Request) -> httpx.Response:
        raise error

    return manejar


@pytest.mark.parametrize(
    ("error", "motivo"),
    [
        (httpx.ConnectTimeout("lento"), MOTIVO_TIMEOUT),
        (httpx.ReadTimeout("lento"), MOTIVO_TIMEOUT),
        (httpx.PoolTimeout("lento"), MOTIVO_TIMEOUT),
        (httpx.ConnectError("sin red"), MOTIVO_SIN_CONEXION),
        (httpx.ReadError("cortada"), MOTIVO_SIN_CONEXION),
    ],
)
def test_los_fallos_de_red_son_fuente_no_disponible(error, motivo) -> None:
    fuente, _ = _fuente(_lanza(error))

    with pytest.raises(FuenteNoDisponibleError) as excinfo:
        fuente.buscar(CODIGO)

    assert excinfo.value.motivo == motivo


@pytest.mark.parametrize(
    ("status", "motivo"),
    [
        (429, MOTIVO_LIMITE_DE_USO),
        (500, MOTIVO_ERROR_SERVIDOR),
        (502, MOTIVO_ERROR_SERVIDOR),
        (503, MOTIVO_ERROR_SERVIDOR),
        (504, MOTIVO_ERROR_SERVIDOR),
        (403, MOTIVO_RESPUESTA_INVALIDA),
        (301, MOTIVO_RESPUESTA_INVALIDA),
    ],
)
def test_los_estados_http_de_error_son_fuente_no_disponible(status, motivo) -> None:
    fuente, _ = _fuente(httpx.Response(status, text="error"))

    with pytest.raises(FuenteNoDisponibleError) as excinfo:
        fuente.buscar(CODIGO)

    assert excinfo.value.motivo == motivo


@pytest.mark.parametrize(
    "respuesta",
    [
        httpx.Response(200, text="<html>no es json</html>"),
        httpx.Response(200, text=""),
        _json(["no", "es", "un", "objeto"]),
        _json({"code": CODIGO}),
        _json({"code": CODIGO, "status": 1}),
        _json({"code": CODIGO, "status": 1, "product": "texto"}),
    ],
)
def test_una_respuesta_mal_formada_es_fuente_no_disponible(respuesta) -> None:
    fuente, _ = _fuente(respuesta)

    with pytest.raises(FuenteNoDisponibleError) as excinfo:
        fuente.buscar(CODIGO)

    assert excinfo.value.motivo == MOTIVO_RESPUESTA_INVALIDA


def test_el_mensaje_del_error_no_expone_detalles_internos() -> None:
    fuente, _ = _fuente(_lanza(httpx.ConnectError("socket 10.0.0.5:443 refused")))

    with pytest.raises(FuenteNoDisponibleError) as excinfo:
        fuente.buscar(CODIGO)

    assert "10.0.0.5" not in str(excinfo.value)


# --- la guarda de red de las pruebas ---


def test_la_guarda_bloquea_las_peticiones_http_reales() -> None:
    # Without the autouse guard in conftest.py this would try to resolve a real host and fail
    # with a connection error instead.
    fuente = OpenFoodFactsFuente(_settings(off_base_url="http://fuente-externa.invalid"))

    with pytest.raises(RedRealBloqueadaError):
        fuente.buscar(CODIGO)
