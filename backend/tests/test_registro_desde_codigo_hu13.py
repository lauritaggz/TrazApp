"""From the barcode lookup to a registered supply, end to end (T13-06 / HU13, CA11).

consulta-codigo (with a recorded Open Food Facts answer) -> POST /gestion/insumos with the data of the
proposal -> the supply keeps its barcode, its source, when it was retrieved, the source's data record
and its reviewed allergens. Every request has its own session and the result is read with a brand new
one (fixtures `api` and `fabrica` of conftest.py), so a missing `commit` is detected. The source is
the recorded answers of tests/fixtures/off: nothing reaches the network.
"""

import json
from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest
from sqlalchemy import func, select

from app.api.dependencies import get_fuente_producto
from app.core.config import Settings
from app.main import app
from app.models import Alergeno, InsumoComercial, UsoInsumo
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente
from tests.escenario_hu05 import (
    crear_elaboracion,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    registrar,
)

FIXTURES = Path(__file__).parent / "fixtures" / "off"
LECHE_SIN_LACTOSA = "7802910000971"
GALLETA_TRITON = "8445291716841"
ACEITE_DE_GIRASOL = "7790272001005"
RUTA_CONSULTA = "/gestion/insumos/consulta-codigo"

# The 14 allergens of the catalog (the test schema has no seed).
CODIGOS_CATALOGO = [
    "gluten", "crustaceos", "huevos", "pescado", "cacahuetes", "soja", "lacteos",
    "frutos_cascara", "sulfitos", "apio", "mostaza", "sesamo", "altramuces", "moluscos",
]  # fmt: skip


def _en_utc(fecha: datetime) -> datetime:
    """SQLite returns the date without its zone, PostgreSQL with it; both are UTC."""
    return fecha.replace(tzinfo=timezone.utc) if fecha.tzinfo is None else fecha.astimezone(timezone.utc)


def _iso_a_utc(texto: str) -> datetime:
    return _en_utc(datetime.fromisoformat(texto.replace("Z", "+00:00")))


def _usar_fixture(*codigos: str) -> None:
    """The lookup reads the recorded answers; asking for anything else fails the test."""
    grabadas = {codigo: json.loads((FIXTURES / f"{codigo}.json").read_text(encoding="utf-8")) for codigo in codigos}

    def responder(request: httpx.Request) -> httpx.Response:
        codigo = request.url.path.rsplit("/", 1)[1].removesuffix(".json")
        grabada = grabadas[codigo]
        return httpx.Response(grabada["http_status"], json=grabada["body"])

    fuente = OpenFoodFactsFuente(Settings(_env_file=None), transport=httpx.MockTransport(responder))
    app.dependency_overrides[get_fuente_producto] = lambda: fuente


@pytest.fixture
def escena(api, fabrica) -> dict:
    headers = registrar(api)
    with fabrica() as sesion:
        catalogo = {
            codigo: Alergeno(codigo=codigo, nombre=codigo.capitalize(), obligatorio_chile=False)
            for codigo in CODIGOS_CATALOGO
        }
        sesion.add_all(catalogo.values())
        sesion.commit()
        ids = {codigo: fila.id for codigo, fila in catalogo.items()}
    leche = crear_ingrediente(api, headers, "Leche", "lec-001")
    harina = crear_ingrediente(api, headers, "Harina", "har-001")
    return {"headers": headers, "leche": leche, "harina": harina, "alergenos": ids}


