"""Allergens declared by a commercial supply: API tests (T04-04 / HU04)."""

from datetime import datetime, timezone

import pytest
from sqlalchemy import update

from app.models import Alergeno, InsumoComercial
from app.repositories.insumo_repository import InsumoRepository
from app.services.insumo_service import InsumoService

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu04.alergenos@ejemplo.com",
    "password": "SecretoProductor123!",
}
PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu04.alergenos@ejemplo.com",
    "password": "SecretoProductor123!",
}

MSG_REPETIDO = "El alérgeno ya está asociado al insumo."
MSG_NO_ASOCIADO = "Asociación de alérgeno no encontrada."


def _headers(client, payload: dict) -> dict[str, str]:
    assert client.post("/auth/register", json=payload).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _crear_insumo(client, headers, nombre: str = "Chocolate Ambrosoli 500 g") -> int:
    ingrediente = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={"codigo_interno": f"ING-{nombre[:3].upper()}", "nombre": f"Ingrediente {nombre}"},
    )
    assert ingrediente.status_code == 201, ingrediente.text
    insumo = client.post(
        "/gestion/insumos",
        headers=headers,
        json={"ingrediente_id": ingrediente.json()["id"], "nombre": nombre, "marca_origen": "Ambrosoli"},
    )
    assert insumo.status_code == 201, insumo.text
    return insumo.json()["id"]


def _ruta(insumo_id: int, alergeno_id: int | None = None) -> str:
    base = f"/gestion/insumos/{insumo_id}/alergenos"
    return base if alergeno_id is None else f"{base}/{alergeno_id}"


def _declarar(client, headers, insumo_id: int, alergeno_id: int, tipo: str):
    return client.post(_ruta(insumo_id), headers=headers, json={"alergeno_id": alergeno_id, "tipo": tipo})


def _detalle(client, headers, insumo_id: int) -> dict:
    response = client.get(f"/gestion/insumos/{insumo_id}", headers=headers)
    assert response.status_code == 200
    return response.json()


def _pares(items: list[dict]) -> list[tuple[str, str]]:
    return [(a["codigo"], a["tipo"]) for a in items]


@pytest.fixture
def ana(client) -> dict[str, str]:
    return _headers(client, PRODUCTOR_A)


@pytest.fixture
def beto(client, ana) -> dict[str, str]:
    return _headers(client, PRODUCTOR_B)


@pytest.fixture
def catalogo(db_session) -> dict[str, int]:
    filas = [
        Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True),
        Alergeno(codigo="cacahuetes", nombre="Maní", obligatorio_chile=True),
        Alergeno(codigo="soja", nombre="Soya", obligatorio_chile=True),
        Alergeno(codigo="sesamo", nombre="Sésamo", obligatorio_chile=False),
        Alergeno(codigo="apio", nombre="Apio", obligatorio_chile=False),
    ]
    db_session.add_all(filas)
    db_session.commit()
    return {fila.codigo: fila.id for fila in filas}


@pytest.fixture
def insumo(client, ana) -> int:
    return _crear_insumo(client, ana)


# --- autenticación ---


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("get", "/gestion/insumos/1/alergenos"),
        ("post", "/gestion/insumos/1/alergenos"),
        ("patch", "/gestion/insumos/1/alergenos/1"),
        ("delete", "/gestion/insumos/1/alergenos/1"),
    ],
)
def test_las_rutas_requieren_autenticacion(client, metodo, ruta) -> None:
    kwargs = {"json": {}} if metodo in {"post", "patch"} else {}

    assert getattr(client, metodo)(ruta, **kwargs).status_code == 401
    assert getattr(client, metodo)(
        ruta, headers={"Authorization": "Bearer token-invalido"}, **kwargs
    ).status_code == 401


# --- listar ---


def test_un_insumo_sin_alergenos_devuelve_lista_vacia(client, ana, insumo) -> None:
    response = client.get(_ruta(insumo), headers=ana)

    assert response.status_code == 200
    assert response.json() == []


