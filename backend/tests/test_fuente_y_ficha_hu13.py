"""The source and the data record of a supply, on creation AND on update (T13-06 / HU13, CA11).

Two rules, the same on POST and PATCH of /gestion/insumos:
- a supply from an external source needs the date it was retrieved (422 `{"mensaje", "campo":
  "fecha_recuperacion"}`); judged on the FINAL result of an update;
- if the data record carries a `url`, it must be an http or https address (422 `{"mensaje", "campo":
  "ficha"}`), because the productor opens it as a link.
Every request has its own session and the result is read with a brand new one (fixtures `api` and
`fabrica` of conftest.py).
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import func, select

from app.models import InsumoComercial, Productor
from tests.escenario_hu05 import crear_ingrediente, crear_insumo, registrar

FECHA = "2026-10-19T15:00:00Z"
URL_BUENA = "https://fuente.ejemplo.test/producto/7802910000971"


@pytest.fixture
def escena(api) -> dict:
    headers = registrar(api)
    return {"headers": headers, "leche": crear_ingrediente(api, headers, "Leche", "lec-001")}


def _post(api, escena, **extra):
    return api.post(
        "/gestion/insumos",
        headers=escena["headers"],
        json={"ingrediente_id": escena["leche"]["id"], "nombre": "Leche", "marca_origen": "Colun", **extra},
    )


def _patch(api, escena, insumo_id: int, **cambios):
    return api.patch(f"/gestion/insumos/{insumo_id}", headers=escena["headers"], json=cambios)


def _leer(fabrica, insumo_id: int) -> InsumoComercial:
    with fabrica() as sesion:
        insumo = sesion.get(InsumoComercial, insumo_id)
        assert insumo is not None
        sesion.expunge(insumo)
        return insumo


def _cuantos(fabrica) -> int:
    with fabrica() as sesion:
        return sesion.scalar(select(func.count()).select_from(InsumoComercial))


def _en_utc(fecha: datetime) -> datetime:
    return fecha.replace(tzinfo=timezone.utc) if fecha.tzinfo is None else fecha.astimezone(timezone.utc)


def _es_error_de_campo(respuesta, campo: str) -> None:
    assert respuesta.status_code == 422, respuesta.text
    detalle = respuesta.json()["detail"]
    assert set(detalle) == {"mensaje", "campo"}
    assert detalle["campo"] == campo
    assert detalle["mensaje"]


# =============================================================================================
# PATCH: a source needs a date, judged on the final result
# =============================================================================================


def test_patch_que_pone_una_fuente_externa_sin_fecha_responde_422_y_no_cambia_nada(api, fabrica, escena) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Leche manual")

    respuesta = _patch(api, escena, creado["id"], fuente="open_food_facts")

    _es_error_de_campo(respuesta, "fecha_recuperacion")
    guardado = _leer(fabrica, creado["id"])
    assert (guardado.fuente, guardado.fecha_recuperacion) == ("manual", None)


def test_patch_que_pone_la_fuente_con_su_fecha_en_el_mismo_pedido_se_acepta(api, fabrica, escena) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Leche manual")

    respuesta = _patch(api, escena, creado["id"], fuente="open_food_facts", fecha_recuperacion=FECHA)

    assert respuesta.status_code == 200, respuesta.text
    guardado = _leer(fabrica, creado["id"])
    assert guardado.fuente == "open_food_facts"
    assert _en_utc(guardado.fecha_recuperacion) == _en_utc(datetime.fromisoformat(FECHA.replace("Z", "+00:00")))


def test_patch_que_pone_la_fuente_cuando_ya_tenia_fecha_guardada_se_acepta(api, escena) -> None:
    # The result is judged, not the request: the date it already had counts.
    creado = crear_insumo(
        api, escena["headers"], escena["leche"]["id"], "Leche manual con fecha", fecha_recuperacion=FECHA
    )

    respuesta = _patch(api, escena, creado["id"], fuente="open_food_facts")

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["fuente"] == "open_food_facts"


def test_patch_que_quita_la_fecha_de_un_insumo_recuperado_responde_422(api, fabrica, escena) -> None:
    creado = crear_insumo(
        api, escena["headers"], escena["leche"]["id"], "Leche recuperada", fuente="open_food_facts", fecha_recuperacion=FECHA
    )

    respuesta = _patch(api, escena, creado["id"], fecha_recuperacion=None)

    _es_error_de_campo(respuesta, "fecha_recuperacion")
    assert _leer(fabrica, creado["id"]).fecha_recuperacion is not None


def test_patch_que_cambia_la_fecha_de_un_insumo_recuperado_se_acepta(api, escena) -> None:
    creado = crear_insumo(
        api, escena["headers"], escena["leche"]["id"], "Leche recuperada", fuente="open_food_facts", fecha_recuperacion=FECHA
    )

    respuesta = _patch(api, escena, creado["id"], fecha_recuperacion="2026-10-20T10:00:00Z")

    assert respuesta.status_code == 200, respuesta.text


def test_patch_que_vuelve_un_insumo_a_manual_sin_fecha_se_acepta(api, escena) -> None:
    creado = crear_insumo(
        api, escena["headers"], escena["leche"]["id"], "Leche recuperada", fuente="open_food_facts", fecha_recuperacion=FECHA
    )

    respuesta = _patch(api, escena, creado["id"], fuente="manual", fecha_recuperacion=None)

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["fuente"] == "manual"


def test_patch_de_otros_campos_de_un_insumo_recuperado_no_exige_nada(api, escena) -> None:
    creado = crear_insumo(
        api, escena["headers"], escena["leche"]["id"], "Leche recuperada", fuente="open_food_facts", fecha_recuperacion=FECHA
    )

    respuesta = _patch(api, escena, creado["id"], nombre="Otro nombre")

    assert respuesta.status_code == 200, respuesta.text


def test_un_registro_anterior_a_la_regla_se_puede_seguir_editando_en_otros_campos(api, fabrica, escena) -> None:
    # Created straight in the database: a source without a date, as could exist before the rule.
    with fabrica() as sesion:
        antiguo = InsumoComercial(
            productor_id=sesion.scalar(select(Productor.id)), ingrediente_id=escena["leche"]["id"], nombre="Antiguo", marca_origen="M", fuente="open_food_facts"
        )
        sesion.add(antiguo)
        sesion.commit()
        antiguo_id = antiguo.id

    editar_otro_campo = _patch(api, escena, antiguo_id, nombre="Antiguo editado")
    tocar_la_fuente = _patch(api, escena, antiguo_id, fuente="open_food_facts")
    ponerle_fecha = _patch(api, escena, antiguo_id, fecha_recuperacion=FECHA)

    assert editar_otro_campo.status_code == 200, editar_otro_campo.text
    _es_error_de_campo(tocar_la_fuente, "fecha_recuperacion")
    assert ponerle_fecha.status_code == 200, ponerle_fecha.text


def test_patch_de_un_insumo_ajeno_sigue_siendo_404(api, escena) -> None:
    respuesta = _patch(api, escena, 99999, fuente="open_food_facts")

    assert respuesta.status_code == 404


# =============================================================================================
# POST y PATCH: la dirección de la ficha solo puede ser http o https
# =============================================================================================

DIRECCIONES_NO_VALIDAS = [
    pytest.param("javascript:alert(1)", id="javascript"),
    pytest.param("JaVaScRiPt:alert(1)", id="javascript-con-mayusculas"),
    pytest.param(" javascript:alert(1)", id="javascript-con-espacio-antes"),
    pytest.param("javascript://fuente.ejemplo.test/%0Aalert(1)", id="javascript-con-dominio"),
    pytest.param("data:text/html,<script>alert(1)</script>", id="data"),
    pytest.param("data://fuente.ejemplo.test/x", id="data-con-dominio"),
    pytest.param("file://servidor/recurso", id="file-con-servidor"),
    pytest.param("file:///etc/passwd", id="file"),
    pytest.param("ftp://fuente.ejemplo.test/p", id="ftp"),
    pytest.param("vbscript:msgbox(1)", id="vbscript"),
    pytest.param("//fuente.ejemplo.test/p", id="sin-esquema"),
    pytest.param("/producto/1", id="relativa"),
    pytest.param("fuente.ejemplo.test/p", id="sin-esquema-con-dominio"),
    pytest.param("https:///sin-dominio", id="sin-dominio"),
    pytest.param("https://fuente.ejemplo.test/a b", id="con-espacio"),
    pytest.param("https://fuente.ejemplo.test/a\nb", id="con-salto-de-linea"),
    pytest.param("", id="vacia"),
    pytest.param("   ", id="solo-espacios"),
    pytest.param(42, id="numero"),
    pytest.param(None, id="nula"),
    pytest.param(["https://fuente.ejemplo.test"], id="lista"),
]


@pytest.mark.parametrize("direccion", DIRECCIONES_NO_VALIDAS)
def test_post_rechaza_una_ficha_con_direccion_que_no_es_http_ni_https(api, fabrica, escena, direccion) -> None:
    respuesta = _post(api, escena, ficha={"url": direccion, "product_name": "Leche"})

    _es_error_de_campo(respuesta, "ficha")
    assert _cuantos(fabrica) == 0


@pytest.mark.parametrize("direccion", DIRECCIONES_NO_VALIDAS)
def test_patch_rechaza_una_ficha_con_direccion_que_no_es_http_ni_https(api, fabrica, escena, direccion) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Leche", ficha={"url": URL_BUENA})

    respuesta = _patch(api, escena, creado["id"], ficha={"url": direccion})

    _es_error_de_campo(respuesta, "ficha")
    assert _leer(fabrica, creado["id"]).ficha == {"url": URL_BUENA}


@pytest.mark.parametrize(
    "direccion",
    [
        URL_BUENA,
        "http://fuente.ejemplo.test/producto/1",
        "HTTPS://FUENTE.EJEMPLO.TEST/PRODUCTO/1",
        "https://fuente.ejemplo.test:8443/p?a=1&b=2#x",
        "https://127.0.0.1/p",
    ],
)
def test_se_aceptan_las_direcciones_http_y_https(api, fabrica, escena, direccion) -> None:
    creado = _post(api, escena, ficha={"url": direccion})
    assert creado.status_code == 201, creado.text
    otro = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Otra leche")

    actualizado = _patch(api, escena, otro["id"], ficha={"url": direccion})

    assert actualizado.status_code == 200, actualizado.text
    assert _leer(fabrica, creado.json()["id"]).ficha == {"url": direccion}


def test_una_ficha_sin_direccion_o_ausente_no_se_toca(api, escena) -> None:
    assert _post(api, escena, ficha={"product_name": "Leche"}).status_code == 201
    assert _post(api, escena, ficha=None, nombre="Otra").status_code == 201
    assert _post(api, escena, nombre="Sin ficha").status_code == 201
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Para editar")

    assert _patch(api, escena, creado["id"], ficha={"product_name": "Leche"}).status_code == 200
    assert _patch(api, escena, creado["id"], ficha=None).status_code == 200


def test_la_regla_de_la_ficha_vale_aunque_la_fuente_sea_manual(api, escena) -> None:
    respuesta = _post(api, escena, fuente="manual", ficha={"url": "javascript:alert(1)"})

    _es_error_de_campo(respuesta, "ficha")


def test_patch_que_deja_la_ficha_mala_junto_a_otros_cambios_no_guarda_ninguno(api, fabrica, escena) -> None:
    creado = crear_insumo(api, escena["headers"], escena["leche"]["id"], "Leche")

    respuesta = _patch(api, escena, creado["id"], nombre="Nombre nuevo", ficha={"url": "javascript:alert(1)"})

    _es_error_de_campo(respuesta, "ficha")
    assert _leer(fabrica, creado["id"]).nombre == "Leche"
