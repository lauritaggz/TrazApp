"""Open Food Facts adapter against answers recorded from the real service (T13-03 / HU13).

The files in tests/fixtures/off were recorded once with scripts/grabar_respuesta_off.py. The tests
only read them: nothing here reaches the network.
"""

import json
import re
from pathlib import Path

import httpx
import pytest

from app.api.dependencies import get_fuente_producto
from app.core.config import Settings
from app.main import app
from app.services.recuperacion.base import FuenteNoDisponibleError
from app.services.recuperacion.open_food_facts import CAMPOS, OpenFoodFactsFuente

FIXTURES = Path(__file__).parent / "fixtures" / "off"

LECHE_SIN_LACTOSA = "7802910000971"
GALLETA_TRITON = "8445291716841"
LECHE_ENTERA = "7808709504767"
AZUCAR_FLOR = "7801505231974"
AZUCAR_RUBIA = "7801505231950"
ATUN_UPC_A = "400001143070"
ATUN_EAN_13 = "0400001143070"
ACEITE_DE_GIRASOL = "7790272001005"
POLVOS_DE_HORNEAR = "7802410002239"
BICARBONATO = "8413700064197"
SIN_NOMBRE = "7803600002053"
NO_ENCONTRADO = "7801505000358"

TODAS = sorted(archivo.stem for archivo in FIXTURES.glob("*.json"))


def _cargar(codigo: str) -> dict:
    return json.loads((FIXTURES / f"{codigo}.json").read_text(encoding="utf-8"))


def _transporte(respuestas: dict[str, str]) -> tuple[httpx.MockTransport, list[str]]:
    """Answers each code with the fixture named in `respuestas` (code asked -> fixture)."""
    pedidos: list[str] = []

    def responder(request: httpx.Request) -> httpx.Response:
        codigo = request.url.path.rsplit("/", 1)[1].removesuffix(".json")
        pedidos.append(codigo)
        grabada = _cargar(respuestas[codigo])
        return httpx.Response(grabada["http_status"], json=grabada["body"])

    return httpx.MockTransport(responder), pedidos


def _buscar(codigo: str, fixture: str | None = None):
    transporte, _ = _transporte({codigo: fixture or codigo})
    return OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte).buscar(codigo)


# --- las fixtures grabadas ---


def test_hay_una_fixture_por_cada_codigo_del_conjunto_de_prueba() -> None:
    assert TODAS == sorted(
        [
            LECHE_SIN_LACTOSA,
            GALLETA_TRITON,
            LECHE_ENTERA,
            AZUCAR_FLOR,
            AZUCAR_RUBIA,
            ATUN_UPC_A,
            ATUN_EAN_13,
            ACEITE_DE_GIRASOL,
            POLVOS_DE_HORNEAR,
            BICARBONATO,
            SIN_NOMBRE,
            NO_ENCONTRADO,
        ]
    )


@pytest.mark.parametrize("codigo", TODAS)
def test_las_fixtures_solo_contienen_los_campos_pedidos(codigo) -> None:
    grabada = _cargar(codigo)

    assert set(grabada) == {"http_status", "body"}
    assert set(grabada["body"]) <= {"code", "status", "status_verbose", "product"}
    assert set(grabada["body"].get("product", {})) <= set(CAMPOS)


@pytest.mark.parametrize("codigo", TODAS)
def test_las_fixtures_no_contienen_correos_ni_telefonos_ni_credenciales(codigo) -> None:
    texto = (FIXTURES / f"{codigo}.json").read_text(encoding="utf-8")

    assert not re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", texto)
    # The barcode and the modification timestamp are long numbers too, but they are not phones.
    sin_numeros_del_producto = re.sub(r'"(code|last_modified_t)": "?\d+"?', "", texto)
    assert not re.search(r"\+?\d[\d\s().-]{8,}\d", sin_numeros_del_producto)
    for palabra in ("password", "token", "authorization", "api_key", "creator", "editors"):
        assert palabra not in texto.lower()


# --- lo que interpreta el adaptador ---


