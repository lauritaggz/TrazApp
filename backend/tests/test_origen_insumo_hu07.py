"""Where the data of a registered supply came from (HU07 / T07-05, D3, CA10, CA15, CA17).

consulta-codigo with the combined source (Open Food Facts + Jumbo, both recorded or faked) ->
POST /gestion/insumos with the proposal -> the supply keeps `ficha["fuentes"]` (what each source
supplied, with the date) and the short `fuente`. A field the productor edited before confirming goes
under «manual». Every request has its own session and the result is read with a brand new one.
Nothing reaches the network.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.api.dependencies import get_fuente_producto
from app.main import app
from app.models import Alergeno, InsumoComercial
from app.services.insumo_fuentes import construir_fuentes
from app.services.recuperacion.combinada import FuenteCombinada
from tests.escenario_hu05 import crear_ingrediente, registrar
from tests.test_fuente_combinada_hu07 import (
    QUILQUE,
    OffFalsa,
    _jumbo,
    _off,
)
from tests.test_registro_desde_codigo_hu13 import (
    CODIGOS_CATALOGO,
    RUTA_CONSULTA,
    _cuerpo_de_la_propuesta,
    _en_utc,
    _iso_a_utc,
)

AHORA = datetime(2026, 11, 5, 12, 0, tzinfo=timezone.utc)
RECUPERADO = datetime(2026, 11, 5, 11, 59, tzinfo=timezone.utc)


@pytest.fixture
def escena(api, fabrica) -> dict:
    headers = registrar(api)
    with fabrica() as sesion:
        sesion.add_all(
            Alergeno(codigo=codigo, nombre=codigo.capitalize(), obligatorio_chile=False)
            for codigo in CODIGOS_CATALOGO
        )
        sesion.commit()
    queso = crear_ingrediente(api, headers, "Queso", "que-001")
    return {"headers": headers, "queso": queso}


def _usar_combinada(**off_extra) -> None:
    fuente = FuenteCombinada(OffFalsa(_off(**off_extra)), _jumbo()[0])
    app.dependency_overrides[get_fuente_producto] = lambda: fuente


def _consultar(api, escena) -> dict:
    respuesta = api.get(f"{RUTA_CONSULTA}/{QUILQUE}", headers=escena["headers"])
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _confirmar(api, escena, consulta: dict, **extra):
    cuerpo = _cuerpo_de_la_propuesta(consulta, escena["queso"]["id"])
    cuerpo["fuentes_campos"] = consulta.get("fuentes_campos")
    # The sources that named the allergens of the proposal.
    cuerpo["fuentes_alergenos"] = sorted(
        {f for a in consulta["alergenos"]["contiene"] + consulta["alergenos"]["trazas"] for f in a["fuentes"]}
    )
    cuerpo["fuentes_por_alergeno"] = {
        a["codigo"]: {"tipo": tipo, "fuentes": a["fuentes"]}
        for tipo, clave in (("contiene", "contiene"), ("traza", "trazas"))
        for a in consulta["alergenos"][clave]
    }
    cuerpo.update(extra)
    return api.post("/gestion/insumos", headers=escena["headers"], json=cuerpo)


def _guardado(fabrica, insumo_id: int) -> InsumoComercial:
    with fabrica() as sesion:
        insumo = sesion.get(InsumoComercial, insumo_id)
        assert insumo is not None
        sesion.expunge(insumo)
        return insumo


def _fuentes(insumo: InsumoComercial) -> dict[str, dict]:
    return {entrada["fuente"]: entrada for entrada in insumo.ficha["fuentes"]}


# --- construir_fuentes: función pura ---


def test_construir_fuentes_agrupa_los_campos_por_fuente_en_orden_canonico() -> None:
    entradas = construir_fuentes(
        {
            "nombre": "open_food_facts",
            "presentacion": "open_food_facts",
            "ingredientes_declarados": "jumbo",
        },
        None,
        ["open_food_facts", "jumbo"],
        RECUPERADO,
        AHORA,
    )
    assert entradas == [
        {
            "fuente": "open_food_facts",
            "fecha": RECUPERADO.isoformat(),
            "campos": ["nombre", "presentacion", "alergenos"],
        },
        {
            "fuente": "jumbo",
            "fecha": RECUPERADO.isoformat(),
            "campos": ["ingredientes_declarados", "alergenos"],
        },
    ]


def test_construir_fuentes_los_alergenos_del_texto_se_atribuyen_a_la_fuente_de_los_ingredientes() -> None:
    entradas = construir_fuentes(
        {"nombre": "open_food_facts", "ingredientes_declarados": "jumbo"}, None, ["ingredientes"], RECUPERADO, AHORA
    )
    assert [(e["fuente"], e["campos"]) for e in entradas] == [
        ("open_food_facts", ["nombre"]),
        ("jumbo", ["ingredientes_declarados", "alergenos"]),
    ]


def test_construir_fuentes_un_campo_editado_pasa_a_manual_con_la_fecha_de_la_confirmacion() -> None:
    entradas = construir_fuentes(
        {"nombre": "open_food_facts", "presentacion": "open_food_facts"}, ["presentacion"], None, RECUPERADO, AHORA
    )
    assert entradas == [
        {"fuente": "open_food_facts", "fecha": RECUPERADO.isoformat(), "campos": ["nombre"]},
        {"fuente": "manual", "fecha": AHORA.isoformat(), "campos": ["presentacion"]},
    ]


def test_construir_fuentes_editar_los_alergenos_los_pasa_a_manual() -> None:
    entradas = construir_fuentes(
        {"nombre": "open_food_facts"}, ["alergenos"], ["open_food_facts", "jumbo"], RECUPERADO, AHORA
    )
    assert [(e["fuente"], e["campos"]) for e in entradas] == [
        ("open_food_facts", ["nombre"]),
        ("manual", ["alergenos"]),
    ]


def test_construir_fuentes_un_campo_que_la_fuente_no_dio_y_el_productor_escribio_es_manual() -> None:
    entradas = construir_fuentes({"nombre": "jumbo"}, ["presentacion"], None, RECUPERADO, AHORA)
    assert [(e["fuente"], e["campos"]) for e in entradas] == [("jumbo", ["nombre"]), ("manual", ["presentacion"])]


# --- PT07-12: el insumo combinado guarda fuentes, fecha y campos ---


def test_el_insumo_combinado_guarda_la_fuente_corta_la_fecha_y_los_campos_de_cada_fuente(
    api, fabrica, escena
) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs",))
    consulta = _consultar(api, escena)

    respuesta = _confirmar(api, escena, consulta)

    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.fuente == "combinada"
    assert _en_utc(insumo.fecha_recuperacion) == _iso_a_utc(consulta["fecha_recuperacion"])
    fuentes = _fuentes(insumo)
    assert set(fuentes) == {"open_food_facts", "jumbo"}
    # Jumbo supplied the ingredients (and, from them, the allergens read in the text).
    assert fuentes["jumbo"]["campos"] == ["ingredientes_declarados", "alergenos"]
    # Open Food Facts supplied the rest and its own allergen labels («huevos»).
    assert fuentes["open_food_facts"]["campos"] == ["nombre", "marca_origen", "presentacion", "alergenos"]
    for entrada in fuentes.values():
        assert _iso_a_utc(entrada["fecha"]) == _iso_a_utc(consulta["fecha_recuperacion"])
    # The record of the source is still there, with Jumbo's inside.
    assert insumo.ficha["url"] == "https://off.test/product/1"
    assert "jumbo" in insumo.ficha


def test_la_respuesta_del_registro_trae_las_fuentes(api, escena) -> None:
    _usar_combinada()
    respuesta = _confirmar(api, escena, _consultar(api, escena))
    assert [e["fuente"] for e in respuesta.json()["ficha"]["fuentes"]] == ["open_food_facts", "jumbo"]


def test_si_jumbo_no_respondio_todo_queda_como_de_open_food_facts(api, fabrica, escena) -> None:
    import httpx

    jumbo, _ = _jumbo(falla=httpx.ConnectError("sin red"))
    fuente = FuenteCombinada(OffFalsa(_off()), jumbo)
    app.dependency_overrides[get_fuente_producto] = lambda: fuente
    consulta = _consultar(api, escena)

    respuesta = _confirmar(api, escena, consulta)

    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.fuente == "open_food_facts"
    assert set(_fuentes(insumo)) == {"open_food_facts"}


# --- campos editados antes de confirmar ---


def test_un_campo_editado_antes_de_confirmar_se_atribuye_a_manual_y_no_a_la_fuente(
    api, fabrica, escena
) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs",))
    consulta = _consultar(api, escena)
    cuerpo_presentacion = {"presentacion": "1 kg", "campos_editados": ["presentacion"]}

    respuesta = _confirmar(api, escena, consulta, **cuerpo_presentacion)

    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.presentacion == "1 kg"
    fuentes = _fuentes(insumo)
    assert fuentes["manual"]["campos"] == ["presentacion"]
    assert "presentacion" not in fuentes["open_food_facts"]["campos"]


def test_editar_los_alergenos_marca_como_manual_lo_que_las_fuentes_dijeron_de_ellos(
    api, fabrica, escena
) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs",))
    consulta = _consultar(api, escena)

    respuesta = _confirmar(api, escena, consulta, campos_editados=["alergenos"])

    fuentes = _fuentes(_guardado(fabrica, respuesta.json()["id"]))
    assert fuentes["manual"]["campos"] == ["alergenos"]
    assert all("alergenos" not in e["campos"] for e in fuentes.values() if e["fuente"] != "manual")


# --- contrato: lo que se rechaza y lo que queda como hoy ---


def test_un_insumo_manual_queda_como_hoy_sin_fuentes(api, fabrica, escena) -> None:
    respuesta = api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json={"ingrediente_id": escena["queso"]["id"], "nombre": "Queso", "marca_origen": "Casero"},
    )
    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.fuente == "manual"
    assert insumo.fecha_recuperacion is None
    assert insumo.ficha is None


@pytest.mark.parametrize(
    "extra",
    [
        {"fuentes_campos": None, "fuentes_alergenos": ["jumbo"]},
        {"fuentes_campos": None, "fuentes_por_alergeno": {"lacteos": {"tipo": "contiene", "fuentes": ["jumbo"]}}},
        {"fuentes_por_alergeno": {"lacteos": {"tipo": "puede", "fuentes": ["jumbo"]}}},
        {"fuentes_por_alergeno": {"lacteos": {"tipo": "contiene", "fuentes": []}}},
        {"fuentes_por_alergeno": {"lacteos": {"tipo": "contiene", "fuentes": ["supermercado_x"]}}},
        {"fuentes_por_alergeno": {"Leche ": {"tipo": "contiene", "fuentes": ["jumbo"]}}},
        {"fuente": "manual", "fecha_recuperacion": None, "fuentes_campos": {"nombre": "jumbo"}},
        {"fuentes_campos": None, "campos_editados": ["nombre"]},
        {"fuentes_campos": {"precio": "jumbo"}},
        {"fuentes_campos": {"nombre": "supermercado_x"}},
        {"fuentes_alergenos": ["supermercado_x"]},
        {"campos_editados": ["precio"]},
    ],
    ids=[
        "alergenos-sin-fuentes",
        "detalle-sin-fuentes",
        "tipo-desconocido",
        "detalle-sin-ninguna-fuente",
        "fuente-de-detalle-desconocida",
        "codigo-invalido",
        "manual-con-fuentes", "editados-sin-fuentes", "campo-desconocido", "fuente-desconocida", "fuente-de-alergeno-desconocida", "editado-desconocido"],
)
def test_rechaza_con_422_lo_que_no_tiene_sentido(api, escena, extra) -> None:
    _usar_combinada()
    consulta = _consultar(api, escena)
    assert _confirmar(api, escena, consulta, **extra).status_code == 422


def test_un_insumo_de_una_sola_fuente_sin_fuentes_campos_no_cambia(api, fabrica, escena) -> None:
    """HU13: quien no manda fuentes_campos sigue guardando la ficha tal cual."""
    _usar_combinada()
    consulta = _consultar(api, escena)

    respuesta = _confirmar(api, escena, consulta, fuentes_campos=None, fuentes_alergenos=None, fuentes_por_alergeno=None)

    assert respuesta.status_code == 201, respuesta.text
    assert "fuentes" not in _guardado(fabrica, respuesta.json()["id"]).ficha


# --- PT07-11: consultar y no confirmar no escribe nada ---


def _contar_insumos(fabrica) -> int:
    with fabrica() as sesion:
        return sesion.scalar(select(func.count()).select_from(InsumoComercial))


def test_consultar_sin_confirmar_no_escribe_nada(api, fabrica, escena) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs",))
    antes = _contar_insumos(fabrica)

    consulta = _consultar(api, escena)
    _consultar(api, escena)

    assert consulta["fuente"] == "combinada"
    assert antes == 0
    assert _contar_insumos(fabrica) == 0
    # Nor does a lookup that finds nothing.
    app.dependency_overrides[get_fuente_producto] = lambda: FuenteCombinada(OffFalsa(None), _jumbo()[0])
    assert _consultar(api, escena)["encontrado"] is False
    assert _contar_insumos(fabrica) == 0


# --- detalle por alérgeno (ficha["fuentes_por_alergeno"]) ---


def test_un_alergeno_con_dos_fuentes_las_guarda_y_la_traza_de_otra_no_se_lista(api, fabrica, escena) -> None:
    # La leche: OFF la declara «contiene» y también está en el texto de los ingredientes.
    _usar_combinada(etiquetas_alergenos=("en:milk",))
    consulta = _consultar(api, escena)
    leche = next(a for a in consulta["alergenos"]["contiene"] if a["codigo"] == "lacteos")
    assert leche["fuentes"] == ["open_food_facts", "ingredientes"]

    respuesta = _confirmar(api, escena, consulta)

    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.ficha["fuentes_por_alergeno"]["lacteos"] == {
        "tipo": "contiene",
        "fuentes": ["open_food_facts", "ingredientes"],
    }
    # ficha["fuentes"] sigue diciendo solo que la fuente aportó «alergenos».
    assert "alergenos" in _fuentes(insumo)["open_food_facts"]["campos"]


def test_un_alergeno_distinto_conserva_sus_propias_fuentes_y_no_la_union(api, fabrica, escena) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs", "en:milk"))
    consulta = _consultar(api, escena)

    respuesta = _confirmar(api, escena, consulta)

    por_alergeno = _guardado(fabrica, respuesta.json()["id"]).ficha["fuentes_por_alergeno"]
    assert por_alergeno["huevos"]["fuentes"] == ["open_food_facts"]
    assert por_alergeno["lacteos"]["fuentes"] == ["open_food_facts", "ingredientes"]


def test_un_alergeno_agregado_a_mano_queda_como_manual(api, fabrica, escena) -> None:
    _usar_combinada(etiquetas_alergenos=("en:eggs",))
    consulta = _consultar(api, escena)
    with fabrica() as sesion:
        soja = sesion.scalar(select(Alergeno.id).where(Alergeno.codigo == "soja"))
    cuerpo = _cuerpo_de_la_propuesta(consulta, escena["queso"]["id"])
    cuerpo["fuentes_campos"] = consulta["fuentes_campos"]
    cuerpo["campos_editados"] = ["alergenos"]
    cuerpo["alergenos"].append({"alergeno_id": soja, "tipo": "contiene"})
    cuerpo["fuentes_por_alergeno"] = {
        "huevos": {"tipo": "contiene", "fuentes": ["open_food_facts"]},
        "soja": {"tipo": "contiene", "fuentes": ["manual"]},
    }

    respuesta = api.post("/gestion/insumos", headers=escena["headers"], json=cuerpo)

    assert respuesta.status_code == 201, respuesta.text
    insumo = _guardado(fabrica, respuesta.json()["id"])
    assert insumo.ficha["fuentes_por_alergeno"]["soja"] == {"tipo": "contiene", "fuentes": ["manual"]}
    assert insumo.ficha["fuentes_por_alergeno"]["huevos"]["fuentes"] == ["open_food_facts"]
    assert _fuentes(insumo)["manual"]["campos"] == ["alergenos"]
