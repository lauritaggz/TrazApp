"""Price and net content from Jumbo and Open Food Facts (HU14 / T14-03, PT14-06).

Only recorded answers: no test reaches the network. Jumbo answers with the fixtures of
tests/fixtures/jumbo and Open Food Facts with those of tests/fixtures/off.
"""

import json
from decimal import Decimal
from pathlib import Path

import httpx
import pytest

from app.api.dependencies import get_fuente_busqueda_nombre, get_fuente_producto
from app.core.config import Settings
from app.main import app
from app.models import Alergeno
from app.services.recuperacion.modelos import ResultadoBusqueda
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente
from tests.escenario_hu05 import crear_ingrediente, registrar
from tests.test_fuente_combinada_hu07 import QUILQUE, SLUGS_QUILQUE, _combinada, _jumbo, _leer, _off
from tests.test_registro_desde_codigo_hu13 import CODIGOS_CATALOGO

OFF = Path(__file__).parent / "fixtures" / "off"
GRANEL = "queso-mantecoso-las-parcelas-valdivia-granel"
QUILQUE_500 = SLUGS_QUILQUE[0]
D = Decimal


def _resultado(slug: str, presentacion: str | None = None) -> ResultadoBusqueda:
    return ResultadoBusqueda(slug, "x", None, presentacion)


def _sheet(slug: str, ficha: str, presentacion: str | None = None):
    jumbo, _ = _jumbo({slug: ficha})
    return jumbo.obtener(_resultado(slug, presentacion))


def _html_sin_contenido() -> str:
    return _leer("ficha_quilque_500g.html").replace('"Contenido Neto"', '"Otra propiedad"')


# --- Jumbo: precio y contenido ---


@pytest.mark.parametrize(
    ("slug", "ficha", "precio", "contenido"),
    [
        (QUILQUE_500, "ficha_quilque_500g.html", D("5900"), (D("500"), "g")),
        ("galletas-con-chips-de-chococolate-costa-35-g", "ficha_costa_chips_35g.html", D("340"), (D("35"), "g")),
        (
            "leche-loncoleche-proteina-200ml-cappuc-1892375",
            "ficha_loncoleche_capuccino_200ml.html",
            D("690"),
            (D("200"), "ml"),
        ),
        ("mayonesa-hellmanns-2054591", "ficha_hellmanns_630g.html", D("2790"), (D("630"), "g")),
    ],
)
def test_jumbo_entrega_el_precio_en_pesos_y_el_contenido_neto(slug, ficha, precio, contenido) -> None:
    producto = _sheet(slug, ficha)

    assert producto.precio == precio
    assert (producto.contenido_cantidad, producto.contenido_unidad) == contenido
    assert producto.contenido_fuente == "jumbo"


def test_el_precio_de_jumbo_es_decimal_y_no_se_guarda_en_la_ficha_cruda() -> None:
    producto = _sheet(QUILQUE_500, "ficha_quilque_500g.html")

    assert isinstance(producto.precio, Decimal)
    # La ficha cruda no cambia: sigue sin precio ni contenido.
    assert set(producto.ficha) == {"url", "slug", "gtin", "combinable", "condiciones_alimentarias", "puede_contener"}


def test_un_producto_a_granel_queda_sin_precio_ni_contenido() -> None:
    # La ficha de granel trae price 1508 (por kilo) y «Contenido Neto: 210 g» (una porción).
    producto = _sheet(GRANEL, "ficha_granel_parcelas_valdivia.html")

    assert producto.precio is None
    assert producto.contenido_cantidad is None
    assert producto.contenido_unidad is None
    assert producto.contenido_fuente is None
    # Lo demás de la ficha se conserva.
    assert producto.nombre.endswith("Granel")
    assert producto.presentacion == "210 g"


def test_un_resultado_de_la_busqueda_marcado_granel_tampoco_tiene_precio_ni_contenido() -> None:
    # measurementUnit "kg" llega como presentación «Granel»; el nombre de la ficha no lo dice.
    producto = _sheet(QUILQUE_500, "ficha_quilque_500g.html", presentacion="Granel")

    assert producto.precio is None
    assert producto.contenido_cantidad is None


def _con_gtin(gtin: str) -> str:
    return _leer("ficha_quilque_500g.html").replace("7802900001193", gtin)