def test_leche_sin_lactosa_trae_leche_en_los_ingredientes_pero_no_en_las_etiquetas() -> None:
    producto = _buscar(LECHE_SIN_LACTOSA)

    assert producto is not None
    assert producto.nombre == "LONCO LECHE SIN LACTOSA"
    assert producto.marca == "Lonco Leche"
    assert producto.presentacion == "1L"
    assert producto.ingredientes is not None and producto.ingredientes.startswith("Leche fluida")
    assert producto.etiquetas_alergenos == ()
    assert producto.etiquetas_trazas == ()


def test_galleta_con_ingredientes_y_alergenos_etiquetados() -> None:
    producto = _buscar(GALLETA_TRITON)

    assert producto is not None
    assert producto.nombre == "TRITON SABOR VAINILLA"
    assert producto.marca == "MCKAY"
    assert producto.etiquetas_alergenos == ("en:gluten", "en:soybeans")
    assert producto.ingredientes is not None and "Harina de Trigo" in producto.ingredientes


def test_leche_entera_con_ingredientes_y_sin_alergenos_etiquetados() -> None:
    producto = _buscar(LECHE_ENTERA)

    assert producto is not None
    assert producto.marca == "Surlat"
    assert producto.ingredientes == "Leche natural entera, enzima Lactasa y vitamina D3."
    assert producto.etiquetas_alergenos == ()


def test_azucar_flor_con_ingredientes() -> None:
    producto = _buscar(AZUCAR_FLOR)

    assert producto is not None
    assert producto.nombre == "azúcar flor"
    assert producto.presentacion == "500 g"
    assert producto.ingredientes is not None and "almidón de maiz" in producto.ingredientes


def test_azucar_rubia_se_encuentra_con_datos_incompletos() -> None:
    producto = _buscar(AZUCAR_RUBIA)

    assert producto is not None
    assert producto.nombre == "azúcar Rubia"
    assert producto.marca == "IANSA"
    assert producto.ingredientes is None
    assert producto.presentacion is None


def test_polvos_de_hornear_sin_ingredientes() -> None:
    producto = _buscar(POLVOS_DE_HORNEAR)

    assert producto is not None
    assert producto.nombre == "Polvos de Hornear"
    assert producto.ingredientes is None


def test_aceite_de_girasol_con_alergenos_y_trazas_etiquetados() -> None:
    producto = _buscar(ACEITE_DE_GIRASOL)

    assert producto is not None
    assert producto.etiquetas_alergenos == ("en:soybeans",)
    assert producto.etiquetas_trazas == ("en:peanuts", "en:soybeans")


def test_bicarbonato_importado() -> None:
    producto = _buscar(BICARBONATO)

    assert producto is not None
    assert producto.marca == "Carmencita"
    assert producto.presentacion == "200 g"


def test_producto_encontrado_sin_nombre_ni_marca() -> None:
    producto = _buscar(SIN_NOMBRE)

    assert producto is not None
    assert producto.nombre is None
    assert producto.marca is None
    assert producto.presentacion is None
    assert producto.ingredientes is not None


def test_producto_no_encontrado_responde_404_y_el_adaptador_devuelve_none() -> None:
    assert _cargar(NO_ENCONTRADO)["http_status"] == 404

    assert _buscar(NO_ENCONTRADO) is None


def test_la_ficha_de_una_fixture_conserva_los_campos_recibidos_y_la_url() -> None:
    producto = _buscar(ACEITE_DE_GIRASOL)

    assert producto is not None
    esperada = dict(_cargar(ACEITE_DE_GIRASOL)["body"]["product"])
    esperada["url"] = f"https://world.openfoodfacts.org/product/{ACEITE_DE_GIRASOL}"
    assert producto.ficha == esperada


# --- UPC-A: reintento con la forma EAN-13 ---


def test_open_food_facts_ya_resuelve_el_upc_a_y_no_hace_falta_reintentar() -> None:
    # Recorded behavior: asking with the 12 digits already answers with the "0"-prefixed product.
    transporte, pedidos = _transporte({ATUN_UPC_A: ATUN_UPC_A})
    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte)

    producto = fuente.buscar(ATUN_UPC_A)

    assert producto is not None
    assert producto.nombre == "ATÚN LOMITOS EN ACEITE"
    assert producto.codigo_barras == ATUN_UPC_A
    assert pedidos == [ATUN_UPC_A]