def test_lista_los_alergenos_declarados_con_su_tipo(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")

    response = client.get(_ruta(insumo), headers=ana)

    assert response.status_code == 200
    assert response.json() == [
        {"alergeno_id": catalogo["lacteos"], "codigo": "lacteos", "nombre": "Leche", "obligatorio_chile": True, "tipo": "contiene"},
        {"alergeno_id": catalogo["cacahuetes"], "codigo": "cacahuetes", "nombre": "Maní", "obligatorio_chile": True, "tipo": "trazas"},
    ]


def test_el_listado_sigue_el_mismo_orden_que_la_respuesta_del_insumo(client, ana, insumo, catalogo) -> None:
    # Inserted on purpose in an order different from the expected one.
    _declarar(client, ana, insumo, catalogo["sesamo"], "trazas")
    _declarar(client, ana, insumo, catalogo["apio"], "contiene")
    _declarar(client, ana, insumo, catalogo["soja"], "trazas")
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")

    del_endpoint = client.get(_ruta(insumo), headers=ana).json()
    en_el_detalle = _detalle(client, ana, insumo)["alergenos_declarados"]

    # "contiene" first (mandatory before the rest), then "trazas" (mandatory before the rest, by name).
    assert _pares(del_endpoint) == [
        ("lacteos", "contiene"),
        ("apio", "contiene"),
        ("cacahuetes", "trazas"),
        ("soja", "trazas"),
        ("sesamo", "trazas"),
    ]
    assert del_endpoint == en_el_detalle


def test_listar_un_insumo_ajeno_o_inexistente_responde_404(client, ana, beto, insumo) -> None:
    assert client.get(_ruta(99999), headers=ana).status_code == 404
    assert client.get(_ruta(insumo), headers=beto).status_code == 404


# --- asociar ---


@pytest.mark.parametrize("tipo", ["contiene", "trazas"])
def test_asocia_un_alergeno_del_catalogo_con_cada_tipo(client, ana, insumo, catalogo, tipo) -> None:
    response = _declarar(client, ana, insumo, catalogo["lacteos"], tipo)

    assert response.status_code == 201
    assert response.json() == {
        "alergeno_id": catalogo["lacteos"],
        "codigo": "lacteos",
        "nombre": "Leche",
        "obligatorio_chile": True,
        "tipo": tipo,
    }


def test_el_detalle_del_insumo_refleja_los_alergenos_asociados(client, ana, insumo, catalogo) -> None:
    assert _detalle(client, ana, insumo)["alergenos_declarados"] == []

    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")

    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [
        ("lacteos", "contiene"),
        ("cacahuetes", "trazas"),
    ]
    en_listado = client.get("/gestion/insumos", headers=ana).json()[0]
    assert _pares(en_listado["alergenos_declarados"]) == [("lacteos", "contiene"), ("cacahuetes", "trazas")]


def test_asociar_a_un_insumo_inexistente_o_ajeno_responde_404(client, ana, beto, insumo, catalogo) -> None:
    assert _declarar(client, ana, 99999, catalogo["lacteos"], "contiene").status_code == 404
    assert _declarar(client, beto, insumo, catalogo["lacteos"], "contiene").status_code == 404
    assert _detalle(client, ana, insumo)["alergenos_declarados"] == []


def test_un_alergeno_inexistente_en_el_catalogo_responde_422(client, ana, insumo) -> None:
    response = _declarar(client, ana, insumo, 99999, "contiene")

    assert response.status_code == 422
    assert response.json()["detail"] == "Alérgeno no válido"
    assert _detalle(client, ana, insumo)["alergenos_declarados"] == []


@pytest.mark.parametrize("tipo", ["puede_contener", "contienen", "TRAZAS", "", None, 1])
def test_un_tipo_distinto_de_contiene_o_trazas_responde_422(client, ana, insumo, catalogo, tipo) -> None:
    response = _declarar(client, ana, insumo, catalogo["lacteos"], tipo)

    assert response.status_code == 422
    assert _detalle(client, ana, insumo)["alergenos_declarados"] == []


@pytest.mark.parametrize(
    "cuerpo",
    [
        {},
        {"tipo": "contiene"},
        {"alergeno_id": 1},
        {"alergeno_id": 0, "tipo": "contiene"},
        {"alergeno_id": -3, "tipo": "contiene"},
        {"alergeno_id": "uno", "tipo": "contiene"},
        {"alergeno_id": 1, "tipo": "contiene", "insumo_id": 5},
        {"alergeno_id": 1, "tipo": "contiene", "nombre": "Leche"},
    ],
)
def test_rechaza_cuerpos_incompletos_o_con_campos_extra(client, ana, insumo, catalogo, cuerpo) -> None:
    assert client.post(_ruta(insumo), headers=ana, json=cuerpo).status_code == 422


@pytest.mark.parametrize(("primero", "segundo"), [("contiene", "contiene"), ("trazas", "trazas"), ("contiene", "trazas"), ("trazas", "contiene")])
def test_asociar_un_alergeno_ya_asociado_responde_422_aunque_cambie_el_tipo(
    client, ana, insumo, catalogo, primero, segundo
) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], primero)

    response = _declarar(client, ana, insumo, catalogo["lacteos"], segundo)

    assert response.status_code == 422
    assert response.json()["detail"] == MSG_REPETIDO
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", primero)]


