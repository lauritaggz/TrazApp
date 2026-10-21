"""The ingredient text proposed as «ingredientes declarados» is cleaned (T13-10 / HU13).

The cut (manufacturer and contact details) only affects the proposal: the allergen detection and the
`ficha` keep using the original text. The recorded answers come from tests/fixtures/off; nothing here
reaches the network.
"""

import json
from pathlib import Path

import httpx
import pytest

from app.api.dependencies import get_fuente_producto, get_recuperacion_service
from app.core.config import Settings
from app.main import app
from app.models import Alergeno
from app.repositories.insumo_repository import InsumoRepository
from app.services.recuperacion.alergenos import Deteccion
from app.services.recuperacion.limpieza import limpiar_ingredientes
from app.services.recuperacion.modelos import ProductoFuente
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente
from app.services.recuperacion.service import RecuperacionService

FIXTURES = Path(__file__).parent / "fixtures" / "off"
AZUCAR_FLOR = "7801505231974"
EAN_13 = "7802910000971"
RUTA = "/gestion/insumos/consulta-codigo"

PRODUCTOR = {
    "nombre": "Productor Limpieza",
    "nombre_negocio": "Panaderia Limpieza",
    "email": "productor.limpieza.hu13@ejemplo.com",
    "password": "SecretoProductor123!",
}


# --- the function: a table of cases ---------------------------------------------------------------

CASOS = [
    pytest.param(
        "Azúcar, sal. Elaborado por Sal Chile S.A., Av. Providencia 1234, piso 5, Santiago.",
        "Azúcar, sal.",
        id="direccion-con-sa-y-numeros",
    ),
    pytest.param(
        "Harina, agua. Elaborado por Molinos Sur. Puede contener trazas de maní.",
        "Harina, agua. Puede contener trazas de maní.",
        id="se-conserva-el-aviso-de-trazas",
    ),
    pytest.param(
        "Harina. Elaborado y envasado por Molinos Sur Ltda., Calle 1. Contiene leche y soya.",
        "Harina. Contiene leche y soya.",
        id="se-conserva-un-contiene",
    ),
    pytest.param(
        "Harina. Distribuido por X S.A. Puede contener soya. Contiene trazas de huevo.",
        "Harina. Puede contener soya. Contiene trazas de huevo.",
        id="se-conservan-varios-avisos",
    ),
    pytest.param(
        "Harina. Fabricado por X Ltda. Fono 600 123 4567. www.x.cl. Elaborado en una línea que procesa maní.",
        "Harina. Elaborado en una línea que procesa maní.",
        id="contacto-y-aviso-de-linea",
    ),
    pytest.param(
        "Harina, agua. Elaborado en una línea que procesa maní.",
        "Harina, agua. Elaborado en una línea que procesa maní.",
        id="linea-que-procesa-no-se-corta",
    ),
    pytest.param(
        "Harina de trigo, elaborado en una línea que procesa maní, agua y sal. Azúcar, levadura.",
        "Harina de trigo, elaborado en una línea que procesa maní, agua y sal. Azúcar, levadura.",
        id="linea-que-procesa-no-corta-lo-que-sigue",
    ),
    pytest.param(
        "Harina, agua. Elaborado en instalaciones que procesan leche y soya.",
        "Harina, agua. Elaborado en instalaciones que procesan leche y soya.",
        id="instalaciones-que-procesan-no-se-corta",
    ),
    pytest.param(
        "Harina, agua. Producido en una planta que utiliza frutos secos.",
        "Harina, agua. Producido en una planta que utiliza frutos secos.",
        id="planta-que-utiliza-no-se-corta",
    ),
    pytest.param("Harina, agua, sal.", "Harina, agua, sal.", id="sin-frases-de-fabricante"),
    pytest.param("Harina, agua. www.molinos.cl", "Harina, agua.", id="sitio-web"),
    pytest.param("Harina, agua. Consultas a ventas@molinos.cl", "Harina, agua. Consultas a", id="correo"),
    pytest.param("Harina, agua. Fono: 600 123 4567", "Harina, agua.", id="fono"),
    pytest.param("HARINA, AGUA. ELABORADO POR MOLINOS SUR S.A.", "HARINA, AGUA.", id="mayusculas"),
    pytest.param("Harina. Elaborado por-Molinos S.A. Las Condes,", "Harina.", id="por-pegado-con-guion"),
    pytest.param("Harina. Importado por X. Santiago", "Harina.", id="importado-por"),
    pytest.param("Harina. Producido por X. Santiago", "Harina.", id="producido-por"),
    pytest.param("Harina. Comercializado por X. Santiago", "Harina.", id="comercializado-por"),
    pytest.param("Harina. Envasado por X. Santiago", "Harina.", id="envasado-por"),
    pytest.param("Harina. Distribuido por X. Santiago", "Harina.", id="distribuido-por"),
    pytest.param("Harina. Fabricado por X. Santiago", "Harina.", id="fabricado-por"),
]


@pytest.mark.parametrize(("texto", "esperado"), CASOS)
def test_limpia_el_texto_de_ingredientes(texto, esperado) -> None:
    assert limpiar_ingredientes(texto) == esperado


