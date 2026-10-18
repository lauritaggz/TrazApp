"""Barcode lookup endpoint and duplicate detection in both forms (T13-03 / HU13).

The source is always simulated: a fake injected in the dependency, or the real adapter over an
`httpx.MockTransport`. The persistence tests use the independent sessions of conftest.py.
"""

from contextlib import contextmanager
from datetime import datetime

import httpx
import pytest
from sqlalchemy import event, func, select

from app.api.dependencies import get_fuente_producto, get_recuperacion_service
from app.core.config import Settings
from app.db.base import Base
from app.main import app
from app.models import Alergeno, InsumoComercial
from app.repositories.insumo_repository import InsumoRepository
from app.services.recuperacion.alergenos import (
    ORIGEN_ETIQUETA,
    ORIGEN_TEXTO,
    AlergenoDetectado,
    Deteccion,
)
from app.services.recuperacion.base import MOTIVO_TIMEOUT, FuenteNoDisponibleError
from app.services.recuperacion.modelos import ProductoFuente
from app.services.recuperacion.open_food_facts import OpenFoodFactsFuente
from app.services.recuperacion.service import RecuperacionService

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu13@ejemplo.com",
    "password": "SecretoProductor123!",
}
PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu13@ejemplo.com",
    "password": "SecretoProductor123!",
}

EAN_13 = "7802910000971"
UPC_A = "036000291452"
EAN_13_DEL_UPC = "0036000291452"
EAN_8 = "96385074"
RUTA = "/gestion/insumos/consulta-codigo"

MSG_ACTIVO = "Ya existe un insumo con ese código de barras."
MSG_INACTIVO = "Ya existe un insumo desactivado con ese código de barras. Puedes reactivarlo."


class FuenteFalsa:
    """Source that answers what the test says and remembers what it was asked."""

    nombre = "open_food_facts"

    def __init__(self, resultado=None, error: Exception | None = None) -> None:
        self.resultado = resultado
        self.error = error
        self.consultas: list[str] = []

    def buscar(self, codigo_barras: str):
        self.consultas.append(codigo_barras)
        if self.error is not None:
            raise self.error
        return self.resultado


def _producto(**extra) -> ProductoFuente:
    datos = {
        "codigo_barras": EAN_13,
        "nombre": "Leche sin lactosa 1 L",
        "marca": "Loncoleche",
        "presentacion": "1 L",
        "ingredientes": "Leche descremada, vitaminas",
        "ficha": {"product_name": "Leche sin lactosa", "url": "https://off.test/product/1"},
        **extra,
    }
    return ProductoFuente(**datos)