def test_la_asociacion_repetida_usa_el_mismo_codigo_de_error_que_hu02(client, ana, insumo, catalogo) -> None:
    ingrediente = client.post(
        "/gestion/ingredientes", headers=ana, json={"codigo_interno": "HAR-001", "nombre": "Harina"}
    ).json()["id"]
    hu02 = lambda: client.post(  # noqa: E731
        f"/gestion/ingredientes/{ingrediente}/alergenos", headers=ana, json={"alergeno_id": catalogo["lacteos"]}
    )
    assert hu02().status_code == 201
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    repetido_hu02 = hu02()
    repetido_hu04 = _declarar(client, ana, insumo, catalogo["lacteos"], "trazas")

    assert repetido_hu02.status_code == repetido_hu04.status_code == 422


def test_el_mismo_alergeno_se_puede_declarar_en_insumos_distintos(client, ana, beto, insumo, catalogo) -> None:
    otro = _crear_insumo(client, ana, "Galleta de vainilla")
    de_beto = _crear_insumo(client, beto, "Leche en polvo")

    assert _declarar(client, ana, insumo, catalogo["lacteos"], "contiene").status_code == 201
    assert _declarar(client, ana, otro, catalogo["lacteos"], "trazas").status_code == 201
    assert _declarar(client, beto, de_beto, catalogo["lacteos"], "contiene").status_code == 201
    assert _pares(_detalle(client, ana, otro)["alergenos_declarados"]) == [("lacteos", "trazas")]


# The simulated race loads the same row twice in one session, which SQLAlchemy reports.
@pytest.mark.filterwarnings("ignore:New instance:sqlalchemy.exc.SAWarning")
def test_la_base_respalda_la_unicidad_si_dos_peticiones_compiten(client, ana, insumo, catalogo, monkeypatch) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    # Simulates a race: the pre-check does not see the other association, the primary key does.
    originales = InsumoRepository.get_declarado
    llamadas = {"n": 0}

    def no_ve_la_primera_vez(self, insumo_id, alergeno_id):
        llamadas["n"] += 1
        return None if llamadas["n"] == 1 else originales(self, insumo_id, alergeno_id)

    monkeypatch.setattr(InsumoRepository, "get_declarado", no_ve_la_primera_vez)

    response = _declarar(client, ana, insumo, catalogo["lacteos"], "trazas")

    assert response.status_code == 422
    assert response.json()["detail"] == MSG_REPETIDO
    monkeypatch.undo()
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


def test_un_fallo_inesperado_al_guardar_responde_409_y_no_deja_cambios(client, ana, insumo, catalogo, monkeypatch) -> None:
    from sqlalchemy.exc import IntegrityError

    def falla_al_confirmar(self) -> None:
        self.db.rollback()
        raise IntegrityError("COMMIT", {}, Exception("fallo simulado"))

    with monkeypatch.context() as m:
        m.setattr(InsumoRepository, "commit", falla_al_confirmar)
        response = _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    assert response.status_code == 409
    assert "cambio simultáneo" in response.json()["detail"]
    assert _detalle(client, ana, insumo)["alergenos_declarados"] == []


# --- cambiar el tipo ---


def test_cambia_el_tipo_de_un_alergeno_asociado_y_el_detalle_lo_refleja(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    a_trazas = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})

    assert a_trazas.status_code == 200
    assert a_trazas.json()["tipo"] == "trazas"
    assert a_trazas.json()["codigo"] == "lacteos"
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "trazas")]

    de_vuelta = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "contiene"})

    assert de_vuelta.status_code == 200
    assert _pares(client.get(_ruta(insumo), headers=ana).json()) == [("lacteos", "contiene")]