def test_el_texto_vacio_o_nulo_queda_igual() -> None:
    assert limpiar_ingredientes(None) is None
    assert limpiar_ingredientes("") == ""
    assert limpiar_ingredientes("   ") == "   "


@pytest.mark.parametrize(
    "texto",
    [
        "Elaborado por Molinos Sur S.A., Calle 1, Las Condes.",
        "Elaborado por X. Puede contener trazas de maní.",
        "Fono 600 123 4567",
    ],
)
def test_si_la_limpieza_no_deja_ingredientes_se_usa_el_original(texto) -> None:
    assert limpiar_ingredientes(texto) == texto


def test_la_limpieza_no_cambia_nada_si_no_hay_nada_que_cortar() -> None:
    texto = "  Leche descremada,  vitaminas A y D.  "
    assert limpiar_ingredientes(texto) == texto


# --- the proposal, the detection and the ficha ----------------------------------------------------


def _transporte(codigo: str, cuerpo: dict) -> httpx.MockTransport:
    return httpx.MockTransport(lambda request: httpx.Response(cuerpo["http_status"], json=cuerpo["body"]))


def _fuente_con_fixture(codigo: str) -> OpenFoodFactsFuente:
    grabada = json.loads((FIXTURES / f"{codigo}.json").read_text(encoding="utf-8"))
    return OpenFoodFactsFuente(Settings(_env_file=None), transport=_transporte(codigo, grabada))


class FuenteFalsa:
    nombre = "open_food_facts"

    def __init__(self, ingredientes: str) -> None:
        self.producto = ProductoFuente(
            codigo_barras=EAN_13,
            nombre="Producto",
            marca="Marca",
            presentacion=None,
            ingredientes=ingredientes,
            ficha={"ingredients_text": ingredientes, "url": "https://off.test/product/1"},
        )

    def buscar(self, codigo_barras: str):
        return self.producto


@pytest.fixture
def ana(client) -> dict[str, str]:
    assert client.post("/auth/register", json=PRODUCTOR).status_code == 201
    login = client.post(
        "/auth/login", json={"email": PRODUCTOR["email"], "password": PRODUCTOR["password"]}
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def lacteos(db_session) -> Alergeno:
    fila = Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True)
    db_session.add(fila)
    db_session.commit()
    return fila


def _consultar(client, headers, codigo: str) -> dict:
    response = client.get(f"{RUTA}/{codigo}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_el_azucar_flor_graba_su_texto_sin_el_fabricante(client, ana) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: _fuente_con_fixture(AZUCAR_FLOR)

    cuerpo = _consultar(client, ana, AZUCAR_FLOR)

    ingredientes = cuerpo["producto"]["ingredientes_declarados"]
    assert ingredientes == "Azúcar impalpable y almidón de maiz."
    for ruido in ("Elaborado", "ansagro", "Posario", "Condes", "S.A."):
        assert ruido not in ingredientes


def test_la_ficha_conserva_el_texto_original_sin_cambios(client, ana) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: _fuente_con_fixture(AZUCAR_FLOR)

    cuerpo = _consultar(client, ana, AZUCAR_FLOR)

    original = json.loads((FIXTURES / f"{AZUCAR_FLOR}.json").read_text(encoding="utf-8"))
    texto_original = original["body"]["product"]["ingredients_text"]
    assert "Elaborado y envasado por" in texto_original
    assert cuerpo["ficha"]["ingredients_text"] == texto_original


def test_la_deteccion_corre_sobre_el_texto_original_completo(client, db_session, ana) -> None:
    recibido: list[str | None] = []

    def detector(contiene, trazas, texto):
        recibido.append(texto)
        return Deteccion()

    original = "Azúcar. Elaborado por Quesos Don Pepe S.A., Calle 1. Puede contener trazas de maní."
    app.dependency_overrides[get_recuperacion_service] = lambda: RecuperacionService(
        InsumoRepository(db_session), FuenteFalsa(original), detector=detector
    )

    cuerpo = _consultar(client, ana, EAN_13)

    assert recibido == [original]
    assert cuerpo["producto"]["ingredientes_declarados"] == "Azúcar. Puede contener trazas de maní."


def test_un_alergeno_mencionado_solo_despues_del_corte_se_sigue_detectando(
    client, db_session, ana, lacteos
) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: FuenteFalsa(
        "Azúcar. Elaborado por Quesos Don Pepe S.A., Calle 1, Santiago."
    )

    cuerpo = _consultar(client, ana, EAN_13)

    # The text shown to the productor no longer mentions it, but the detection saw the original.
    assert cuerpo["producto"]["ingredientes_declarados"] == "Azúcar."
    assert [a["codigo"] for a in cuerpo["alergenos"]["contiene"]] == ["lacteos"]


def test_un_producto_sin_ingredientes_sigue_sin_ingredientes(client, ana) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: FuenteFalsa("")

    cuerpo = _consultar(client, ana, EAN_13)

    assert not cuerpo["producto"]["ingredientes_declarados"]
