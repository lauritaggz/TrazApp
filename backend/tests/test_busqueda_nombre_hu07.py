"""Search by name or brand in Jumbo, and the proposal for one hit (HU07 / T07-06, CA2-CA6, CA8-CA10).

GET /gestion/insumos/busqueda?texto=            -> the hits (nombre, marca, presentación, id)
GET /gestion/insumos/busqueda/{id}              -> a proposal with the format of the barcode lookup

Jumbo answers with the recorded fixtures of tests/fixtures/jumbo; nothing reaches the network. Both
endpoints only read: nothing is registered until the productor confirms (CA9).
"""

import httpx
import pytest
from sqlalchemy import func, select

from app.api.dependencies import get_fuente_busqueda_nombre
from app.main import app
from app.models import Alergeno, InsumoComercial
from tests.escenario_hu05 import crear_ingrediente, registrar
from tests.test_fuente_combinada_hu07 import QUILQUE, SLUGS_QUILQUE, _jumbo
from tests.test_registro_desde_codigo_hu13 import CODIGOS_CATALOGO

BUSQUEDA = "/gestion/insumos/busqueda"
GRANEL = "queso-mantecoso-las-parcelas-valdivia-granel"
LONCOLECHE = "leche-loncoleche-proteina-capuccino-200-ml"


@pytest.fixture
def escena(api, fabrica) -> dict:
    headers = registrar(api)
    with fabrica() as sesion:
        sesion.add_all(
            Alergeno(codigo=codigo, nombre=codigo.capitalize(), obligatorio_chile=False)
            for codigo in CODIGOS_CATALOGO
        )
        sesion.commit()
    return {"headers": headers, "queso": crear_ingrediente(api, headers, "Queso", "que-001")}


def _usar_jumbo(fichas=None, busqueda: str = "busqueda_quilque.json", falla=None):
    jumbo, peticiones = _jumbo(fichas, busqueda=busqueda, falla=falla)
    app.dependency_overrides[get_fuente_busqueda_nombre] = lambda: jumbo
    return peticiones


def _buscar(api, escena, texto: str):
    return api.get(BUSQUEDA, params={"texto": texto}, headers=escena["headers"])


def _contar_insumos(fabrica) -> int:
    with fabrica() as sesion:
        return sesion.scalar(select(func.count()).select_from(InsumoComercial))


# --- PT07-01: la búsqueda ---


def test_la_busqueda_responde_nombre_marca_presentacion_e_id_de_hasta_10_resultados(api, escena) -> None:
    _usar_jumbo(busqueda="busqueda_queso_mantecoso.json")

    respuesta = _buscar(api, escena, "queso mantecoso")

    assert respuesta.status_code == 200, respuesta.text
    resultados = respuesta.json()
    assert len(resultados) == 10
    primero = resultados[0]
    assert set(primero) == {"id", "nombre", "marca", "presentacion", "url", "imagen_url"}
    assert primero["id"] == "queso-mantecoso-las-parcelas-valdivia-granel"
    assert primero["nombre"] == "Queso Mantecoso Las Parcelas de Valdivia Trozo Granel"
    assert primero["marca"] == "Las Parcelas de Valdivia"
    assert primero["url"] == "https://www.jumbo.cl/queso-mantecoso-las-parcelas-valdivia-granel/p"


def test_sin_resultados_responde_lista_vacia_no_un_error(api, escena) -> None:
    _usar_jumbo(busqueda="busqueda_codigo_barras_sin_resultados.json")
    respuesta = _buscar(api, escena, "zzzz yyyy")
    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_la_busqueda_manda_una_sola_consulta_con_el_texto_normalizado(api, escena) -> None:
    peticiones = _usar_jumbo()
    assert _buscar(api, escena, "  queso   quilque ").status_code == 200
    assert len(peticiones) == 1
    assert peticiones[0].content == b'{"fullText":"queso quilque"}'


@pytest.mark.parametrize("texto", ["", "   ", "a", "x" * 101])
def test_un_texto_muy_corto_o_muy_largo_responde_422_con_mensaje(api, escena, texto) -> None:
    peticiones = _usar_jumbo()
    respuesta = _buscar(api, escena, texto)
    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["mensaje"]
    assert peticiones == []


@pytest.mark.parametrize(
    "falla",
    [httpx.ReadTimeout("lento"), httpx.ConnectError("sin red")],
    ids=["timeout", "conexion"],
)
def test_si_jumbo_no_responde_la_busqueda_responde_503_con_mensaje_y_motivo(api, escena, falla) -> None:
    _usar_jumbo(falla=falla)
    respuesta = _buscar(api, escena, "queso")
    assert respuesta.status_code == 503
    detalle = respuesta.json()["detail"]
    assert detalle["mensaje"] and detalle["motivo"]


