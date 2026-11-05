"""Combined source and allergen union (T07-04, HU07): Open Food Facts by barcode + Jumbo by name.

No test reaches the network: Open Food Facts is a fake source and Jumbo answers with the recorded
fixtures of tests/fixtures/jumbo/ through an `httpx.MockTransport`.
"""

import json
from dataclasses import replace
from pathlib import Path

import httpx
import pytest

from app.api.dependencies import get_fuente_producto
from app.core.config import Settings
from app.main import app
from app.models import Alergeno
from app.services.recuperacion.alergenos import detectar_alergenos
from app.services.recuperacion.base import (
    MOTIVO_ERROR_SERVIDOR,
    FuenteNoDisponibleError,
)
from app.services.recuperacion.combinacion import combinar_alergenos
from app.services.recuperacion.combinada import FuenteCombinada
from app.services.recuperacion.jumbo import JumboFuente
from app.services.recuperacion.modelos import ProductoFuente

FIXTURES = Path(__file__).parent / "fixtures" / "jumbo"
QUILQUE = "7802900001193"
SLUGS_QUILQUE = [
    "quesomantecoso-quilque-28laminasenvaseresellablealvacio500grs-2",
    "queso-mantecoso-quilque-250-g-2",
    "queso-mantecoso-sandwich-laminado-quilque-416-g",
    "queso-mantecoso-quilque-granel-2",
]


def _leer(nombre: str) -> str:
    return (FIXTURES / nombre).read_text(encoding="utf-8")


class OffFalsa:
    """Open Food Facts stand-in: answers what the test says, optionally spending time."""

    nombre = "open_food_facts"

    def __init__(self, resultado, reloj=None, gasto: float = 0.0, error=None) -> None:
        self.resultado, self.reloj, self.gasto, self.error = resultado, reloj, gasto, error
        self.llamadas: list[tuple[str, float | None]] = []

    def buscar(self, codigo_barras: str, timeout: float | None = None):
        self.llamadas.append((codigo_barras, timeout))
        if self.reloj is not None:
            self.reloj.avanzar(self.gasto)
        if self.error is not None:
            raise self.error
        return self.resultado


class Reloj:
    def __init__(self) -> None:
        self.t = 0.0

    def __call__(self) -> float:
        return self.t

    def avanzar(self, segundos: float) -> None:
        self.t += segundos


def _off(**extra) -> ProductoFuente:
    datos = {
        "codigo_barras": QUILQUE,
        "nombre": "Queso mantecoso Quilque",
        "marca": "Soprole",
        "presentacion": "500 g",
        "ingredientes": "Leche, sal, cuajo",
        "url": "https://off.test/product/" + QUILQUE,
        "ficha": {"product_name": "Queso mantecoso Quilque", "url": "https://off.test/product/1"},
        **extra,
    }
    return ProductoFuente(**datos)


def _jumbo(fichas: dict[str, str] | None = None, busqueda: str = "busqueda_quilque.json", falla=None):
    """JumboFuente over recorded answers. `fichas` maps a slug to a ficha fixture (else 404)."""
    fichas = fichas if fichas is not None else {SLUGS_QUILQUE[0]: "ficha_quilque_500g.html"}
    peticiones: list[httpx.Request] = []

    def manejar(request: httpx.Request) -> httpx.Response:
        peticiones.append(request)
        if falla is not None:
            raise falla
        if request.method == "POST":
            return httpx.Response(200, text=_leer(busqueda), headers={"content-type": "application/json"})
        slug = request.url.path.strip("/").removesuffix("/p")
        if slug in fichas:
            ficha = fichas[slug]
            # A value is a fixture name or, when it is HTML already, the page itself.
            return httpx.Response(200, text=ficha if ficha.lstrip().startswith("<") else _leer(ficha))
        return httpx.Response(404)

    jumbo = JumboFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    return jumbo, peticiones