def test_cambiar_el_tipo_reordena_el_listado(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")

    client.patch(_ruta(insumo, catalogo["cacahuetes"]), headers=ana, json={"tipo": "contiene"})
    client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})

    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("cacahuetes", "contiene"), ("lacteos", "trazas")]


def test_cambiar_al_mismo_tipo_es_valido_y_no_cambia_nada(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    response = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "contiene"})

    assert response.status_code == 200
    assert _pares(client.get(_ruta(insumo), headers=ana).json()) == [("lacteos", "contiene")]


def test_cambiar_el_tipo_de_un_alergeno_no_asociado_responde_404(client, ana, insumo, catalogo) -> None:
    sin_asociar = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})
    fuera_del_catalogo = client.patch(_ruta(insumo, 99999), headers=ana, json={"tipo": "trazas"})

    assert sin_asociar.status_code == 404
    assert sin_asociar.json()["detail"] == MSG_NO_ASOCIADO
    assert fuera_del_catalogo.status_code == 404
    assert client.get(_ruta(insumo), headers=ana).json() == []


def test_cambiar_el_tipo_en_un_insumo_ajeno_o_inexistente_responde_404(client, ana, beto, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    assert client.patch(_ruta(insumo, catalogo["lacteos"]), headers=beto, json={"tipo": "trazas"}).status_code == 404
    assert client.patch(_ruta(99999, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"}).status_code == 404
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


@pytest.mark.parametrize(
    "cuerpo",
    [{}, {"tipo": "puede_contener"}, {"tipo": ""}, {"tipo": None}, {"tipo": "trazas", "alergeno_id": 2}, {"alergeno_id": 2}],
)
def test_cambiar_el_tipo_rechaza_valores_invalidos_y_campos_extra(client, ana, insumo, catalogo, cuerpo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    assert client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json=cuerpo).status_code == 422
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


# --- quitar ---


def test_quita_un_alergeno_y_el_detalle_lo_refleja(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")

    response = client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana)

    assert response.status_code == 204
    assert response.content == b""
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("cacahuetes", "trazas")]
    assert _pares(client.get(_ruta(insumo), headers=ana).json()) == [("cacahuetes", "trazas")]


def test_quitar_un_alergeno_no_asociado_responde_404(client, ana, insumo, catalogo) -> None:
    sin_asociar = client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana)
    fuera_del_catalogo = client.delete(_ruta(insumo, 99999), headers=ana)

    assert sin_asociar.status_code == 404
    assert sin_asociar.json()["detail"] == MSG_NO_ASOCIADO
    assert fuera_del_catalogo.status_code == 404


def test_quitar_dos_veces_el_mismo_alergeno_responde_404_la_segunda(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    assert client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana).status_code == 204
    assert client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana).status_code == 404


def test_quitar_en_un_insumo_ajeno_o_inexistente_responde_404(client, ana, beto, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    assert client.delete(_ruta(insumo, catalogo["lacteos"]), headers=beto).status_code == 404
    assert client.delete(_ruta(99999, catalogo["lacteos"]), headers=ana).status_code == 404
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


def test_tras_quitarlo_el_alergeno_se_puede_volver_a_asociar_con_otro_tipo(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana)

    assert _declarar(client, ana, insumo, catalogo["lacteos"], "trazas").status_code == 201
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "trazas")]


def test_quitar_un_alergeno_no_afecta_a_los_demas_insumos(client, ana, insumo, catalogo) -> None:
    otro = _crear_insumo(client, ana, "Galleta de vainilla")
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _declarar(client, ana, otro, catalogo["lacteos"], "trazas")

    client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana)

    assert _pares(_detalle(client, ana, otro)["alergenos_declarados"]) == [("lacteos", "trazas")]


# --- insumo inactivo y aislamiento ---


def test_los_alergenos_de_un_insumo_inactivo_se_gestionan_igual(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    assert client.delete(f"/gestion/insumos/{insumo}", headers=ana).status_code == 204

    listado = client.get(_ruta(insumo), headers=ana)
    asociado = _declarar(client, ana, insumo, catalogo["cacahuetes"], "trazas")
    cambiado = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})
    quitado = client.delete(_ruta(insumo, catalogo["cacahuetes"]), headers=ana)

    assert listado.status_code == 200 and _pares(listado.json()) == [("lacteos", "contiene")]
    assert asociado.status_code == 201
    assert cambiado.status_code == 200
    assert quitado.status_code == 204
    detalle = _detalle(client, ana, insumo)
    assert detalle["activo"] is False
    assert _pares(detalle["alergenos_declarados"]) == [("lacteos", "trazas")]


