"""Thumbnail of the product (HU07): only its address, with the source as attribution, never saved.

Jumbo gives it in the JSON-LD of the sheet (`image`) and, for each hit, in the search; Open Food Facts in
`image_url`. The combined sheet takes Jumbo's first. The address is not part of `ficha`, so the supply
that is registered does not keep it. The values of the fixtures are test values (not recorded).
"""

import pytest

from app.api.dependencies import get_fuente_producto
from app.main import app
from app.services.recuperacion.combinada import FuenteCombinada
from app.services.recuperacion.modelos import url_de_imagen
from tests.test_busqueda_nombre_hu07 import BUSQUEDA, _buscar, _usar_jumbo, escena  # noqa: F401
from tests.test_fuente_combinada_hu07 import OffFalsa, QUILQUE, SLUGS_QUILQUE, _combinada, _jumbo, _leer, _off
from tests.test_origen_insumo_hu07 import _confirmar, _guardado

IMAGEN_JUMBO = "https://imagenes.jumbo.test/quilque-500g-1.jpg"
IMAGEN_OFF = "https://images.openfoodfacts.test/images/quilque.jpg"
RUTA_CONSULTA = "/gestion/insumos/consulta-codigo"


# --- url_de_imagen: solo https y de largo razonable ---


@pytest.mark.parametrize(
    ("valor", "esperada"),
    [
        ("https://a.test/x.jpg", "https://a.test/x.jpg"),
        (["http://a.test/x.jpg", "https://a.test/y.jpg"], "https://a.test/y.jpg"),
        ([{"imageUrl": "https://a.test/z.jpg"}], "https://a.test/z.jpg"),
        ("http://a.test/x.jpg", None),
        ("javascript:alert(1)", None),
        ("data:image/png;base64,AAAA", None),
        ("https://a.test/con espacio.jpg", None),
        ("https://a.test/" + "x" * 600, None),
        ("", None),
        (None, None),
        (123, None),
        ([], None),
    ],
)
def test_url_de_imagen_acepta_solo_https_sensatas(valor, esperada) -> None:
    assert url_de_imagen(valor) == esperada


# --- Jumbo ---


def test_la_ficha_de_jumbo_trae_la_primera_imagen_con_su_fuente() -> None:
    from app.services.recuperacion.modelos import ResultadoBusqueda

    jumbo, _ = _jumbo({SLUGS_QUILQUE[0]: "ficha_quilque_500g.html"})
    producto = jumbo.obtener(ResultadoBusqueda(id=SLUGS_QUILQUE[0], nombre="", marca=None, presentacion=None))
    assert producto.imagen_url == IMAGEN_JUMBO
    assert producto.imagen_fuente == "jumbo"
    # The address is not in the record that the supply keeps.
    assert "image" not in producto.ficha and IMAGEN_JUMBO not in str(producto.ficha)


def test_una_ficha_sin_imagen_no_la_inventa() -> None:
    from app.services.recuperacion.modelos import ResultadoBusqueda

    jumbo, _ = _jumbo({"x": "ficha_hellmanns_630g.html"})
    producto = jumbo.obtener(ResultadoBusqueda(id="x", nombre="", marca=None, presentacion=None))
    assert producto.imagen_url is None and producto.imagen_fuente is None


def test_la_busqueda_trae_la_imagen_de_cada_resultado_si_la_tiene_y_descarta_las_inseguras(api, escena) -> None:
    _usar_jumbo()

    resultados = _buscar(api, escena, "quilque").json()

    assert resultados[0]["imagen_url"] == IMAGEN_JUMBO
    # http:// is dropped; the hit stays, without a picture.
    assert resultados[1]["imagen_url"] is None
    assert resultados[2]["imagen_url"] is None


# --- Open Food Facts y la combinada ---


def test_la_combinada_prioriza_la_imagen_de_jumbo() -> None:
    fuente, _ = _combinada(_off(imagen_url=IMAGEN_OFF, imagen_fuente="open_food_facts"))
    producto = fuente.buscar(QUILQUE)
    assert producto.imagen_url == IMAGEN_JUMBO and producto.imagen_fuente == "jumbo"