def _combinada(off_producto, jumbo=None, reloj=None, gasto: float = 0.0, **extra):
    jumbo = jumbo or _jumbo()[0]
    reloj = reloj or Reloj()
    off = OffFalsa(off_producto, reloj, gasto)
    return FuenteCombinada(off, jumbo, reloj=reloj, **extra), off


# --- PT07-03: combina y registra la fuente de cada campo ---


def test_combina_con_jumbo_cuando_el_gtin_coincide_e_indica_la_fuente_de_cada_campo() -> None:
    jumbo, peticiones = _jumbo()
    fuente, _ = _combinada(_off(), jumbo)

    producto = fuente.buscar(QUILQUE)

    assert producto.fuente == "combinada"
    assert producto.codigo_barras == QUILQUE
    # Ingredientes de Jumbo; nombre, marca y presentación de Open Food Facts.
    assert producto.ingredientes.startswith("leche natural parcialmente descremada")
    assert producto.nombre == "Queso mantecoso Quilque"
    assert producto.marca == "Soprole"
    assert producto.presentacion == "500 g"
    assert producto.fuentes_campos == {
        "nombre": "open_food_facts",
        "marca_origen": "open_food_facts",
        "presentacion": "open_food_facts",
        "ingredientes_declarados": "jumbo",
    }
    assert producto.fuentes_sin_respuesta == ()
    # La ficha conserva la de Open Food Facts y suma la de Jumbo (con "Libre de…", solo informativo).
    assert producto.ficha["product_name"] == "Queso mantecoso Quilque"
    assert producto.ficha["jumbo"]["condiciones_alimentarias"] == ["Libre de Lactosa", "Libre de Gluten"]
    assert producto.url == "https://off.test/product/" + QUILQUE
    assert peticiones[0].method == "POST"
    assert json.loads(peticiones[0].content) == {"fullText": "Queso mantecoso Quilque Soprole"}


def test_sin_marca_en_open_food_facts_busca_solo_por_nombre_y_toma_la_marca_de_jumbo() -> None:
    jumbo, peticiones = _jumbo()
    fuente, _ = _combinada(_off(marca=None), jumbo)

    producto = fuente.buscar(QUILQUE)

    assert json.loads(peticiones[0].content) == {"fullText": "Queso mantecoso Quilque"}
    assert producto.marca == "Soprole"
    assert producto.fuentes_campos["marca_origen"] == "jumbo"


def test_los_campos_vacios_de_off_se_completan_con_jumbo_y_ingredientes_de_off_si_jumbo_no_tiene() -> None:
    fuente, _ = _combinada(_off(presentacion=None, nombre="Quilque", ingredientes="Leche"))
    producto = fuente.buscar(QUILQUE)
    assert producto.presentacion == "500 g"
    assert producto.fuentes_campos["presentacion"] == "jumbo"

    sin_ingredientes, _ = _combinada(
        _off(), _jumbo({SLUGS_QUILQUE[0]: "ficha_sintetica_sin_ingredientes.html"})[0]
    )
    # La ficha sintética tiene otro nombre pero el mismo gtin; sin ingredientes en Jumbo, vale OFF.
    producto = sin_ingredientes.buscar(QUILQUE)
    assert producto.ingredientes == "Leche, sal, cuajo"
    assert producto.fuentes_campos["ingredientes_declarados"] == "open_food_facts"


def test_el_upc_a_de_off_coincide_con_el_gtin_de_13_digitos_de_jumbo() -> None:
    upc, ean = "036000291452", "0036000291452"
    jumbo, _ = _jumbo({SLUGS_QUILQUE[0]: _leer("ficha_quilque_500g.html").replace(QUILQUE, ean)})
    fuente, _ = _combinada(_off(codigo_barras=upc), jumbo)
    assert fuente.buscar(upc).fuente == "combinada"


# --- PT07-04: el gtin manda ---


