"""Jumbo adapter (T07-02 / T07-03, HU07), only with recorded answers: no test reaches the network.

The fixtures in tests/fixtures/jumbo/ were recorded from the real site on 2026-11-05 (see each file).
"""

import json
from pathlib import Path

import httpx
import pytest

from app.core.config import Settings
from app.services.recuperacion.base import (
    MOTIVO_ERROR_SERVIDOR,
    MOTIVO_LIMITE_DE_USO,
    MOTIVO_RESPUESTA_INVALIDA,
    MOTIVO_SIN_CONEXION,
    MOTIVO_TIMEOUT,
    FuenteBusquedaNombre,
    FuenteNoDisponibleError,
)
from app.services.recuperacion.jumbo import JumboFuente
from app.services.recuperacion.modelos import ResultadoBusqueda

FIXTURES = Path(__file__).parent / "fixtures" / "jumbo"


def _leer(nombre: str) -> str:
    return (FIXTURES / nombre).read_text(encoding="utf-8")


def _fuente(respuesta) -> tuple[JumboFuente, list[httpx.Request]]:
    peticiones: list[httpx.Request] = []

    def manejar(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        return respuesta(request) if callable(respuesta) else respuesta

    settings = Settings(_env_file=None)
    return JumboFuente(settings, transport=httpx.MockTransport(manejar)), peticiones


def _html(nombre: str) -> httpx.Response:
    return httpx.Response(200, text=_leer(nombre))


def _json(nombre: str) -> httpx.Response:
    return httpx.Response(200, json=json.loads(_leer(nombre)))


def _resultado(slug: str = "producto-de-prueba") -> ResultadoBusqueda:
    return ResultadoBusqueda(slug, "x", None, None)


def _obtener(nombre_fixture: str, slug: str = "producto-de-prueba"):
    fuente, peticiones = _fuente(_html(nombre_fixture))
    return fuente.obtener(_resultado(slug)), peticiones


def _con_html(html: str):
    fuente, _ = _fuente(httpx.Response(200, text=html))
    return fuente.obtener(_resultado())


# --- diseño (PT07-13) ---


def test_jumbo_es_solo_fuente_de_busqueda_por_nombre() -> None:
    fuente, _ = _fuente(_html("ficha_quilque_500g.html"))
    # Cumple el Protocol (estructural): tiene exactamente sus miembros.
    assert callable(fuente.buscar_por_nombre) and callable(fuente.obtener)
    assert set(FuenteBusquedaNombre.__protocol_attrs__) == {"nombre", "buscar_por_nombre", "obtener"}
    assert not hasattr(fuente, "buscar")
    assert fuente.nombre == "jumbo"


# --- búsqueda (PT07-01) ---


def test_busqueda_devuelve_nombre_marca_presentacion_id_y_url() -> None:
    fuente, peticiones = _fuente(_json("busqueda_queso_mantecoso.json"))

    resultados = fuente.buscar_por_nombre("queso mantecoso")

    quilque = next(r for r in resultados if r.id.startswith("quesomantecoso-quilque-28laminas"))
    assert quilque.nombre == "Queso Mantecoso Quilque Envasado Laminado 500 g"
    assert quilque.marca == "Soprole"
    assert quilque.presentacion == "500 g"
    assert quilque.url == "https://www.jumbo.cl/" + quilque.id + "/p"
    granel = next(r for r in resultados if r.id == "queso-mantecoso-las-parcelas-valdivia-granel")
    assert granel.presentacion == "Granel"
    (peticion,) = peticiones
    assert peticion.method == "POST"
    assert str(peticion.url) == "https://www.jumbo.cl/api/catalog"
    assert json.loads(peticion.content) == {"fullText": "queso mantecoso"}


def test_busqueda_se_identifica_con_user_agent_generico() -> None:
    fuente, peticiones = _fuente(_json("busqueda_quilque.json"))
    fuente.buscar_por_nombre("quilque")
    agente = peticiones[0].headers["user-agent"]
    assert agente.startswith("TrazApp/")
    assert "@" not in agente


def test_busqueda_limita_la_cantidad_de_resultados() -> None:
    fuente, _ = _fuente(_json("busqueda_queso_mantecoso.json"))
    assert 0 < len(fuente.buscar_por_nombre("queso")) <= 10


@pytest.mark.parametrize("texto", ["", "   ", "\n\t"])
def test_texto_vacio_no_consulta(texto: str) -> None:
    fuente, peticiones = _fuente(_json("busqueda_quilque.json"))
    assert fuente.buscar_por_nombre(texto) == []
    assert peticiones == []


def test_busqueda_sin_resultados_devuelve_lista_vacia() -> None:
    fuente, _ = _fuente(_json("busqueda_codigo_barras_sin_resultados.json"))
    assert fuente.buscar_por_nombre("7802900001193") == []


@pytest.mark.parametrize(
    "respuesta",
    [httpx.Response(200, text="<html>no json</html>"), httpx.Response(200, json={"x": 1})],
)
def test_busqueda_con_cuerpo_ilegible_es_respuesta_invalida(respuesta) -> None:
    fuente, _ = _fuente(respuesta)
    with pytest.raises(FuenteNoDisponibleError) as error:
        fuente.buscar_por_nombre("queso")
    assert error.value.motivo == MOTIVO_RESPUESTA_INVALIDA


# --- ficha (PT07-02) ---


def test_ficha_loncoleche_trae_ingredientes_y_trazas() -> None:
    producto, peticiones = _obtener("ficha_loncoleche_capuccino_200ml.html", "leche-loncoleche-x")

    assert producto.fuente == "jumbo"
    assert producto.codigo_barras == "7802910009691"
    assert producto.nombre == "Leche Loncoleche Proteína Capuccino 200 ml"
    assert producto.marca == "Loncoleche"
    assert producto.presentacion == "200 ml"
    assert producto.ingredientes.startswith("leche fluida descremada, concentrado de proteína")
    assert producto.ficha["puede_contener"] == ["soya"]
    assert producto.etiquetas_alergenos == () and producto.etiquetas_trazas == ()
    (peticion,) = peticiones
    assert str(peticion.url) == "https://www.jumbo.cl/leche-loncoleche-x/p"
    assert peticion.url.query == b""


def test_trazas_multiples_se_separan() -> None:
    producto, _ = _obtener("ficha_costa_chips_35g.html")
    assert "leche" in producto.ficha["puede_contener"]
    assert "cereales que contienen gluten" in producto.ficha["puede_contener"]
    assert len(producto.ficha["puede_contener"]) == 11


def test_trazas_leidas_por_el_texto_y_no_por_las_clases() -> None:
    html = (
        _leer("ficha_trencito_150g.html")
        .replace("bg-gray-50 rounded p-3", "otra-clase")
        .replace("text-gray-800", "otra-mas")
    )
    assert _con_html(html).ficha["puede_contener"] == ["nueces", "productos derivados de nueces"]


def test_quilque_sin_bloque_de_trazas_y_libre_de_lactosa_es_solo_informativo() -> None:
    producto, _ = _obtener("ficha_quilque_500g.html")

    assert producto.codigo_barras == "7802900001193"
    assert producto.marca == "Soprole"  # la marca de la ficha
    assert producto.ficha["puede_contener"] == []
    assert producto.ficha["condiciones_alimentarias"] == ["Libre de Lactosa", "Libre de Gluten"]
    # «Libre de lactosa» no quita nada: la leche sigue en los ingredientes que se entregan.
    assert "leche natural parcialmente descremada" in producto.ingredientes
    assert producto.etiquetas_alergenos == ()


def test_hellmanns_sin_bloque_de_trazas() -> None:
    producto, _ = _obtener("ficha_hellmanns_630g.html")
    assert producto.ficha["puede_contener"] == []
    assert "huevo pasteurizado" in producto.ingredientes
    assert producto.marca == "Hellmann's"


def test_oreo_trae_trazas_de_leche() -> None:
    producto, _ = _obtener("ficha_oreo_rollo_108g.html")
    assert producto.ficha["puede_contener"] == ["leche"]


# --- código de barras: combinable o no ---


def test_granel_con_plu_no_es_combinable_ni_se_guarda_como_codigo() -> None:
    producto, _ = _obtener("ficha_granel_parcelas_valdivia.html")

    # El PLU 24927352 incluso pasa el dígito verificador de un EAN-8: lo detiene el «Granel».
    assert producto.ficha["gtin"] == "24927352"
    assert producto.codigo_barras == ""
    assert producto.ficha["combinable"] is False
    assert producto.ingredientes.startswith("leche pasteurizada")


def test_prefijo_de_circulacion_restringida_no_es_combinable_aunque_no_diga_granel() -> None:
    # EAN-13 válido que empieza con 2 (GS1: circulación restringida) en una ficha que no dice «granel».
    html = _leer("ficha_quilque_500g.html").replace("7802900001193", "2000000000008")
    producto = _con_html(html)
    assert producto.codigo_barras == ""
    assert producto.ficha["combinable"] is False


def test_la_palabra_granel_es_solo_respaldo_con_un_codigo_normal() -> None:
    html = _leer("ficha_quilque_500g.html").replace(
        "Queso Mantecoso Quilque Envasado Laminado 500 g", "Queso Mantecoso Quilque Trozo Granel"
    )
    assert _con_html(html).codigo_barras == ""


def test_un_ean_normal_se_conserva() -> None:
    assert _obtener("ficha_hellmanns_630g.html")[0].codigo_barras == "7805000324674"


@pytest.mark.parametrize("gtin", ["40000580294", "7802900001194", "ABC", ""])
def test_gtin_invalido_no_es_combinable(gtin: str) -> None:
    producto = _con_html(_leer("ficha_quilque_500g.html").replace("7802900001193", gtin))
    assert producto.codigo_barras == ""
    assert producto.ficha["combinable"] is False


def test_gtin_valido_con_espacios_se_normaliza() -> None:
    html = _leer("ficha_quilque_500g.html").replace('"7802900001193"', '" 7802 900001193 "')
    assert _con_html(html).codigo_barras == "7802900001193"


# --- sin ingredientes (Doritos) ---


def test_sin_ingredientes_devuelve_la_ficha_con_ingredientes_vacios() -> None:
    # Fixture SINTÉTICO (no grabado): una ficha sin FAQ de ingredientes ni acordeón, como la de Doritos.
    producto, _ = _obtener("ficha_sintetica_sin_ingredientes.html")
    assert producto.ingredientes is None
    assert producto.nombre.startswith("Queso Mantecoso Quilque")


def test_ingredientes_del_acordeon_si_el_faq_no_los_trae() -> None:
    html = _leer("ficha_loncoleche_capuccino_200ml.html")
    bloque = html.split('type="application/ld+json">')[1].split("</script>")[0]
    datos = json.loads(bloque)
    datos[0]["subjectOf"]["mainEntity"] = []
    producto = _con_html(html.replace(bloque, json.dumps(datos, ensure_ascii=False)))
    assert producto.ingredientes.startswith("leche fluida descremada")
    assert not producto.ingredientes.endswith(".")


# --- errores ---


def test_producto_inexistente_404_devuelve_none() -> None:
    fuente, peticiones = _fuente(httpx.Response(404, text="no existe"))
    assert fuente.obtener(_resultado("ya-no-existe")) is None
    assert len(peticiones) == 1  # sin reintentos


def test_trazas_texto_se_llena_ademas_de_la_ficha() -> None:
    producto, _ = _obtener("ficha_costa_chips_35g.html")
    assert producto.trazas_texto == tuple(producto.ficha["puede_contener"])
    assert "leche" in producto.trazas_texto
    sin_bloque, _ = _obtener("ficha_hellmanns_630g.html")
    assert sin_bloque.trazas_texto == ()


@pytest.mark.parametrize(
    ("respuesta", "motivo"),
    [
        (httpx.Response(403, text="prohibido"), MOTIVO_RESPUESTA_INVALIDA),
        (httpx.Response(429), MOTIVO_LIMITE_DE_USO),
        (httpx.Response(503), MOTIVO_ERROR_SERVIDOR),
        (httpx.Response(200, text="<html><body>sin datos</body></html>"), MOTIVO_RESPUESTA_INVALIDA),
        (
            httpx.Response(200, text='<script type="application/ld+json">{no json</script>'),
            MOTIVO_RESPUESTA_INVALIDA,
        ),
    ],
)
def test_ficha_con_error_es_fuente_no_disponible(respuesta, motivo) -> None:
    fuente, _ = _fuente(respuesta)
    with pytest.raises(FuenteNoDisponibleError) as error:
        fuente.obtener(_resultado("x"))
    assert error.value.motivo == motivo


@pytest.mark.parametrize(
    ("excepcion", "motivo"),
    [
        (httpx.ReadTimeout("lento"), MOTIVO_TIMEOUT),
        (httpx.ConnectError("sin red"), MOTIVO_SIN_CONEXION),
    ],
)
def test_timeout_y_conexion_se_traducen(excepcion, motivo) -> None:
    def falla(request: httpx.Request):
        raise excepcion

    fuente, _ = _fuente(falla)
    with pytest.raises(FuenteNoDisponibleError) as error:
        fuente.buscar_por_nombre("queso")
    assert error.value.motivo == motivo
    with pytest.raises(FuenteNoDisponibleError) as error:
        fuente.obtener(_resultado("x"))
    assert error.value.motivo == motivo


def test_el_tiempo_limite_recibido_se_aplica_a_la_peticion() -> None:
    capturado: dict = {}

    def manejar(request: httpx.Request) -> httpx.Response:
        capturado.update(request.extensions["timeout"])
        return _json("busqueda_quilque.json")

    fuente = JumboFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    fuente.buscar_por_nombre("quilque", timeout=2.5)
    assert capturado["read"] == 2.5


@pytest.mark.parametrize("slug", ["../admin", "a/b", "x?y=1", "x#z", "", "http://otro.cl"])
def test_id_de_resultado_inseguro_se_rechaza_sin_consultar(slug: str) -> None:
    fuente, peticiones = _fuente(_html("ficha_quilque_500g.html"))
    with pytest.raises(ValueError):
        fuente.obtener(_resultado(slug))
    assert peticiones == []