@pytest.mark.parametrize("gtin", ["2000000000008", "24927352"], ids=["ean13_con_2", "plu_ean8"])
def test_un_granel_que_no_dice_granel_se_detecta_por_el_prefijo_de_circulacion_restringida(gtin) -> None:
    # El nombre es «Queso Mantecoso Quilque Envasado Laminado 500 g»: solo el gtin delata que es un PLU.
    producto = _sheet(QUILQUE_500, _con_gtin(gtin))

    assert "granel" not in producto.nombre.lower()
    assert producto.precio is None
    assert producto.contenido_cantidad is None
    assert producto.contenido_fuente is None


@pytest.mark.parametrize("gtin", ["7802900001193", "", "ABC", "7802900001194"], ids=["ean_normal", "vacio", "texto", "dv_malo"])
def test_un_gtin_normal_o_inutilizable_no_hace_pasar_el_producto_por_granel(gtin) -> None:
    producto = _sheet(QUILQUE_500, _con_gtin(gtin))

    assert producto.precio == D("5900")
    assert (producto.contenido_cantidad, producto.contenido_unidad) == (D("500"), "g")


def test_sin_precio_en_los_datos_estructurados_no_hay_precio() -> None:
    html = _leer("ficha_quilque_500g.html").replace('"price": 5900', '"nota": 5900')

    producto = _sheet(QUILQUE_500, html)

    assert producto.precio is None
    assert (producto.contenido_cantidad, producto.contenido_unidad) == (D("500"), "g")


@pytest.mark.parametrize(
    "cambio",
    [
        ('"priceCurrency": "CLP"', '"priceCurrency": "USD"'),
        ('"price": 5900', '"price": 0'),
        ('"price": 5900', '"price": "no es un numero"'),
        ('"price": 5900', '"price": -5'),
    ],
)
def test_un_precio_que_no_es_en_pesos_o_no_es_utilizable_es_none(cambio) -> None:
    html = _leer("ficha_quilque_500g.html").replace(*cambio)

    assert _sheet(QUILQUE_500, html).precio is None


def test_un_contenido_que_el_parser_no_entiende_queda_nulo_sin_afectar_el_precio() -> None:
    html = _leer("ficha_quilque_500g.html").replace('"value": "500 g"', '"value": "Pack surtido"')

    producto = _sheet(QUILQUE_500, html)

    assert producto.precio == D("5900")
    assert producto.contenido_cantidad is None
    assert producto.contenido_fuente is None


# --- Open Food Facts: solo contenido ---


def _off_fuente(archivo: str) -> OpenFoodFactsFuente:
    grabada = json.loads((OFF / archivo).read_text(encoding="utf-8"))
    return OpenFoodFactsFuente(
        Settings(_env_file=None),
        transport=httpx.MockTransport(lambda request: httpx.Response(grabada["http_status"], json=grabada["body"])),
    )


@pytest.mark.parametrize(
    ("archivo", "codigo", "contenido"),
    [
        ("7802910000971.json", "7802910000971", (D("1"), "L")),  # "1L"
        ("7808709504767.json", "7808709504767", (D("1"), "L")),  # "1 Litro"
        ("8445291716841.json", "8445291716841", (D("116"), "g")),  # "116g"
        ("7790272001005.json", "7790272001005", (D("900"), "ml")),
    ],
)
def test_open_food_facts_entrega_solo_el_contenido_nunca_el_precio(archivo, codigo, contenido) -> None:
    producto = _off_fuente(archivo).buscar(codigo)

    assert (producto.contenido_cantidad, producto.contenido_unidad) == contenido
    assert producto.contenido_fuente == "open_food_facts"
    assert producto.precio is None


def test_la_cantidad_de_open_food_facts_se_conserva_en_la_ficha_cruda() -> None:
    producto = _off_fuente("7802910000971.json").buscar("7802910000971")

    assert producto.ficha["quantity"] == "1L"
    assert producto.presentacion == "1L"


# --- combinada: contenido de Jumbo y, si falta, de OFF (PT14-06); precio solo de Jumbo ---


def test_la_combinada_toma_precio_y_contenido_de_jumbo_cuando_los_tiene() -> None:
    off = _off(contenido_cantidad=D("9"), contenido_unidad="kg", contenido_fuente="open_food_facts")
    fuente, _ = _combinada(off)

    producto = fuente.buscar(QUILQUE)

    assert producto.precio == D("5900")
    assert (producto.contenido_cantidad, producto.contenido_unidad, producto.contenido_fuente) == (
        D("500"),
        "g",
        "jumbo",
    )