def test_no_combina_si_ningun_candidato_tiene_el_mismo_gtin() -> None:
    jumbo, peticiones = _jumbo({slug: "ficha_hellmanns_630g.html" for slug in SLUGS_QUILQUE})
    fuente, _ = _combinada(_off(), jumbo)

    producto = fuente.buscar(QUILQUE)

    assert producto.fuente == "open_food_facts"
    assert producto.ingredientes == "Leche, sal, cuajo"
    assert producto.trazas_texto == ()
    assert "jumbo" not in producto.ficha
    assert producto.fuentes_sin_respuesta == ()  # Jumbo respondió: simplemente no era el mismo producto
    assert set(producto.fuentes_campos.values()) == {"open_food_facts"}


def test_prueba_hasta_tres_candidatos_y_combina_con_el_primero_que_coincide() -> None:
    fichas = {
        SLUGS_QUILQUE[0]: "ficha_hellmanns_630g.html",
        SLUGS_QUILQUE[1]: "ficha_oreo_rollo_108g.html",
        SLUGS_QUILQUE[2]: "ficha_quilque_500g.html",
    }
    jumbo, peticiones = _jumbo(fichas)
    producto = _combinada(_off(), jumbo)[0].buscar(QUILQUE)
    assert producto.fuente == "combinada"
    assert len([p for p in peticiones if p.method == "GET"]) == 3


def test_no_pasa_del_tercer_candidato() -> None:
    fichas = {slug: "ficha_hellmanns_630g.html" for slug in SLUGS_QUILQUE[:3]}
    fichas[SLUGS_QUILQUE[3]] = "ficha_quilque_500g.html"  # el cuarto sí coincide, pero no se prueba
    jumbo, peticiones = _jumbo(fichas)
    producto = _combinada(_off(), jumbo)[0].buscar(QUILQUE)
    assert producto.fuente == "open_food_facts"
    assert len([p for p in peticiones if p.method == "GET"]) == 3


def test_un_candidato_que_ya_no_existe_se_salta() -> None:
    jumbo, _ = _jumbo({SLUGS_QUILQUE[1]: "ficha_quilque_500g.html"})  # el primero da 404
    assert _combinada(_off(), jumbo)[0].buscar(QUILQUE).fuente == "combinada"


def test_un_producto_a_granel_con_plu_nunca_coincide() -> None:
    plu = "24927352"  # pasa el dígito verificador de un EAN-8, pero es circulación restringida
    jumbo, _ = _jumbo({SLUGS_QUILQUE[0]: "ficha_granel_parcelas_valdivia.html"})
    producto = _combinada(_off(codigo_barras=plu), jumbo)[0].buscar(plu)
    assert producto.fuente == "open_food_facts"


def test_sin_resultados_en_jumbo_queda_solo_off() -> None:
    jumbo, _ = _jumbo(busqueda="busqueda_codigo_barras_sin_resultados.json")
    producto = _combinada(_off(), jumbo)[0].buscar(QUILQUE)
    assert producto.fuente == "open_food_facts"
    assert producto.fuentes_sin_respuesta == ()


def test_si_off_no_encuentra_el_codigo_devuelve_none_sin_consultar_jumbo() -> None:
    jumbo, peticiones = _jumbo()
    fuente, _ = _combinada(None, jumbo)
    assert fuente.buscar(QUILQUE) is None
    assert peticiones == []


def test_un_error_de_off_se_propaga() -> None:
    fuente = FuenteCombinada(
        OffFalsa(None, error=FuenteNoDisponibleError(MOTIVO_ERROR_SERVIDOR)), _jumbo()[0]
    )
    with pytest.raises(FuenteNoDisponibleError):
        fuente.buscar(QUILQUE)


# --- PT07-09: Jumbo no responde; presupuesto ---