def _headers(client, payload: dict) -> dict[str, str]:
    assert client.post("/auth/register", json=payload).status_code == 201
    login = client.post(
        "/auth/login", json={"email": payload["email"], "password": payload["password"]}
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _ingrediente(client, headers, codigo: str = "LEC-001", nombre: str = "Leche") -> int:
    response = client.post(
        "/gestion/ingredientes", headers=headers, json={"codigo_interno": codigo, "nombre": nombre}
    )
    assert response.status_code == 201
    return response.json()["id"]


def _crear(client, headers, ingrediente_id: int, **extra) -> dict:
    response = client.post(
        "/gestion/insumos",
        headers=headers,
        json={"ingrediente_id": ingrediente_id, "nombre": "Leche", "marca_origen": "Colun", **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _consultar(client, headers, codigo: str):
    return client.get(f"{RUTA}/{codigo}", headers=headers)


@pytest.fixture
def fuente() -> FuenteFalsa:
    fuente = FuenteFalsa(resultado=_producto())
    app.dependency_overrides[get_fuente_producto] = lambda: fuente
    return fuente


@pytest.fixture
def ana(client) -> dict[str, str]:
    return _headers(client, PRODUCTOR_A)


@pytest.fixture
def beto(client, ana) -> dict[str, str]:
    return _headers(client, PRODUCTOR_B)


@pytest.fixture
def leche(client, ana) -> int:
    return _ingrediente(client, ana)


# --- contrato: 200 ---


def test_la_ruta_exige_autenticacion(client, fuente) -> None:
    assert client.get(f"{RUTA}/{EAN_13}").status_code == 401
    assert fuente.consultas == []


def test_producto_encontrado_responde_la_propuesta(client, ana, fuente) -> None:
    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["encontrado"] is True
    assert cuerpo["codigo_barras"] == EAN_13
    assert cuerpo["fuente"] == "open_food_facts"
    assert cuerpo["producto"] == {
        "nombre": "Leche sin lactosa 1 L",
        "marca_origen": "Loncoleche",
        "presentacion": "1 L",
        "ingredientes_declarados": "Leche descremada, vitaminas",
    }
    assert cuerpo["ficha"] == {
        "product_name": "Leche sin lactosa",
        "url": "https://off.test/product/1",
    }
    assert fuente.consultas == [EAN_13]


def test_la_fecha_de_recuperacion_es_la_de_la_consulta_y_tiene_zona_horaria(
    client, ana, fuente
) -> None:
    antes = datetime.now().astimezone()

    cuerpo = _consultar(client, ana, EAN_13).json()

    fecha = datetime.fromisoformat(cuerpo["fecha_recuperacion"].replace("Z", "+00:00"))
    assert fecha.tzinfo is not None
    assert antes <= fecha <= datetime.now().astimezone()


def test_la_respuesta_incluye_la_estructura_completa_de_alergenos_vacia(client, ana, fuente) -> None:
    # detectar_alergenos is still empty in T13-03: T13-04 fills it.
    assert _consultar(client, ana, EAN_13).json()["alergenos"] == {
        "contiene": [],
        "trazas": [],
        "sin_reconocer": [],
    }


def test_la_respuesta_llena_los_alergenos_con_el_catalogo(client, db_session, ana, fuente) -> None:
    lacteos = Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True)
    soja = Alergeno(codigo="soja", nombre="Soya", obligatorio_chile=True)
    db_session.add_all([lacteos, soja])
    db_session.commit()

    def detector(contiene, trazas, texto):
        return Deteccion(
            contiene=(AlergenoDetectado("lacteos", ORIGEN_TEXTO),),
            trazas=(
                AlergenoDetectado("soja", ORIGEN_ETIQUETA),
                AlergenoDetectado("codigo_que_no_esta_en_el_catalogo", ORIGEN_ETIQUETA),
            ),
            sin_reconocer=("en:algo-raro",),
        )

    app.dependency_overrides[get_recuperacion_service] = lambda: RecuperacionService(
        InsumoRepository(db_session), fuente, detector=detector
    )

    alergenos = _consultar(client, ana, EAN_13).json()["alergenos"]

    assert alergenos["contiene"] == [
        {"alergeno_id": lacteos.id, "codigo": "lacteos", "nombre": "Leche", "origen": "texto"}
    ]
    assert alergenos["trazas"] == [
        {"alergeno_id": soja.id, "codigo": "soja", "nombre": "Soya", "origen": "etiqueta"}
    ]
    assert alergenos["sin_reconocer"] == ["en:algo-raro", "codigo_que_no_esta_en_el_catalogo"]


def test_el_detector_recibe_las_etiquetas_y_el_texto_de_la_fuente(client, db_session, ana) -> None:
    recibido = []

    def detector(contiene, trazas, texto):
        recibido.append((contiene, trazas, texto))
        return Deteccion()

    fuente = FuenteFalsa(
        _producto(etiquetas_alergenos=("en:milk",), etiquetas_trazas=("en:soybeans",))
    )
    app.dependency_overrides[get_recuperacion_service] = lambda: RecuperacionService(
        InsumoRepository(db_session), fuente, detector=detector
    )

    _consultar(client, ana, EAN_13)

    assert recibido == [(("en:milk",), ("en:soybeans",), "Leche descremada, vitaminas")]


def test_producto_no_encontrado_responde_200_con_encontrado_falso(client, ana, fuente) -> None:
    fuente.resultado = None

    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 200
    cuerpo = response.json()
    assert cuerpo["encontrado"] is False
    assert cuerpo["codigo_barras"] == EAN_13
    assert cuerpo["fuente"] == "open_food_facts"
    assert cuerpo["producto"] is None
    assert cuerpo["ficha"] is None
    assert cuerpo["alergenos"] == {"contiene": [], "trazas": [], "sin_reconocer": []}


def test_acepta_ean_13_upc_a_y_ean_8(client, ana, fuente) -> None:
    for codigo in (EAN_13, UPC_A, EAN_8):
        assert _consultar(client, ana, codigo).status_code == 200

    assert fuente.consultas == [EAN_13, UPC_A, EAN_8]


def test_los_espacios_del_codigo_se_ignoran(client, ana, fuente) -> None:
    assert _consultar(client, ana, "780%20291%200000971").status_code == 200
    assert fuente.consultas == [EAN_13]


def test_la_ruta_no_se_confunde_con_el_detalle_de_un_insumo(client, ana, fuente) -> None:
    # /{insumo_id} would answer 422 for a non-numeric id and 404 for a number.
    assert _consultar(client, ana, EAN_13).status_code == 200


# --- contrato: 422 ---


@pytest.mark.parametrize(
    ("codigo", "mensaje"),
    [
        ("123", "El código de barras debe tener 8, 12 o 13 dígitos numéricos."),
        ("78029100009AB", "El código de barras debe tener 8, 12 o 13 dígitos numéricos."),
        ("78029100009710", "El código de barras debe tener 8, 12 o 13 dígitos numéricos."),
        ("7802910000972", "El dígito verificador del código de barras no es válido."),
        ("%20", "Ingresa un código de barras."),
    ],
)
def test_un_codigo_invalido_responde_422_sin_consultar_la_fuente(
    client, ana, fuente, codigo, mensaje
) -> None:
    response = _consultar(client, ana, codigo)

    assert response.status_code == 422
    assert response.json()["detail"] == {"mensaje": mensaje}
    assert fuente.consultas == []


# --- contrato: 409 ---


def test_un_codigo_ya_registrado_responde_409_con_el_id_existente(client, ana, leche, fuente) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13)

    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": MSG_ACTIVO,
        "insumo_id": existente["id"],
        "activo": True,
    }
    assert fuente.consultas == []