def test_la_busqueda_requiere_sesion(api) -> None:
    _usar_jumbo()
    assert api.get(BUSQUEDA, params={"texto": "queso"}).status_code == 401
    assert api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}").status_code == 401


# --- PT07-02: elegir un resultado ---


def test_elegir_un_resultado_responde_la_propuesta_con_el_formato_de_la_consulta_por_codigo(
    api, fabrica, escena
) -> None:
    _usar_jumbo({SLUGS_QUILQUE[0]: "ficha_quilque_500g.html"})

    respuesta = api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["encontrado"] is True
    assert cuerpo["fuente"] == "jumbo"
    assert cuerpo["codigo_barras"] == QUILQUE
    assert cuerpo["producto"]["nombre"]
    assert cuerpo["producto"]["ingredientes_declarados"]
    assert cuerpo["fecha_recuperacion"]
    assert cuerpo["ficha"]["url"].endswith("/p") and cuerpo["ficha"]["gtin"] == QUILQUE
    assert cuerpo["fuentes_campos"]["ingredientes_declarados"] == "jumbo"
    assert set(cuerpo["fuentes_campos"].values()) == {"jumbo"}
    assert "fuentes_sin_respuesta" not in cuerpo
    # Allergens: the milk is read in the ingredient text of the sheet.
    contiene = {a["codigo"]: a["fuentes"] for a in cuerpo["alergenos"]["contiene"]}
    assert contiene["lacteos"] == ["ingredientes"]
    # PT07-11: asking for the proposal registers nothing.
    assert _contar_insumos(fabrica) == 0


def test_las_trazas_de_jumbo_llegan_como_trazas_con_fuente_jumbo(api, escena) -> None:
    _usar_jumbo({LONCOLECHE: "ficha_loncoleche_capuccino_200ml.html"})

    cuerpo = api.get(f"{BUSQUEDA}/{LONCOLECHE}", headers=escena["headers"]).json()

    trazas = {a["codigo"]: a["fuentes"] for a in cuerpo["alergenos"]["trazas"]}
    assert trazas and all(fuentes == ["jumbo"] for fuentes in trazas.values())


# --- PT07-10: duplicado ---


def test_un_producto_con_gtin_valido_ya_registrado_responde_409_como_en_hu13(api, escena) -> None:
    _usar_jumbo({SLUGS_QUILQUE[0]: "ficha_quilque_500g.html"})
    creado = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json={
            "ingrediente_id": escena["queso"]["id"],
            "nombre": "Queso Quilque",
            "marca_origen": "Soprole",
            "codigo_barras": QUILQUE,
        },
    )
    assert creado.status_code == 201, creado.text

    respuesta = api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}", headers=escena["headers"])

    assert respuesta.status_code == 409
    detalle = respuesta.json()["detail"]
    assert detalle["insumo_id"] == creado.json()["id"]
    assert detalle["activo"] is True and detalle["mensaje"]


def test_un_producto_a_granel_no_tiene_deteccion_de_duplicados_y_no_trae_codigo(api, fabrica, escena) -> None:
    _usar_jumbo({GRANEL: "ficha_granel_parcelas_valdivia.html"})

    respuesta = api.get(f"{BUSQUEDA}/{GRANEL}", headers=escena["headers"])

    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    # The sheet's gtin is a PLU: it is kept in the record, never as the barcode.
    assert cuerpo["codigo_barras"] == ""
    assert cuerpo["ficha"]["gtin"] == "24927352"
    assert cuerpo["fuente"] == "jumbo"
    assert _contar_insumos(fabrica) == 0


# --- errores de la ficha ---


def test_un_resultado_que_ya_no_existe_responde_404_con_mensaje(api, escena) -> None:
    _usar_jumbo({})
    respuesta = api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}", headers=escena["headers"])
    assert respuesta.status_code == 404
    assert "manualmente" in respuesta.json()["detail"]["mensaje"]


def test_un_identificador_con_formato_invalido_responde_422_sin_consultar(api, escena) -> None:
    peticiones = _usar_jumbo({})
    respuesta = api.get(f"{BUSQUEDA}/-mal-slug", headers=escena["headers"])
    assert respuesta.status_code == 422
    assert peticiones == []


def test_si_jumbo_no_responde_al_pedir_la_ficha_responde_503(api, escena) -> None:
    _usar_jumbo(falla=httpx.ReadTimeout("lento"))
    respuesta = api.get(f"{BUSQUEDA}/{SLUGS_QUILQUE[0]}", headers=escena["headers"])
    assert respuesta.status_code == 503
    assert respuesta.json()["detail"]["motivo"]


def test_la_ruta_de_busqueda_no_se_lee_como_id_de_insumo(api, escena) -> None:
    _usar_jumbo()
    assert _buscar(api, escena, "quilque").status_code == 200