def test_si_jumbo_no_tiene_imagen_la_combinada_usa_la_de_open_food_facts() -> None:
    import re

    sin_imagen = re.sub(r'"image": \[[^\]]*\], ', "", _leer("ficha_quilque_500g.html"))
    assert "imagenes.jumbo.test" not in sin_imagen
    jumbo, _ = _jumbo({SLUGS_QUILQUE[0]: sin_imagen})
    fuente = FuenteCombinada(OffFalsa(_off(imagen_url=IMAGEN_OFF, imagen_fuente="open_food_facts")), jumbo)

    producto = fuente.buscar(QUILQUE)

    # Jumbo's sheet was combined (its ingredients), and the picture is OFF's.
    assert producto.fuente == "combinada"
    assert producto.imagen_url == IMAGEN_OFF and producto.imagen_fuente == "open_food_facts"


def test_el_adaptador_de_open_food_facts_lee_image_url() -> None:
    import json
    from pathlib import Path

    import httpx

    from app.core.config import Settings
    from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente

    grabada = json.loads(
        (Path(__file__).parent / "fixtures" / "off" / "7802910000971.json").read_text(encoding="utf-8")
    )
    fuente = OpenFoodFactsFuente(
        Settings(_env_file=None),
        transport=httpx.MockTransport(lambda r: httpx.Response(grabada["http_status"], json=grabada["body"])),
    )

    producto = fuente.buscar("7802910000971")

    assert producto.imagen_url.startswith("https://images.openfoodfacts.test/")
    assert producto.imagen_fuente == "open_food_facts"
    assert "image_url" not in producto.ficha


# --- la API ---


def test_la_consulta_por_codigo_responde_la_imagen_y_su_fuente(api, escena) -> None:
    fuente, _ = _combinada(_off(imagen_url=IMAGEN_OFF, imagen_fuente="open_food_facts"))
    app.dependency_overrides[get_fuente_producto] = lambda: fuente

    cuerpo = api.get(f"{RUTA_CONSULTA}/{QUILQUE}", headers=escena["headers"]).json()

    assert cuerpo["imagen_url"] == IMAGEN_JUMBO
    assert cuerpo["imagen_fuente"] == "jumbo"


def test_la_consulta_por_id_responde_la_imagen_de_jumbo(api, escena) -> None:
    _usar_jumbo({SLUGS_QUILQUE[0]: "ficha_quilque_500g.html"})
    cuerpo = api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}", headers=escena["headers"]).json()
    assert cuerpo["imagen_url"] == IMAGEN_JUMBO and cuerpo["imagen_fuente"] == "jumbo"


def test_sin_imagen_la_respuesta_no_trae_los_campos(api, escena) -> None:
    fuente, _ = _combinada(_off(), jumbo=_jumbo({})[0])
    app.dependency_overrides[get_fuente_producto] = lambda: fuente

    cuerpo = api.get(f"{RUTA_CONSULTA}/{QUILQUE}", headers=escena["headers"]).json()

    assert "imagen_url" not in cuerpo and "imagen_fuente" not in cuerpo


# --- no se guarda ---


def test_el_insumo_registrado_no_guarda_la_imagen(api, fabrica, escena) -> None:
    fuente, _ = _combinada(_off(imagen_url=IMAGEN_OFF, imagen_fuente="open_food_facts"))
    app.dependency_overrides[get_fuente_producto] = lambda: fuente
    consulta = api.get(f"{RUTA_CONSULTA}/{QUILQUE}", headers=escena["headers"]).json()
    assert consulta["imagen_url"]

    respuesta = _confirmar(api, escena, consulta)

    assert respuesta.status_code == 201, respuesta.text
    guardado = _guardado(fabrica, respuesta.json()["id"])
    assert "imagen_url" not in respuesta.json()
    assert IMAGEN_JUMBO not in str(guardado.ficha) and IMAGEN_OFF not in str(guardado.ficha)
    assert "image" not in str(sorted(guardado.ficha))


def test_el_registro_rechaza_imagen_url_si_el_cliente_la_manda(api, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json={
            "ingrediente_id": escena["queso"]["id"],
            "nombre": "Queso",
            "marca_origen": "X",
            "imagen_url": IMAGEN_JUMBO,
        },
    )
    assert respuesta.status_code == 422