def test_la_combinada_toma_el_contenido_de_open_food_facts_cuando_jumbo_no_lo_tiene() -> None:
    off = _off(contenido_cantidad=D("1"), contenido_unidad="L", contenido_fuente="open_food_facts")
    jumbo, _ = _jumbo({QUILQUE_500: _html_sin_contenido()})
    fuente, _ = _combinada(off, jumbo)

    producto = fuente.buscar(QUILQUE)

    assert producto.precio == D("5900")
    assert (producto.contenido_cantidad, producto.contenido_unidad, producto.contenido_fuente) == (
        D("1"),
        "L",
        "open_food_facts",
    )


def test_la_combinada_sin_contenido_en_ninguna_fuente_deja_solo_el_precio() -> None:
    jumbo, _ = _jumbo({QUILQUE_500: _html_sin_contenido()})
    fuente, _ = _combinada(_off(), jumbo)

    producto = fuente.buscar(QUILQUE)

    assert producto.precio == D("5900")
    assert producto.contenido_cantidad is None


def test_la_combinada_sin_ficha_de_jumbo_conserva_el_contenido_de_off_y_no_inventa_precio() -> None:
    off = _off(contenido_cantidad=D("500"), contenido_unidad="g", contenido_fuente="open_food_facts")
    jumbo, _ = _jumbo({})
    fuente, _ = _combinada(off, jumbo)

    producto = fuente.buscar(QUILQUE)

    assert producto.precio is None
    assert (producto.contenido_cantidad, producto.contenido_fuente) == (D("500"), "open_food_facts")


# --- respuestas de consulta por código y por nombre: campos nuevos, opcionales y aditivos ---


@pytest.fixture
def escena(api, fabrica) -> dict:
    headers = registrar(api)
    with fabrica() as sesion:
        sesion.add_all(Alergeno(codigo=c, nombre=c.capitalize(), obligatorio_chile=False) for c in CODIGOS_CATALOGO)
        sesion.commit()
    return {"headers": headers, "queso": crear_ingrediente(api, headers, "Queso", "que-001")}


def test_la_consulta_por_nombre_propone_precio_y_contenido_con_su_fuente(api, escena) -> None:
    jumbo, _ = _jumbo()
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo

    respuesta = api.get(f"/gestion/insumos/busqueda/{QUILQUE_500}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["costos"] == {
        "precio_referencia": "5900.00",
        "precio_fuente": "jumbo",
        "contenido_cantidad": "500.000",
        "contenido_unidad": "g",
        "contenido_fuente": "jumbo",
    }
    # Lo que HU07 ya entregaba no cambia.
    assert cuerpo["fuentes_campos"]["ingredientes_declarados"] == "jumbo"
    assert set(cuerpo["fuentes_campos"].values()) == {"jumbo"}
    assert "precio" not in cuerpo["ficha"] and "price" not in cuerpo["ficha"]


def test_la_consulta_de_un_granel_no_trae_costos(api, escena) -> None:
    jumbo, _ = _jumbo({GRANEL: "ficha_granel_parcelas_valdivia.html"})
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo

    respuesta = api.get(f"/gestion/insumos/busqueda/{GRANEL}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    assert "costos" not in respuesta.json()


def test_la_consulta_de_un_granel_sin_la_palabra_granel_no_trae_costos(api, escena) -> None:
    jumbo, _ = _jumbo({QUILQUE_500: _leer("ficha_quilque_500g.html").replace("7802900001193", "2000000000008")})
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo

    respuesta = api.get(f"/gestion/insumos/busqueda/{QUILQUE_500}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    assert "costos" not in respuesta.json()


def test_la_consulta_por_codigo_propone_el_contenido_de_off_sin_precio(api, escena) -> None:
    jumbo, _ = _jumbo({})
    off = _off(contenido_cantidad=D("1"), contenido_unidad="L", contenido_fuente="open_food_facts")
    fuente, _ = _combinada(off, jumbo)
    app.dependency_overrides[get_fuente_producto] = lambda: fuente

    respuesta = api.get(f"/gestion/insumos/consulta-codigo/{QUILQUE}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["costos"] == {
        "contenido_cantidad": "1",
        "contenido_unidad": "L",
        "contenido_fuente": "open_food_facts",
        "precio_referencia": None,
        "precio_fuente": None,
    }
