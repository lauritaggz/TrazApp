"""Allergen detection over the recorded Open Food Facts answers, and through the endpoint (T13-04).

The answers come from tests/fixtures/off (recorded once, never fetched again): nothing here reaches
the network.
"""

import json
from pathlib import Path

import httpx
import pytest

from app.api.dependencies import get_fuente_producto
from app.core.config import Settings
from app.main import app
from app.models import Alergeno
from app.services.recuperacion.alergenos import ORIGEN_ETIQUETA, ORIGEN_TEXTO, detectar_alergenos
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente

FIXTURES = Path(__file__).parent / "fixtures" / "off"

LECHE_SIN_LACTOSA = "7802910000971"
GALLETA_TRITON = "8445291716841"
LECHE_ENTERA = "7808709504767"
AZUCAR_FLOR = "7801505231974"
AZUCAR_RUBIA = "7801505231950"
ATUN_UPC_A = "400001143070"
ACEITE_DE_GIRASOL = "7790272001005"
POLVOS_DE_HORNEAR = "7802410002239"
BICARBONATO = "8413700064197"
SIN_NOMBRE = "7803600002053"

# The 14 allergens of the catalog (migration 009); ids are arbitrary in the test database.
CATALOGO = [
    ("gluten", "Gluten", True),
    ("crustaceos", "Crustáceos", True),
    ("huevos", "Huevo", True),
    ("pescado", "Pescado", True),
    ("cacahuetes", "Maní", True),
    ("soja", "Soya", True),
    ("lacteos", "Leche", True),
    ("frutos_cascara", "Nueces", True),
    ("sulfitos", "Sulfitos", True),
    ("apio", "Apio", False),
    ("mostaza", "Mostaza", False),
    ("sesamo", "Sésamo", False),
    ("altramuces", "Altramuces", False),
    ("moluscos", "Moluscos", False),
]


def _transporte(respuestas: dict[str, dict]) -> httpx.MockTransport:
    def responder(request: httpx.Request) -> httpx.Response:
        codigo = request.url.path.rsplit("/", 1)[1].removesuffix(".json")
        grabada = respuestas[codigo]
        return httpx.Response(grabada["http_status"], json=grabada["body"])

    return httpx.MockTransport(responder)


def _grabada(codigo: str) -> dict:
    return json.loads((FIXTURES / f"{codigo}.json").read_text(encoding="utf-8"))


def _fuente_con_fixture(codigo: str) -> OpenFoodFactsFuente:
    return OpenFoodFactsFuente(
        Settings(_env_file=None), transport=_transporte({codigo: _grabada(codigo)})
    )


def _fuente_con_producto(codigo: str, **producto) -> OpenFoodFactsFuente:
    cuerpo = {"http_status": 200, "body": {"code": codigo, "status": 1, "product": producto}}
    return OpenFoodFactsFuente(Settings(_env_file=None), transport=_transporte({codigo: cuerpo}))


def _detectar_de(codigo: str):
    producto = _fuente_con_fixture(codigo).buscar(codigo)
    assert producto is not None
    return detectar_alergenos(
        producto.etiquetas_alergenos, producto.etiquetas_trazas, producto.ingredientes
    )


def _pares(items) -> list[tuple[str, str]]:
    return [(item.codigo, item.origen) for item in items]


# --- the recorded products ---


def test_loncoleche_sin_lactosa_trae_leche_desde_el_texto_aunque_la_fuente_no_la_etiquete() -> None:
    deteccion = _detectar_de(LECHE_SIN_LACTOSA)

    assert _pares(deteccion.contiene) == [("lacteos", ORIGEN_TEXTO)]
    assert deteccion.trazas == ()
    assert deteccion.sin_reconocer == ()


def test_leche_entera_trae_leche_desde_el_texto() -> None:
    deteccion = _detectar_de(LECHE_ENTERA)

    assert _pares(deteccion.contiene) == [("lacteos", ORIGEN_TEXTO)]
    assert deteccion.trazas == ()


def test_galleta_triton_trae_gluten_y_soya_de_la_etiqueta() -> None:
    deteccion = _detectar_de(GALLETA_TRITON)

    assert _pares(deteccion.contiene) == [("gluten", ORIGEN_ETIQUETA), ("soja", ORIGEN_ETIQUETA)]
    assert deteccion.trazas == ()
    assert deteccion.sin_reconocer == ()


def test_aceite_de_girasol_contiene_la_soja_etiquetada_y_el_mani_es_traza() -> None:
    # The text says «puede contener soja»; the source also labels soy as «allergens»: contains wins.
    deteccion = _detectar_de(ACEITE_DE_GIRASOL)

    assert _pares(deteccion.contiene) == [("soja", ORIGEN_ETIQUETA)]
    assert _pares(deteccion.trazas) == [("cacahuetes", ORIGEN_ETIQUETA)]
    assert deteccion.sin_reconocer == ()


def test_azucar_flor_no_tiene_alergenos_pese_a_la_direccion_del_fabricante() -> None:
    producto = _fuente_con_fixture(AZUCAR_FLOR).buscar(AZUCAR_FLOR)
    assert producto is not None and producto.ingredientes is not None
    # The recorded text carries the maker's company name and address.
    assert "Las Condes" in producto.ingredientes

    deteccion = _detectar_de(AZUCAR_FLOR)

    assert (deteccion.contiene, deteccion.trazas, deteccion.sin_reconocer) == ((), (), ())