def test_un_codigo_de_un_insumo_desactivado_responde_409_distinguiendo_el_caso(
    client, ana, leche, fuente
) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13)
    assert client.delete(f"/gestion/insumos/{existente['id']}", headers=ana).status_code == 204

    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": MSG_INACTIVO,
        "insumo_id": existente["id"],
        "activo": False,
    }
    assert fuente.consultas == []


def test_la_consulta_detecta_el_duplicado_al_leer_el_ean_13_de_un_upc_a_registrado(
    client, ana, leche, fuente
) -> None:
    existente = _crear(client, ana, leche, codigo_barras=UPC_A)

    response = _consultar(client, ana, EAN_13_DEL_UPC)

    assert response.status_code == 409
    assert response.json()["detail"]["insumo_id"] == existente["id"]
    assert fuente.consultas == []


def test_la_consulta_detecta_el_duplicado_al_leer_el_upc_a_de_un_ean_13_registrado(
    client, ana, leche, fuente
) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13_DEL_UPC)

    response = _consultar(client, ana, UPC_A)

    assert response.status_code == 409
    assert response.json()["detail"]["insumo_id"] == existente["id"]
    assert fuente.consultas == []


def test_el_codigo_de_otro_productor_no_cuenta_como_duplicado(client, ana, beto, fuente) -> None:
    ingrediente_beto = _ingrediente(client, beto)
    _crear(client, beto, ingrediente_beto, codigo_barras=EAN_13)
    _crear(client, beto, ingrediente_beto, nombre="Otro", codigo_barras=UPC_A)

    assert _consultar(client, ana, EAN_13).status_code == 200
    assert _consultar(client, ana, EAN_13_DEL_UPC).status_code == 200
    assert fuente.consultas == [EAN_13, EAN_13_DEL_UPC]


# --- contrato: 503 ---


@pytest.mark.parametrize(
    "motivo", ["timeout", "sin_conexion", "limite_de_uso", "error_servidor", "respuesta_invalida"]
)
def test_si_la_fuente_falla_responde_503_con_el_motivo(client, ana, fuente, motivo) -> None:
    fuente.error = FuenteNoDisponibleError(motivo)

    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 503
    detalle = response.json()["detail"]
    assert detalle["motivo"] == motivo
    assert detalle["mensaje"]