def _consultar(api, escena, codigo: str) -> dict:
    respuesta = api.get(f"{RUTA_CONSULTA}/{codigo}", headers=escena["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _cuerpo_de_la_propuesta(consulta: dict, ingrediente_id: int) -> dict:
    """What the frontend sends when the productor confirms the proposal without changing it."""
    producto = consulta["producto"]
    alergenos = [{"alergeno_id": a["alergeno_id"], "tipo": "contiene"} for a in consulta["alergenos"]["contiene"]]
    alergenos += [{"alergeno_id": a["alergeno_id"], "tipo": "trazas"} for a in consulta["alergenos"]["trazas"]]
    return {
        "ingrediente_id": ingrediente_id,
        "nombre": producto["nombre"],
        "marca_origen": producto["marca_origen"] or "Sin marca",
        "presentacion": producto["presentacion"],
        "codigo_barras": consulta["codigo_barras"],
        "ingredientes_declarados": producto["ingredientes_declarados"],
        "fuente": consulta["fuente"],
        "fecha_recuperacion": consulta["fecha_recuperacion"],
        "ficha": consulta["ficha"],
        "alergenos": alergenos,
    }


def _registrar_desde_codigo(api, escena, codigo: str, ingrediente: str = "leche") -> tuple[dict, dict]:
    _usar_fixture(codigo)
    consulta = _consultar(api, escena, codigo)
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json=_cuerpo_de_la_propuesta(consulta, escena[ingrediente]["id"]),
    )
    assert respuesta.status_code == 201, respuesta.text
    return consulta, respuesta.json()


def _leer(fabrica, insumo_id: int) -> dict:
    """The supply as a brand new session sees it."""
    with fabrica() as sesion:
        insumo = sesion.get(InsumoComercial, insumo_id)
        assert insumo is not None
        return {
            "codigo_barras": insumo.codigo_barras,
            "fuente": insumo.fuente,
            "fecha_recuperacion": insumo.fecha_recuperacion,
            "ficha": insumo.ficha,
            "revisado_at": insumo.alergenos_revisados_at,
            "alergenos": sorted(
                (declarado.alergeno.codigo, declarado.tipo) for declarado in insumo.alergenos_declarados
            ),
        }


# --- CA11: el código, la fuente, la fecha y la ficha quedan registrados ------------------


def test_el_insumo_recuperado_guarda_codigo_fuente_fecha_ficha_y_alergenos_revisados(api, fabrica, escena) -> None:
    consulta, creado = _registrar_desde_codigo(api, escena, LECHE_SIN_LACTOSA)

    guardado = _leer(fabrica, creado["id"])

    assert guardado["codigo_barras"] == LECHE_SIN_LACTOSA
    assert guardado["fuente"] == "open_food_facts"
    assert _en_utc(guardado["fecha_recuperacion"]) == _iso_a_utc(consulta["fecha_recuperacion"])
    # The raw record of the source, with the page of the product in it.
    assert guardado["ficha"]["url"] == f"https://world.openfoodfacts.org/product/{LECHE_SIN_LACTOSA}"
    assert guardado["ficha"]["product_name"] == "LONCO LECHE SIN LACTOSA"
    # Saving the proposal reviews the allergens (HT06): it was not reviewed by being suggested.
    assert guardado["revisado_at"] is not None
    assert guardado["alergenos"] == [("lacteos", "contiene")]


def test_la_respuesta_del_registro_tambien_trae_el_origen(api, escena) -> None:
    consulta, creado = _registrar_desde_codigo(api, escena, LECHE_SIN_LACTOSA)

    assert creado["codigo_barras"] == LECHE_SIN_LACTOSA
    assert creado["fuente"] == "open_food_facts"
    assert _iso_a_utc(creado["fecha_recuperacion"]) == _iso_a_utc(consulta["fecha_recuperacion"])
    assert creado["ficha"]["url"].endswith(f"/product/{LECHE_SIN_LACTOSA}")
    assert creado["alergenos_revisados"] is True


@pytest.mark.parametrize(
    ("codigo", "esperados"),
    [
        (LECHE_SIN_LACTOSA, [("lacteos", "contiene")]),
        (GALLETA_TRITON, [("gluten", "contiene"), ("soja", "contiene")]),
        (ACEITE_DE_GIRASOL, [("cacahuetes", "trazas"), ("soja", "contiene")]),
    ],
    ids=["leche-por-texto", "triton-por-etiqueta", "aceite-contiene-y-trazas"],
)
def test_los_alergenos_de_la_propuesta_se_guardan_con_su_tipo(api, fabrica, escena, codigo, esperados) -> None:
    _, creado = _registrar_desde_codigo(api, escena, codigo, ingrediente="harina")

    guardado = _leer(fabrica, creado["id"])

    assert guardado["alergenos"] == esperados
    assert guardado["revisado_at"] is not None
    assert guardado["fuente"] == "open_food_facts"


def test_consultar_el_codigo_ya_registrado_responde_409_con_el_insumo_nuevo(api, escena) -> None:
    _, creado = _registrar_desde_codigo(api, escena, LECHE_SIN_LACTOSA)

    respuesta = api.get(f"{RUTA_CONSULTA}/{LECHE_SIN_LACTOSA}", headers=escena["headers"])

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"]["insumo_id"] == creado["id"]


def test_consultar_no_registra_nada(api, fabrica, escena) -> None:
    _usar_fixture(LECHE_SIN_LACTOSA)

    _consultar(api, escena, LECHE_SIN_LACTOSA)

    with fabrica() as sesion:
        assert sesion.scalar(select(func.count()).select_from(InsumoComercial)) == 0


# --- los registros manuales siguen siendo manuales ---------------------------------------


def test_un_insumo_manual_queda_con_fuente_manual_sin_fecha_ni_ficha(api, fabrica, escena) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Leche del campo", codigo_barras=LECHE_SIN_LACTOSA)

    guardado = _leer(fabrica, creado["id"])

    assert guardado["fuente"] == "manual"
    assert guardado["fecha_recuperacion"] is None
    assert guardado["ficha"] is None
    assert guardado["codigo_barras"] == LECHE_SIN_LACTOSA


def test_un_insumo_manual_sin_alergenos_declarados_queda_sin_revisar(api, fabrica, escena) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Sin revisar", revisado=False)

    assert _leer(fabrica, creado["id"])["revisado_at"] is None


# --- POST /gestion/insumos: una fuente externa exige la fecha (422) ----------------------


def _cuerpo(escena, **extra) -> dict:
    return {
        "ingrediente_id": escena["leche"]["id"],
        "nombre": "Leche con fuente",
        "marca_origen": "Colun",
        **extra,
    }


def _insumos_guardados(fabrica) -> int:
    with fabrica() as sesion:
        return sesion.scalar(select(func.count()).select_from(InsumoComercial))


def test_fuente_externa_sin_fecha_responde_422_con_el_campo_y_no_guarda_nada(api, fabrica, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json=_cuerpo(escena, fuente="open_food_facts", ficha={"url": "https://fuente.ejemplo.test/p/1"}),
    )

    assert respuesta.status_code == 422
    detalle = respuesta.json()["detail"]
    assert detalle["campo"] == "fecha_recuperacion"
    assert "fecha de recuperación" in detalle["mensaje"]
    assert set(detalle) == {"mensaje", "campo"}
    assert _insumos_guardados(fabrica) == 0


def test_fuente_externa_con_la_fecha_nula_tambien_responde_422(api, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json=_cuerpo(escena, fuente="open_food_facts", fecha_recuperacion=None),
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"]["campo"] == "fecha_recuperacion"


def test_fuente_externa_con_fecha_se_acepta(api, fabrica, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json=_cuerpo(escena, fuente="open_food_facts", fecha_recuperacion="2026-10-19T15:00:00Z"),
    )

    assert respuesta.status_code == 201, respuesta.text
    assert _leer(fabrica, respuesta.json()["id"])["fuente"] == "open_food_facts"


@pytest.mark.parametrize(
    "extra",
    [{}, {"fuente": "manual"}, {"fuente": "manual", "fecha_recuperacion": "2026-10-19T15:00:00Z"}],
    ids=["sin-fuente", "manual", "manual-con-fecha"],
)
def test_una_fuente_manual_no_exige_fecha(api, escena, extra) -> None:
    respuesta = api.post("/gestion/insumos", headers=escena["headers"], json=_cuerpo(escena, **extra))

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["fuente"] == "manual"


def test_una_fuente_desconocida_sigue_siendo_422(api, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json=_cuerpo(escena, fuente="upcitemdb", fecha_recuperacion="2026-10-19T15:00:00Z"),
    )

    assert respuesta.status_code == 422


# --- la información conservada de la elaboración guarda el código de barras --------------


def _elaboracion_con(api, escena, insumo_leche: dict) -> int:
    producto = crear_producto(api, escena["headers"])
    formular(api, escena["headers"], producto["id"], escena["harina"], escena["leche"])
    insumo_harina = crear_insumo(api, escena["headers"], escena["harina"]["id"], "Harina Selecta 1 kg")
    elaboracion = crear_elaboracion(api, escena["headers"], producto["id"]).json()
    usos = api.put(
        f"/gestion/elaboraciones/{elaboracion['id']}/usos",
        headers=escena["headers"],
        json={
            "usos": [
                {"ingrediente_id": escena["harina"]["id"], "insumo_id": insumo_harina["id"], "lote": {"tipo": "sin_lote"}},
                {
                    "ingrediente_id": escena["leche"]["id"],
                    "insumo_id": insumo_leche["id"],
                    "lote": {"tipo": "nuevo", "codigo": "X123", "fecha_vencimiento": "2026-10-15"},
                },
            ]
        },
    )
    assert usos.status_code == 200, usos.text
    return elaboracion["id"]


def _copia_de_la_leche(fabrica, elaboracion_id: int, ingrediente_id: int) -> dict:
    with fabrica() as sesion:
        uso = sesion.scalars(
            select(UsoInsumo).where(
                UsoInsumo.elaboracion_id == elaboracion_id, UsoInsumo.ingrediente_id == ingrediente_id
            )
        ).one()
        return uso.informacion_conservada


def test_al_finalizar_la_copia_conserva_el_codigo_de_barras_del_insumo_recuperado(api, fabrica, escena) -> None:
    _, recuperado = _registrar_desde_codigo(api, escena, LECHE_SIN_LACTOSA)
    elaboracion_id = _elaboracion_con(api, escena, recuperado)

    finalizada = api.post(f"/gestion/elaboraciones/{elaboracion_id}/finalizar", headers=escena["headers"])

    assert finalizada.status_code == 200, finalizada.text
    copia = _copia_de_la_leche(fabrica, elaboracion_id, escena["leche"]["id"])
    assert copia["insumo"]["codigo_barras"] == LECHE_SIN_LACTOSA
    assert copia["insumo"]["id"] == recuperado["id"]
    assert copia["insumo"]["nombre"] == "LONCO LECHE SIN LACTOSA"
    assert copia["insumo"]["ingredientes_declarados"] == recuperado["ingredientes_declarados"]
    assert [(a["codigo"], a["tipo"]) for a in copia["alergenos"]] == [("lacteos", "contiene")]
    # The raw record of the source is not part of what is conserved.
    assert "ficha" not in copia["insumo"] and "fuente" not in copia["insumo"]
    assert "fecha_recuperacion" not in copia["insumo"]


def test_cambiar_el_insumo_recuperado_despues_no_altera_la_copia(api, fabrica, escena) -> None:
    _, recuperado = _registrar_desde_codigo(api, escena, LECHE_SIN_LACTOSA)
    elaboracion_id = _elaboracion_con(api, escena, recuperado)
    assert api.post(f"/gestion/elaboraciones/{elaboracion_id}/finalizar", headers=escena["headers"]).status_code == 200
    antes = _copia_de_la_leche(fabrica, elaboracion_id, escena["leche"]["id"])

    cambio = api.patch(
        f"/gestion/insumos/{recuperado['id']}",
        headers=escena["headers"],
        json={"nombre": "Otro nombre", "codigo_barras": "4006381333931"},
    )
    assert cambio.status_code == 200, cambio.text
    assert api.delete(f"/gestion/insumos/{recuperado['id']}", headers=escena["headers"]).status_code == 204

    despues = _copia_de_la_leche(fabrica, elaboracion_id, escena["leche"]["id"])
    assert despues == antes
    assert despues["insumo"]["codigo_barras"] == LECHE_SIN_LACTOSA