@pytest.mark.parametrize(
    "codigo",
    [AZUCAR_RUBIA, POLVOS_DE_HORNEAR, ATUN_UPC_A, BICARBONATO, SIN_NOMBRE],
    ids=["azucar-rubia", "polvos-de-hornear", "atun", "bicarbonato", "sin-nombre"],
)
def test_los_productos_sin_alergenos_ni_ingredientes_utiles_no_sugieren_nada(codigo) -> None:
    deteccion = _detectar_de(codigo)

    assert (deteccion.contiene, deteccion.trazas, deteccion.sin_reconocer) == ((), (), ())


def test_los_productos_sin_ingredientes_no_fallan() -> None:
    for codigo in (AZUCAR_RUBIA, POLVOS_DE_HORNEAR):
        producto = _fuente_con_fixture(codigo).buscar(codigo)
        assert producto is not None and producto.ingredientes is None
        assert detectar_alergenos((), (), producto.ingredientes).contiene == ()


# --- the endpoint ---


@pytest.fixture
def ana(client) -> dict[str, str]:
    assert (
        client.post(
            "/auth/register",
            json={
                "nombre": "Productora A",
                "nombre_negocio": "Panaderia A",
                "email": "productora.alergenos.hu13@ejemplo.com",
                "password": "SecretoProductor123!",
            },
        ).status_code
        == 201
    )
    login = client.post(
        "/auth/login",
        json={"email": "productora.alergenos.hu13@ejemplo.com", "password": "SecretoProductor123!"},
    )
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def catalogo(db_session) -> dict[str, Alergeno]:
    filas = {
        codigo: Alergeno(codigo=codigo, nombre=nombre, obligatorio_chile=obligatorio)
        for codigo, nombre, obligatorio in CATALOGO
    }
    db_session.add_all(filas.values())
    db_session.commit()
    return filas


def _consultar(client, headers, codigo: str) -> dict:
    response = client.get(f"/gestion/insumos/consulta-codigo/{codigo}", headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _con_fuente(fuente: OpenFoodFactsFuente) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: fuente


def test_el_endpoint_devuelve_los_alergenos_detectados_con_su_id_nombre_y_origen(
    client, ana, catalogo
) -> None:
    _con_fuente(_fuente_con_fixture(LECHE_SIN_LACTOSA))

    alergenos = _consultar(client, ana, LECHE_SIN_LACTOSA)["alergenos"]

    assert alergenos == {
        "contiene": [
            {
                "alergeno_id": catalogo["lacteos"].id,
                "codigo": "lacteos",
                "nombre": "Leche",
                "origen": "texto",
            }
        ],
        "trazas": [],
        "sin_reconocer": [],
    }


def test_el_endpoint_distingue_contiene_de_trazas_y_el_origen_etiqueta(client, ana, catalogo) -> None:
    _con_fuente(_fuente_con_fixture(ACEITE_DE_GIRASOL))

    alergenos = _consultar(client, ana, ACEITE_DE_GIRASOL)["alergenos"]

    assert [(a["codigo"], a["origen"]) for a in alergenos["contiene"]] == [("soja", "etiqueta")]
    assert [(a["codigo"], a["origen"], a["nombre"]) for a in alergenos["trazas"]] == [
        ("cacahuetes", "etiqueta", "Maní")
    ]


def test_el_endpoint_de_triton_trae_gluten_y_soya(client, ana, catalogo) -> None:
    _con_fuente(_fuente_con_fixture(GALLETA_TRITON))

    alergenos = _consultar(client, ana, GALLETA_TRITON)["alergenos"]

    assert [(a["codigo"], a["alergeno_id"]) for a in alergenos["contiene"]] == [
        ("gluten", catalogo["gluten"].id),
        ("soja", catalogo["soja"].id),
    ]


def test_el_endpoint_sin_alergenos_devuelve_la_estructura_vacia(client, ana, catalogo) -> None:
    _con_fuente(_fuente_con_fixture(AZUCAR_FLOR))

    assert _consultar(client, ana, AZUCAR_FLOR)["alergenos"] == {
        "contiene": [],
        "trazas": [],
        "sin_reconocer": [],
    }


def test_el_endpoint_envia_lo_no_reconocible_a_asignacion_manual(client, ana, catalogo) -> None:
    _con_fuente(
        _fuente_con_producto(
            LECHE_ENTERA,
            product_name="Postre vegetal",
            ingredients_text="Leche de coco, harina, azúcar.",
            allergens_tags=["en:tree-nuts", "en:milk"],
        )
    )

    alergenos = _consultar(client, ana, LECHE_ENTERA)["alergenos"]

    assert [a["codigo"] for a in alergenos["contiene"]] == ["lacteos"]
    # «Leche de coco» is dropped from the doubts: milk is already suggested from the label.
    assert alergenos["sin_reconocer"] == ["en:tree-nuts", "harina"]


def test_el_endpoint_no_sugiere_un_alergeno_que_falta_en_el_catalogo(client, ana, db_session) -> None:
    # Only «lacteos» exists in this database; «soja» cannot be suggested and goes to manual assignment.
    db_session.add(Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True))
    db_session.commit()
    _con_fuente(_fuente_con_producto(LECHE_ENTERA, ingredients_text="Leche y soya.", allergens_tags=[]))

    alergenos = _consultar(client, ana, LECHE_ENTERA)["alergenos"]

    assert [a["codigo"] for a in alergenos["contiene"]] == ["lacteos"]
    assert alergenos["sin_reconocer"] == ["soja"]