def test_un_timeout_real_del_adaptador_responde_503_y_no_200(client, ana) -> None:
    def agotado(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("lento")

    adaptador = OpenFoodFactsFuente(
        Settings(_env_file=None), transport=httpx.MockTransport(agotado)
    )
    app.dependency_overrides[get_fuente_producto] = lambda: adaptador

    response = _consultar(client, ana, EAN_13)

    assert response.status_code == 503
    assert response.json()["detail"]["motivo"] == MOTIVO_TIMEOUT


@pytest.mark.parametrize(
    "respuesta",
    [
        httpx.Response(429, text="slow down"),
        httpx.Response(500, text="boom"),
        httpx.Response(200, text="no es json"),
    ],
)
def test_las_fallas_http_del_adaptador_responden_503(client, ana, respuesta) -> None:
    adaptador = OpenFoodFactsFuente(
        Settings(_env_file=None), transport=httpx.MockTransport(lambda request: respuesta)
    )
    app.dependency_overrides[get_fuente_producto] = lambda: adaptador

    assert _consultar(client, ana, EAN_13).status_code == 503


def test_el_adaptador_real_encontrado_y_no_encontrado_de_punta_a_punta(client, ana) -> None:
    cuerpos = {
        EAN_13: {
            "status": 1,
            "product": {"product_name_es": "Leche", "brands": "Colun, Soprole", "quantity": "1 L"},
        },
        EAN_8: {"status": 0, "status_verbose": "product not found"},
    }

    def responder(request: httpx.Request) -> httpx.Response:
        codigo = request.url.path.rsplit("/", 1)[1].removesuffix(".json")
        return httpx.Response(200, json=cuerpos[codigo])

    adaptador = OpenFoodFactsFuente(
        Settings(_env_file=None), transport=httpx.MockTransport(responder)
    )
    app.dependency_overrides[get_fuente_producto] = lambda: adaptador

    encontrado = _consultar(client, ana, EAN_13).json()
    no_encontrado = _consultar(client, ana, EAN_8).json()

    assert encontrado["producto"]["nombre"] == "Leche"
    assert encontrado["producto"]["marca_origen"] == "Colun"
    assert no_encontrado["encontrado"] is False


# --- la consulta no escribe nada ---


def _filas_por_tabla(sesion) -> dict[str, int]:
    return {
        tabla.name: sesion.scalar(select(func.count()).select_from(tabla))
        for tabla in Base.metadata.sorted_tables
    }


@contextmanager
def _sentencias_de_escritura(motor):
    """Collects every INSERT, UPDATE or DELETE the engine executes while the block runs."""
    ejecutadas: list[str] = []

    def registrar(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().split(None, 1)[0].upper() in {"INSERT", "UPDATE", "DELETE"}:
            ejecutadas.append(statement)

    event.listen(motor, "before_cursor_execute", registrar)
    try:
        yield ejecutadas
    finally:
        event.remove(motor, "before_cursor_execute", registrar)


@pytest.fixture
def datos(api, fabrica):
    """A productor with an ingredient, a supply and the allergen catalog, all committed."""
    headers = _headers(api, PRODUCTOR_A)
    leche = _ingrediente(api, headers)
    _crear(api, headers, leche, codigo_barras=UPC_A)
    with fabrica() as sesion:
        sesion.add(Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True))
        sesion.commit()
    return headers


@pytest.mark.parametrize(
    ("codigo", "estado"),
    [
        (EAN_13, 200),
        (EAN_8, 200),
        (EAN_13_DEL_UPC, 409),
        ("123", 422),
    ],
)
def test_la_consulta_no_persiste_nada(api, motor, fabrica, datos, codigo, estado) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: FuenteFalsa(
        _producto(etiquetas_alergenos=("en:milk",))
    )
    with fabrica() as sesion:
        antes = _filas_por_tabla(sesion)

    # Not even a statement that is later rolled back: the request must not write at all.
    with _sentencias_de_escritura(motor) as escrituras:
        assert _consultar(api, datos, codigo).status_code == estado
    assert escrituras == []

    # A brand new session on another connection: it only sees what was committed.
    with fabrica() as sesion:
        assert _filas_por_tabla(sesion) == antes


def test_la_consulta_con_la_fuente_caida_no_persiste_nada(api, motor, fabrica, datos) -> None:
    app.dependency_overrides[get_fuente_producto] = lambda: FuenteFalsa(
        error=FuenteNoDisponibleError(MOTIVO_TIMEOUT)
    )
    with fabrica() as sesion:
        antes = _filas_por_tabla(sesion)

    with _sentencias_de_escritura(motor) as escrituras:
        assert _consultar(api, datos, EAN_13).status_code == 503
    assert escrituras == []

    with fabrica() as sesion:
        assert _filas_por_tabla(sesion) == antes


def test_el_detector_de_escrituras_ve_un_insert_aunque_se_deshaga(api, motor, fabrica) -> None:
    # Guards the guard: the listener must notice a write that the request later rolls back.
    with _sentencias_de_escritura(motor) as escrituras:
        _headers(api, PRODUCTOR_A)
    assert any(sentencia.lstrip().upper().startswith("INSERT") for sentencia in escrituras)


# --- el POST y el PATCH detectan el duplicado en la otra forma ---


def _post(client, headers, ingrediente_id: int, codigo: str):
    return client.post(
        "/gestion/insumos",
        headers=headers,
        json={
            "ingrediente_id": ingrediente_id,
            "nombre": "Otro",
            "marca_origen": "Otra",
            "codigo_barras": codigo,
        },
    )


@pytest.mark.parametrize(
    ("registrado", "nuevo"), [(UPC_A, EAN_13_DEL_UPC), (EAN_13_DEL_UPC, UPC_A)]
)
def test_el_post_rechaza_el_codigo_en_la_otra_forma(client, ana, leche, registrado, nuevo) -> None:
    existente = _crear(client, ana, leche, codigo_barras=registrado)

    response = _post(client, ana, leche, nuevo)

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": MSG_ACTIVO,
        "insumo_id": existente["id"],
        "activo": True,
    }
    assert len(client.get("/gestion/insumos", headers=ana).json()) == 1