@pytest.mark.parametrize(
    "falla", [httpx.ReadTimeout("lento"), httpx.ConnectError("sin red")]
)
def test_si_jumbo_no_responde_sigue_con_off_e_informa(falla) -> None:
    jumbo, _ = _jumbo(falla=falla)
    producto = _combinada(_off(), jumbo)[0].buscar(QUILQUE)
    assert producto.fuente == "open_food_facts"
    assert producto.fuentes_sin_respuesta == ("jumbo",)
    assert producto.nombre == "Queso mantecoso Quilque"


def test_si_la_ficha_de_jumbo_falla_a_mitad_tambien_sigue_con_off() -> None:
    def manejar(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            return httpx.Response(200, text=_leer("busqueda_quilque.json"))
        return httpx.Response(503)

    jumbo = JumboFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    producto = _combinada(_off(), jumbo)[0].buscar(QUILQUE)
    assert producto.fuentes_sin_respuesta == ("jumbo",)


def test_cada_llamada_usa_el_tiempo_que_queda_del_presupuesto_de_10_s() -> None:
    tiempos: list[float] = []

    def manejar(request: httpx.Request) -> httpx.Response:
        tiempos.append(request.extensions["timeout"]["read"])
        if request.method == "POST":
            return httpx.Response(200, text=_leer("busqueda_quilque.json"))
        return httpx.Response(200, text=_leer("ficha_quilque_500g.html"))

    jumbo = JumboFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    fuente, off = _combinada(_off(), jumbo, gasto=4.0)

    fuente.buscar(QUILQUE)

    assert off.llamadas == [(QUILQUE, 10.0)]
    assert tiempos == [6.0, 6.0]  # tras 4 s de OFF quedan 6 s para la búsqueda y para la ficha


def test_presupuesto_agotado_tras_off_no_consulta_jumbo_y_lo_informa() -> None:
    jumbo, peticiones = _jumbo()
    fuente, _ = _combinada(_off(), jumbo, gasto=10.0)

    producto = fuente.buscar(QUILQUE)

    assert peticiones == []
    assert producto.fuente == "open_food_facts"
    assert producto.fuentes_sin_respuesta == ("jumbo",)


def test_presupuesto_que_se_agota_entre_candidatos_corta_y_sigue_con_off() -> None:
    reloj = Reloj()

    def manejar(request: httpx.Request) -> httpx.Response:
        if request.method == "POST":
            reloj.avanzar(6.0)
            return httpx.Response(200, text=_leer("busqueda_quilque.json"))
        reloj.avanzar(5.0)  # la primera ficha agota los 10 s
        return httpx.Response(200, text=_leer("ficha_hellmanns_630g.html"))

    jumbo = JumboFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    fuente, _ = _combinada(_off(), jumbo, reloj=reloj)
    producto = fuente.buscar(QUILQUE)
    assert producto.fuentes_sin_respuesta == ("jumbo",)
    assert producto.fuente == "open_food_facts"


# --- alérgenos: unión con la lista de fuentes (PT07-06, PT07-07) ---


def _detectar(**extra):
    datos = {
        "codigo_barras": QUILQUE,
        "nombre": "x",
        "marca": None,
        "presentacion": None,
        "ingredientes": None,
        "fuentes_campos": {"etiquetas_alergenos": "open_food_facts", "trazas_texto": "jumbo"},
        **extra,
    }
    base = ProductoFuente(**datos)
    return combinar_alergenos(detectar_alergenos, base)


def _por_codigo(alergenos) -> dict[str, tuple[str, ...]]:
    return {a.codigo: a.fuentes for a in alergenos}


def test_union_de_off_jumbo_y_texto_cada_uno_con_su_fuente() -> None:
    # A en OFF (huevos), B en Jumbo (trazas de soya), C detectado en el texto (leche).
    deteccion = _detectar(
        etiquetas_alergenos=("en:eggs",),
        trazas_texto=("soya",),
        ingredientes="leche descremada, sal",
    )
    assert _por_codigo(deteccion.contiene) == {
        "huevos": ("open_food_facts",),
        "lacteos": ("ingredientes",),
    }
    assert _por_codigo(deteccion.trazas) == {"soja": ("jumbo",)}


def test_las_trazas_de_jumbo_siempre_son_trazas() -> None:
    deteccion = _detectar(trazas_texto=("leche", "nueces, productos derivados de nueces"))
    assert deteccion.contiene == ()
    assert set(_por_codigo(deteccion.trazas)) == {"lacteos", "frutos_cascara"}


def test_contiene_prevalece_sobre_traza_y_lista_solo_las_fuentes_que_lo_declaran_contiene() -> None:
    # OFF dice «contiene leche»; Jumbo dice «puede contener leche»: la traza de Jumbo no se lista.
    deteccion = _detectar(etiquetas_alergenos=("en:milk",), trazas_texto=("leche",))
    assert _por_codigo(deteccion.contiene) == {"lacteos": ("open_food_facts",)}
    assert deteccion.trazas == ()


def test_traza_de_off_con_contiene_en_el_texto_queda_como_contiene() -> None:
    deteccion = _detectar(etiquetas_trazas=("en:milk",), ingredientes="leche en polvo")
    # La traza de OFF no se lista: solo quien declara «contiene» (el texto de los ingredientes).
    assert _por_codigo(deteccion.contiene) == {"lacteos": ("ingredientes",)}
    assert deteccion.trazas == ()


def test_libre_de_lactosa_no_quita_la_leche_de_los_ingredientes() -> None:
    # Quilque real: Jumbo dice «Libre de Lactosa» y los ingredientes llevan leche (PT07-07).
    fuente, _ = _combinada(_off(etiquetas_alergenos=()))
    producto = fuente.buscar(QUILQUE)
    assert producto.ficha["jumbo"]["condiciones_alimentarias"][0] == "Libre de Lactosa"

    deteccion = combinar_alergenos(detectar_alergenos, producto)

    assert _por_codigo(deteccion.contiene) == {"lacteos": ("ingredientes",)}


def test_un_termino_de_trazas_no_reconocido_va_a_sin_reconocer() -> None:
    deteccion = _detectar(trazas_texto=("soya", "polvo de unicornio"))
    assert "polvo de unicornio" in deteccion.sin_reconocer
    assert "soja" in _por_codigo(deteccion.trazas)


def test_off_solo_tambien_lista_sus_fuentes() -> None:
    jumbo, _ = _jumbo(falla=httpx.ReadTimeout("x"))
    producto = _combinada(_off(etiquetas_alergenos=("en:milk",)), jumbo)[0].buscar(QUILQUE)
    deteccion = combinar_alergenos(detectar_alergenos, producto)
    assert _por_codigo(deteccion.contiene)["lacteos"] == ("open_food_facts", "ingredientes")


# --- PT07-13: contrato de la API ---


CATALOGO = [
    ("lacteos", "Leche"),
    ("huevos", "Huevos"),
    ("soja", "Soya"),
    ("frutos_cascara", "Frutos secos"),
    ("gluten", "Gluten"),
]


@pytest.fixture
def ana(client) -> dict[str, str]:
    cuenta = {
        "nombre": "Productora A",
        "nombre_negocio": "Panaderia A",
        "email": "productora.combinada.hu07@ejemplo.com",
        "password": "SecretoProductor123!",
    }
    assert client.post("/auth/register", json=cuenta).status_code == 201
    login = client.post("/auth/login", json={"email": cuenta["email"], "password": cuenta["password"]})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def catalogo(db_session) -> None:
    db_session.add_all(Alergeno(codigo=c, nombre=n, obligatorio_chile=True) for c, n in CATALOGO)
    db_session.commit()


def _consultar(client, headers, codigo: str) -> dict:
    respuesta = client.get(f"/gestion/insumos/consulta-codigo/{codigo}", headers=headers)
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_la_ruta_responde_la_ficha_combinada_con_campos_opcionales_nuevos(client, ana, catalogo) -> None:
    con_trazas = _leer("ficha_quilque_500g.html").replace(
        "</body>",
        '<div><p><span>Puede contener</span><br/><span>Trazas</span> soya</p></div></body>',
    )
    jumbo, _ = _jumbo({SLUGS_QUILQUE[0]: con_trazas})
    fuente = FuenteCombinada(OffFalsa(_off(etiquetas_alergenos=("en:eggs",))), jumbo)
    app.dependency_overrides[get_fuente_producto] = lambda: fuente

    cuerpo = _consultar(client, ana, QUILQUE)

    assert cuerpo["fuente"] == "combinada"
    assert cuerpo["fuentes_campos"]["ingredientes_declarados"] == "jumbo"
    assert cuerpo["producto"]["nombre"] == "Queso mantecoso Quilque"
    assert "fuentes_sin_respuesta" not in cuerpo
    contiene = {a["codigo"]: a["fuentes"] for a in cuerpo["alergenos"]["contiene"]}
    trazas = {a["codigo"]: a["fuentes"] for a in cuerpo["alergenos"]["trazas"]}
    assert contiene == {"huevos": ["open_food_facts"], "lacteos": ["ingredientes"]}
    assert trazas == {"soja": ["jumbo"]}


def test_la_ruta_informa_cuando_jumbo_no_respondio(client, ana, catalogo) -> None:
    jumbo, _ = _jumbo(falla=httpx.ReadTimeout("lento"))
    app.dependency_overrides[get_fuente_producto] = lambda: _combinada(_off(), jumbo)[0]

    cuerpo = _consultar(client, ana, QUILQUE)

    assert cuerpo["fuente"] == "open_food_facts"
    assert cuerpo["fuentes_sin_respuesta"] == ["jumbo"]
    assert cuerpo["fuentes_campos"]["nombre"] == "open_food_facts"


def test_si_off_no_conoce_el_codigo_la_ruta_responde_no_encontrado(client, ana, catalogo) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: _combinada(None)[0]
    cuerpo = _consultar(client, ana, QUILQUE)
    assert cuerpo["encontrado"] is False
    assert cuerpo["fuente"] == "open_food_facts"
    assert "fuentes_campos" not in cuerpo and "fuentes_sin_respuesta" not in cuerpo


def test_la_respuesta_de_una_sola_fuente_no_trae_los_campos_nuevos(client, ana, catalogo) -> None:
    """HU13 no cambia: sin combinar, la respuesta no lleva fuentes ni fuentes_campos."""

    class Sola:
        nombre = "open_food_facts"

        def buscar(self, codigo_barras):
            return replace(_off(), ingredientes="Leche, sal")

    app.dependency_overrides[get_fuente_producto] = lambda: Sola()
    cuerpo = _consultar(client, ana, QUILQUE)
    assert "fuentes_campos" not in cuerpo and "fuentes_sin_respuesta" not in cuerpo
    assert all("fuentes" not in a for a in cuerpo["alergenos"]["contiene"])
    assert cuerpo["fuente"] == "open_food_facts"


def test_la_fuente_combinada_cumple_el_contrato_de_fuente_producto() -> None:
    fuente, _ = _combinada(_off())
    assert fuente.nombre == "open_food_facts" and callable(fuente.buscar)


# --- Open Food Facts con plazo propio ---


def test_off_usa_el_plazo_recibido_y_sin_plazo_el_de_sus_ajustes() -> None:
    from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente

    vistos: list[float] = []

    def manejar(request: httpx.Request) -> httpx.Response:
        vistos.append(request.extensions["timeout"]["read"])
        return httpx.Response(200, json={"status": 0})

    off = OpenFoodFactsFuente(Settings(_env_file=None), transport=httpx.MockTransport(manejar))
    off.buscar(QUILQUE, timeout=3.0)
    off.buscar(QUILQUE)
    assert 0 < vistos[0] <= 3.0
    assert vistos[1] == Settings(_env_file=None).off_timeout_seconds