def test_desactivar_y_reactivar_el_insumo_conserva_sus_alergenos(client, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    client.delete(f"/gestion/insumos/{insumo}", headers=ana)

    client.patch(f"/gestion/insumos/{insumo}", headers=ana, json={"activo": True})

    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


def test_un_productor_no_ve_ni_modifica_los_alergenos_de_otro(client, ana, beto, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")

    respuestas = [
        client.get(_ruta(insumo), headers=beto),
        _declarar(client, beto, insumo, catalogo["cacahuetes"], "trazas"),
        client.patch(_ruta(insumo, catalogo["lacteos"]), headers=beto, json={"tipo": "trazas"}),
        client.delete(_ruta(insumo, catalogo["lacteos"]), headers=beto),
    ]

    assert [r.status_code for r in respuestas] == [404, 404, 404, 404]
    assert _pares(_detalle(client, ana, insumo)["alergenos_declarados"]) == [("lacteos", "contiene")]


def test_las_operaciones_de_alergenos_no_alteran_el_resto_del_insumo(client, ana, insumo, catalogo) -> None:
    antes = _detalle(client, ana, insumo)

    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})
    client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana)

    despues = _detalle(client, ana, insumo)
    # updated_at is renewed by design (covered by its own tests); everything else is untouched.
    antes.pop("updated_at")
    despues.pop("updated_at")
    assert despues == antes


# --- updated_at del insumo ---

ANTIGUO = datetime(2020, 1, 1, 12, 0, tzinfo=timezone.utc)


def _retroceder_updated_at(db_session, insumo_id: int) -> None:
    """Backdate updated_at so that any renewal is visible even on clocks with 1 s resolution."""
    db_session.execute(update(InsumoComercial).where(InsumoComercial.id == insumo_id).values(updated_at=ANTIGUO))
    db_session.commit()
    db_session.expire_all()


def _updated_at(client, headers, insumo_id: int) -> datetime:
    texto = _detalle(client, headers, insumo_id)["updated_at"]
    return datetime.fromisoformat(texto.replace("Z", "+00:00")).replace(tzinfo=None)


SIN_ZONA = ANTIGUO.replace(tzinfo=None)


def test_asociar_un_alergeno_renueva_updated_at_del_insumo(client, db_session, ana, insumo, catalogo) -> None:
    _retroceder_updated_at(db_session, insumo)
    assert _updated_at(client, ana, insumo) == SIN_ZONA

    assert _declarar(client, ana, insumo, catalogo["lacteos"], "contiene").status_code == 201

    assert _updated_at(client, ana, insumo) > SIN_ZONA


def test_cambiar_el_tipo_renueva_updated_at_del_insumo(client, db_session, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _retroceder_updated_at(db_session, insumo)

    response = client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "trazas"})

    assert response.status_code == 200
    assert _updated_at(client, ana, insumo) > SIN_ZONA


def test_quitar_un_alergeno_renueva_updated_at_del_insumo(client, db_session, ana, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _retroceder_updated_at(db_session, insumo)

    assert client.delete(_ruta(insumo, catalogo["lacteos"]), headers=ana).status_code == 204

    assert _updated_at(client, ana, insumo) > SIN_ZONA


def test_lo_que_no_cambia_nada_no_renueva_updated_at(client, db_session, ana, beto, insumo, catalogo) -> None:
    _declarar(client, ana, insumo, catalogo["lacteos"], "contiene")
    _retroceder_updated_at(db_session, insumo)

    # same type, repeated allergen, unknown allergen, not associated, someone else's supply, reads
    client.patch(_ruta(insumo, catalogo["lacteos"]), headers=ana, json={"tipo": "contiene"})
    _declarar(client, ana, insumo, catalogo["lacteos"], "trazas")
    _declarar(client, ana, insumo, 99999, "contiene")
    client.delete(_ruta(insumo, catalogo["cacahuetes"]), headers=ana)
    client.delete(_ruta(insumo, catalogo["lacteos"]), headers=beto)
    client.get(_ruta(insumo), headers=ana)

    assert _updated_at(client, ana, insumo) == SIN_ZONA