def test_el_post_distingue_el_duplicado_inactivo_en_la_otra_forma(client, ana, leche) -> None:
    existente = _crear(client, ana, leche, codigo_barras=UPC_A)
    client.delete(f"/gestion/insumos/{existente['id']}", headers=ana)

    response = _post(client, ana, leche, EAN_13_DEL_UPC)

    assert response.status_code == 409
    assert response.json()["detail"]["activo"] is False
    assert response.json()["detail"]["insumo_id"] == existente["id"]


def test_el_post_acepta_el_codigo_de_otro_productor_en_cualquier_forma(
    client, ana, beto, leche
) -> None:
    _crear(client, ana, leche, codigo_barras=UPC_A)
    ingrediente_beto = _ingrediente(client, beto)

    assert _post(client, beto, ingrediente_beto, EAN_13_DEL_UPC).status_code == 201


def test_el_patch_rechaza_cambiar_a_un_codigo_que_existe_en_la_otra_forma(client, ana, leche) -> None:
    _crear(client, ana, leche, codigo_barras=UPC_A)
    otro = _crear(client, ana, leche, nombre="Otro")

    response = client.patch(
        f"/gestion/insumos/{otro['id']}", headers=ana, json={"codigo_barras": EAN_13_DEL_UPC}
    )

    assert response.status_code == 409


def test_el_patch_puede_reescribir_el_propio_codigo_en_la_otra_forma(client, ana, leche) -> None:
    propio = _crear(client, ana, leche, codigo_barras=UPC_A)

    response = client.patch(
        f"/gestion/insumos/{propio['id']}", headers=ana, json={"codigo_barras": EAN_13_DEL_UPC}
    )

    assert response.status_code == 200
    assert response.json()["codigo_barras"] == EAN_13_DEL_UPC


def test_el_codigo_se_guarda_tal_como_se_leyo(client, db_session, ana, leche) -> None:
    _crear(client, ana, leche, codigo_barras=EAN_13_DEL_UPC)

    guardado = db_session.scalar(select(InsumoComercial.codigo_barras))

    assert guardado == EAN_13_DEL_UPC