def test_si_no_encuentra_el_upc_a_reintenta_una_vez_con_el_ean_13_de_cero_inicial() -> None:
    transporte, pedidos = _transporte({ATUN_UPC_A: NO_ENCONTRADO, ATUN_EAN_13: ATUN_EAN_13})
    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte)

    producto = fuente.buscar(ATUN_UPC_A)

    assert pedidos == [ATUN_UPC_A, ATUN_EAN_13]
    assert producto is not None
    assert producto.nombre == "ATÚN LOMITOS EN ACEITE"
    # It is reported under the code as it was read; the product page is the one that answered.
    assert producto.codigo_barras == ATUN_UPC_A
    assert producto.url == f"https://world.openfoodfacts.org/product/{ATUN_EAN_13}"


def test_si_ninguna_forma_del_upc_a_existe_devuelve_none_tras_dos_pedidos() -> None:
    transporte, pedidos = _transporte({ATUN_UPC_A: NO_ENCONTRADO, ATUN_EAN_13: NO_ENCONTRADO})
    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte)

    assert fuente.buscar(ATUN_UPC_A) is None
    assert pedidos == [ATUN_UPC_A, ATUN_EAN_13]


@pytest.mark.parametrize("codigo", [NO_ENCONTRADO, ATUN_EAN_13, "96385074"])
def test_los_codigos_que_no_son_upc_a_no_se_reintentan(codigo) -> None:
    transporte, pedidos = _transporte({codigo: NO_ENCONTRADO})
    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte)

    assert fuente.buscar(codigo) is None
    assert pedidos == [codigo]


def test_un_error_de_la_fuente_no_se_reintenta_con_otra_forma() -> None:
    pedidos: list[str] = []

    def agotado(request: httpx.Request) -> httpx.Response:
        pedidos.append(request.url.path)
        raise httpx.ReadTimeout("lento")

    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=httpx.MockTransport(agotado))

    with pytest.raises(FuenteNoDisponibleError):
        fuente.buscar(ATUN_UPC_A)
    assert len(pedidos) == 1


def test_un_error_en_el_reintento_tambien_es_fuente_no_disponible() -> None:
    def responder(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith(f"/{ATUN_UPC_A}.json"):
            return httpx.Response(404, json={"status": 0})
        return httpx.Response(503, text="mantenimiento")

    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=httpx.MockTransport(responder))

    with pytest.raises(FuenteNoDisponibleError) as excinfo:
        fuente.buscar(ATUN_UPC_A)
    assert excinfo.value.motivo == "error_servidor"


# --- de punta a punta por el endpoint ---


def _consultar_con_fixtures(client, respuestas: dict[str, str], codigo: str):
    transporte, _ = _transporte(respuestas)
    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=transporte)
    app.dependency_overrides[get_fuente_producto] = lambda: fuente
    assert (
        client.post(
            "/auth/register",
            json={
                "nombre": "Productor F",
                "nombre_negocio": "Panaderia F",
                "email": "productor.f.hu13@ejemplo.com",
                "password": "SecretoProductor123!",
            },
        ).status_code
        == 201
    )
    token = client.post(
        "/auth/login",
        json={"email": "productor.f.hu13@ejemplo.com", "password": "SecretoProductor123!"},
    ).json()["access_token"]
    return client.get(
        f"/gestion/insumos/consulta-codigo/{codigo}", headers={"Authorization": f"Bearer {token}"}
    )


def test_el_endpoint_propone_el_insumo_a_partir_de_una_respuesta_grabada(client) -> None:
    response = _consultar_con_fixtures(
        client, {LECHE_SIN_LACTOSA: LECHE_SIN_LACTOSA}, LECHE_SIN_LACTOSA
    )

    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["encontrado"] is True
    assert cuerpo["producto"]["nombre"] == "LONCO LECHE SIN LACTOSA"
    assert cuerpo["producto"]["marca_origen"] == "Lonco Leche"
    assert cuerpo["ficha"]["url"].endswith(f"/product/{LECHE_SIN_LACTOSA}")


def test_el_endpoint_informa_no_encontrado_a_partir_de_una_respuesta_grabada(client) -> None:
    response = _consultar_con_fixtures(client, {NO_ENCONTRADO: NO_ENCONTRADO}, NO_ENCONTRADO)

    assert response.status_code == 200
    assert response.json()["encontrado"] is False
