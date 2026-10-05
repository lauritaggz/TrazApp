"""Authenticated commercial supply management API tests (T04-03 / HU04)."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.models import Alergeno, InsumoAlergeno, InsumoComercial
from app.repositories.insumo_repository import InsumoRepository
from app.services.insumo_service import InsumoService

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu04@ejemplo.com",
    "password": "SecretoProductor123!",
}
PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu04@ejemplo.com",
    "password": "SecretoProductor123!",
}

EAN_13 = "7802910000971"
UPC_A = "036000291452"
EAN_8 = "96385074"
OTRO_EAN_13 = "4006381333931"
TERCER_EAN_13 = "5901234123457"

MSG_CODIGO_ACTIVO = "Ya existe un insumo con ese código de barras."
MSG_CODIGO_INACTIVO = "Ya existe un insumo desactivado con ese código de barras. Puedes reactivarlo."


def _headers(client, payload: dict = PRODUCTOR_A) -> dict[str, str]:
    assert client.post("/auth/register", json=payload).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _ingrediente(client, headers, codigo: str = "LEC-001", nombre: str = "Leche") -> int:
    response = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={"codigo_interno": codigo, "nombre": nombre},
    )
    assert response.status_code == 201
    return response.json()["id"]


def _payload(ingrediente_id: int, **extra) -> dict:
    return {
        "ingrediente_id": ingrediente_id,
        "nombre": "Leche Colun Semidescremada 1 L",
        "marca_origen": "Colun",
        **extra,
    }


def _crear(client, headers, ingrediente_id: int, **extra) -> dict:
    response = client.post("/gestion/insumos", headers=headers, json=_payload(ingrediente_id, **extra))
    assert response.status_code == 201, response.text
    return response.json()


def _obtener(client, headers, insumo_id: int) -> dict:
    response = client.get(f"/gestion/insumos/{insumo_id}", headers=headers)
    assert response.status_code == 200
    return response.json()


@pytest.fixture
def ana(client) -> dict[str, str]:
    return _headers(client, PRODUCTOR_A)


@pytest.fixture
def beto(client, ana) -> dict[str, str]:
    return _headers(client, PRODUCTOR_B)


@pytest.fixture
def leche(client, ana) -> int:
    return _ingrediente(client, ana)


# --- autenticación ---


@pytest.mark.parametrize(
    ("metodo", "ruta"),
    [
        ("post", "/gestion/insumos"),
        ("get", "/gestion/insumos"),
        ("get", "/gestion/insumos/1"),
        ("patch", "/gestion/insumos/1"),
        ("delete", "/gestion/insumos/1"),
    ],
)
def test_las_rutas_requieren_autenticacion(client, metodo, ruta) -> None:
    kwargs = {"json": {}} if metodo in {"post", "patch"} else {}

    assert getattr(client, metodo)(ruta, **kwargs).status_code == 401
    assert getattr(client, metodo)(
        ruta, headers={"Authorization": "Bearer token-invalido"}, **kwargs
    ).status_code == 401


# --- creación ---


def test_crea_un_insumo_con_los_datos_obligatorios(client, ana, leche) -> None:
    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche))

    assert response.status_code == 201
    insumo = response.json()
    assert insumo["nombre"] == "Leche Colun Semidescremada 1 L"
    assert insumo["marca_origen"] == "Colun"
    assert insumo["ingrediente_id"] == leche
    assert insumo["ingrediente"] == {"id": leche, "nombre": "Leche"}
    assert insumo["fuente"] == "manual"
    assert insumo["habitual"] is False
    assert insumo["activo"] is True
    assert insumo["codigo_barras"] is None
    assert insumo["fecha_recuperacion"] is None
    assert insumo["ficha"] is None
    assert insumo["alergenos_declarados"] == []
    assert insumo["created_at"] and insumo["updated_at"]


def test_el_insumo_queda_asociado_al_productor_autenticado(client, db_session, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    guardado = db_session.get(InsumoComercial, insumo["id"])
    assert guardado.productor_id == insumo["productor_id"]
    assert client.get("/auth/me", headers=ana).json()["id"] == insumo["productor_id"]


def test_crea_un_insumo_con_origen_en_vez_de_marca(client, ana) -> None:
    huevo = _ingrediente(client, ana, "HUE-001", "Huevo")

    insumo = _crear(client, ana, huevo, nombre="Huevos de campo", marca_origen="Feria local")

    assert insumo["marca_origen"] == "Feria local"


def test_crea_un_insumo_con_todos_los_datos_opcionales_y_de_fuente(client, ana) -> None:
    chocolate = _ingrediente(client, ana, "CHO-001", "Chocolate")

    insumo = _crear(
        client,
        ana,
        chocolate,
        nombre="Chocolate Ambrosoli 500 g",
        marca_origen="Ambrosoli",
        presentacion="Barra de 500 g",
        codigo_barras=EAN_13,
        ingredientes_declarados="Azúcar, pasta de cacao, leche en polvo",
        advertencias="Puede contener trazas de maní",
        ficha={"product_name": "Chocolate", "ingredients": ["azúcar"]},
        fuente="open_food_facts",
        fecha_recuperacion="2026-10-04T15:30:00Z",
    )

    assert insumo["presentacion"] == "Barra de 500 g"
    assert insumo["codigo_barras"] == EAN_13
    assert insumo["ingredientes_declarados"] == "Azúcar, pasta de cacao, leche en polvo"
    assert insumo["advertencias"] == "Puede contener trazas de maní"
    assert insumo["ficha"] == {"product_name": "Chocolate", "ingredients": ["azúcar"]}
    assert insumo["fuente"] == "open_food_facts"
    assert insumo["fecha_recuperacion"].startswith("2026-10-04T15:30:00")


@pytest.mark.parametrize("campo", ["nombre", "marca_origen", "ingrediente_id"])
def test_rechaza_cuando_falta_un_dato_obligatorio(client, ana, leche, campo) -> None:
    payload = _payload(leche)
    del payload[campo]

    assert client.post("/gestion/insumos", headers=ana, json=payload).status_code == 422


@pytest.mark.parametrize("campo", ["nombre", "marca_origen"])
@pytest.mark.parametrize("valor", ["", "   "])
def test_rechaza_nombre_y_marca_vacios(client, ana, leche, campo, valor) -> None:
    payload = _payload(leche, **{campo: valor})

    assert client.post("/gestion/insumos", headers=ana, json=payload).status_code == 422


def test_los_textos_se_recortan_y_los_opcionales_vacios_quedan_nulos(client, ana, leche) -> None:
    insumo = _crear(
        client, ana, leche,
        nombre="  Leche entera  ", marca_origen=" Colun ",
        presentacion="  ", ingredientes_declarados="", advertencias="  Contiene leche  ",
    )

    assert insumo["nombre"] == "Leche entera"
    assert insumo["marca_origen"] == "Colun"
    assert insumo["presentacion"] is None
    assert insumo["ingredientes_declarados"] is None
    assert insumo["advertencias"] == "Contiene leche"


@pytest.mark.parametrize(
    "extra",
    [
        {"productor_id": 99},
        {"activo": False},
        {"alergenos_declarados": [{"alergeno_id": 1, "tipo": "contiene"}]},
        {"id": 5},
    ],
)
def test_rechaza_campos_que_no_se_pueden_enviar_al_crear(client, ana, leche, extra) -> None:
    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, **extra))

    assert response.status_code == 422


@pytest.mark.parametrize(
    "extra",
    [
        {"fuente": "upcitemdb"},
        {"fecha_recuperacion": "2026-10-04T15:30:00"},
        {"fecha_recuperacion": "no es una fecha"},
        {"ficha": ["no", "es", "objeto"]},
    ],
)
def test_rechaza_fuente_fecha_o_ficha_invalidas(client, ana, leche, extra) -> None:
    assert client.post("/gestion/insumos", headers=ana, json=_payload(leche, **extra)).status_code == 422


# --- ingrediente asociado ---


def test_ingrediente_inexistente_responde_422(client, ana) -> None:
    response = client.post("/gestion/insumos", headers=ana, json=_payload(99999))

    assert response.status_code == 422
    assert response.json()["detail"] == "Ingrediente no válido"


def test_ingrediente_de_otro_productor_responde_422(client, ana, beto) -> None:
    ajeno = _ingrediente(client, beto, "LEC-001", "Leche de Beto")

    response = client.post("/gestion/insumos", headers=ana, json=_payload(ajeno))

    assert response.status_code == 422
    assert response.json()["detail"] == "Ingrediente no válido"


def test_ingrediente_inactivo_responde_422(client, ana, leche) -> None:
    assert client.delete(f"/gestion/ingredientes/{leche}", headers=ana).status_code == 204

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche))

    assert response.status_code == 422
    assert response.json()["detail"] == "Ingrediente no válido"


def test_cambiar_a_un_ingrediente_no_valido_responde_422_y_no_cambia_nada(client, ana, beto, leche) -> None:
    insumo = _crear(client, ana, leche, habitual=True)
    ajeno = _ingrediente(client, beto, "LEC-001", "Leche de Beto")

    for destino in (ajeno, 99999):
        response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"ingrediente_id": destino})
        assert response.status_code == 422
        assert response.json()["detail"] == "Ingrediente no válido"
    assert _obtener(client, ana, insumo["id"])["ingrediente_id"] == leche
    assert _obtener(client, ana, insumo["id"])["habitual"] is True


def test_varios_insumos_pueden_asociarse_al_mismo_ingrediente(client, ana, leche) -> None:
    _crear(client, ana, leche, nombre="Leche A")
    _crear(client, ana, leche, nombre="Leche B")
    _crear(client, ana, leche, nombre="Leche C")

    listado = client.get(f"/gestion/insumos?ingrediente_id={leche}", headers=ana).json()
    assert [i["nombre"] for i in listado] == ["Leche C", "Leche B", "Leche A"]
    assert {i["ingrediente_id"] for i in listado} == {leche}


# --- código de barras ---


@pytest.mark.parametrize("codigo", [EAN_13, UPC_A, EAN_8])
def test_acepta_ean_13_upc_a_y_ean_8(client, ana, leche, codigo) -> None:
    assert _crear(client, ana, leche, codigo_barras=codigo)["codigo_barras"] == codigo


@pytest.mark.parametrize(
    ("entrada", "guardado"),
    [(" 780 291 0000971 ", EAN_13), ("\t7802910000971\n", EAN_13), ("", None), ("   ", None)],
)
def test_normaliza_el_codigo_de_barras(client, ana, leche, entrada, guardado) -> None:
    assert _crear(client, ana, leche, codigo_barras=entrada)["codigo_barras"] == guardado


def test_varios_insumos_sin_codigo_de_barras_son_validos(client, ana, leche) -> None:
    for entrada in (None, "", "   "):
        _crear(client, ana, leche, nombre=f"Sin código {entrada!r}", codigo_barras=entrada)

    assert len(client.get("/gestion/insumos", headers=ana).json()) == 3


def test_rechaza_un_digito_verificador_invalido(client, ana, leche) -> None:
    invalido = EAN_13[:-1] + "2"

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, codigo_barras=invalido))

    assert response.status_code == 422
    assert "dígito verificador" in str(response.json()["detail"])
    assert client.get("/gestion/insumos", headers=ana).json() == []


@pytest.mark.parametrize("codigo", ["1234567", "123456789", "12345678901", "12345678901234", "78029100009AB", "ABCDEFGH"])
def test_rechaza_largos_y_caracteres_no_permitidos(client, ana, leche, codigo) -> None:
    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, codigo_barras=codigo))

    assert response.status_code == 422
    assert "8, 12 o 13 dígitos" in str(response.json()["detail"])


def test_codigo_repetido_de_un_insumo_activo_responde_409_con_el_id_existente(client, ana, leche) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13)

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, nombre="Otro", codigo_barras=EAN_13))

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": MSG_CODIGO_ACTIVO,
        "insumo_id": existente["id"],
        "activo": True,
    }
    assert len(client.get("/gestion/insumos", headers=ana).json()) == 1


def test_codigo_repetido_de_un_insumo_inactivo_responde_409_distinguiendo_el_caso(client, ana, leche) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13)
    assert client.delete(f"/gestion/insumos/{existente['id']}", headers=ana).status_code == 204

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, nombre="Otro", codigo_barras=EAN_13))

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "mensaje": MSG_CODIGO_INACTIVO,
        "insumo_id": existente["id"],
        "activo": False,
    }


def test_el_codigo_repetido_se_detecta_aunque_cambie_el_formato_de_entrada(client, ana, leche) -> None:
    _crear(client, ana, leche, codigo_barras=EAN_13)

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, codigo_barras=" 780 291 0000971 "))

    assert response.status_code == 409


def test_el_mismo_codigo_en_productores_distintos_es_valido(client, ana, beto, leche) -> None:
    ingrediente_beto = _ingrediente(client, beto, "LEC-001", "Leche")

    _crear(client, ana, leche, codigo_barras=EAN_13)
    insumo_beto = _crear(client, beto, ingrediente_beto, codigo_barras=EAN_13)

    assert insumo_beto["codigo_barras"] == EAN_13


def test_modificar_a_un_codigo_de_otro_insumo_responde_409(client, ana, leche) -> None:
    _crear(client, ana, leche, nombre="A", codigo_barras=EAN_13)
    otro = _crear(client, ana, leche, nombre="B", codigo_barras=OTRO_EAN_13)

    response = client.patch(f"/gestion/insumos/{otro['id']}", headers=ana, json={"codigo_barras": EAN_13})

    assert response.status_code == 409
    assert response.json()["detail"]["mensaje"] == MSG_CODIGO_ACTIVO
    assert _obtener(client, ana, otro["id"])["codigo_barras"] == OTRO_EAN_13


def test_conservar_o_reenviar_el_propio_codigo_no_es_un_conflicto(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche, codigo_barras=EAN_13)

    response = client.patch(
        f"/gestion/insumos/{insumo['id']}",
        headers=ana,
        json={"codigo_barras": " 780 291 0000971", "nombre": "Leche renombrada"},
    )

    assert response.status_code == 200
    assert response.json()["codigo_barras"] == EAN_13


def test_la_base_respalda_la_unicidad_si_dos_peticiones_compiten(client, ana, leche, monkeypatch) -> None:
    existente = _crear(client, ana, leche, codigo_barras=EAN_13)
    # Simulates a race: the pre-check does not see the other supply, the unique index does.
    monkeypatch.setattr(InsumoService, "_ensure_codigo_disponible", lambda *a, **k: None)

    response = client.post("/gestion/insumos", headers=ana, json=_payload(leche, nombre="Otro", codigo_barras=EAN_13))

    assert response.status_code == 409
    assert response.json()["detail"]["insumo_id"] == existente["id"]
    assert len(client.get("/gestion/insumos", headers=ana).json()) == 1


# --- listado y detalle ---


def test_lista_unicamente_los_insumos_del_productor(client, ana, beto, leche) -> None:
    propio = _crear(client, ana, leche)
    ingrediente_beto = _ingrediente(client, beto, "LEC-001", "Leche")
    _crear(client, beto, ingrediente_beto, nombre="Ajeno")

    assert [i["id"] for i in client.get("/gestion/insumos", headers=ana).json()] == [propio["id"]]


def test_el_listado_por_defecto_muestra_solo_activos_y_activo_false_los_inactivos(client, ana, leche) -> None:
    activo = _crear(client, ana, leche, nombre="Activo")
    inactivo = _crear(client, ana, leche, nombre="Inactivo")
    client.delete(f"/gestion/insumos/{inactivo['id']}", headers=ana)

    por_defecto = client.get("/gestion/insumos", headers=ana).json()
    solo_activos = client.get("/gestion/insumos?activo=true", headers=ana).json()
    solo_inactivos = client.get("/gestion/insumos?activo=false", headers=ana).json()

    assert [i["id"] for i in por_defecto] == [activo["id"]]
    assert [i["id"] for i in solo_activos] == [activo["id"]]
    assert [(i["id"], i["activo"]) for i in solo_inactivos] == [(inactivo["id"], False)]


def test_filtra_por_ingrediente_y_combina_con_el_estado(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    de_leche = _crear(client, ana, leche, nombre="Leche")
    de_harina = _crear(client, ana, harina, nombre="Harina")
    inactivo = _crear(client, ana, harina, nombre="Harina vieja")
    client.delete(f"/gestion/insumos/{inactivo['id']}", headers=ana)

    assert [i["id"] for i in client.get(f"/gestion/insumos?ingrediente_id={leche}", headers=ana).json()] == [de_leche["id"]]
    assert [i["id"] for i in client.get(f"/gestion/insumos?ingrediente_id={harina}", headers=ana).json()] == [de_harina["id"]]
    assert [i["id"] for i in client.get(f"/gestion/insumos?ingrediente_id={harina}&activo=false", headers=ana).json()] == [inactivo["id"]]


def test_filtrar_por_un_ingrediente_ajeno_o_inexistente_devuelve_lista_vacia(client, ana, beto, leche) -> None:
    _crear(client, ana, leche)
    ajeno = _ingrediente(client, beto, "LEC-001", "Leche")

    assert client.get(f"/gestion/insumos?ingrediente_id={ajeno}", headers=ana).json() == []
    assert client.get("/gestion/insumos?ingrediente_id=99999", headers=ana).json() == []
    assert client.get("/gestion/insumos?ingrediente_id=0", headers=ana).status_code == 422
    assert client.get("/gestion/insumos?activo=quizas", headers=ana).status_code == 422


def test_el_detalle_incluye_ingrediente_y_alergenos_declarados_en_solo_lectura(client, db_session, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    catalogo = [
        Alergeno(codigo="sesamo", nombre="Sésamo", obligatorio_chile=False),
        Alergeno(codigo="cacahuetes", nombre="Maní", obligatorio_chile=True),
        Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True),
    ]
    db_session.add_all(catalogo)
    db_session.flush()
    db_session.add_all(
        [
            InsumoAlergeno(insumo_id=insumo["id"], alergeno_id=catalogo[0].id, tipo="trazas"),
            InsumoAlergeno(insumo_id=insumo["id"], alergeno_id=catalogo[1].id, tipo="trazas"),
            InsumoAlergeno(insumo_id=insumo["id"], alergeno_id=catalogo[2].id, tipo="contiene"),
        ]
    )
    db_session.commit()

    detalle = _obtener(client, ana, insumo["id"])

    assert detalle["ingrediente"] == {"id": leche, "nombre": "Leche"}
    assert [(a["codigo"], a["nombre"], a["obligatorio_chile"], a["tipo"]) for a in detalle["alergenos_declarados"]] == [
        ("lacteos", "Leche", True, "contiene"),
        ("cacahuetes", "Maní", True, "trazas"),
        ("sesamo", "Sésamo", False, "trazas"),
    ]
    assert {"alergeno_id"} <= set(detalle["alergenos_declarados"][0])
    en_listado = client.get("/gestion/insumos", headers=ana).json()[0]
    assert [a["codigo"] for a in en_listado["alergenos_declarados"]] == ["lacteos", "cacahuetes", "sesamo"]


def test_consulta_el_detalle_de_un_insumo_propio_aunque_este_inactivo(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana)

    detalle = _obtener(client, ana, insumo["id"])

    assert detalle["activo"] is False


def test_un_insumo_ajeno_o_inexistente_responde_404(client, ana, beto, leche) -> None:
    ingrediente_beto = _ingrediente(client, beto, "LEC-001", "Leche")
    ajeno = _crear(client, beto, ingrediente_beto)

    for insumo_id in (ajeno["id"], 99999):
        ruta = f"/gestion/insumos/{insumo_id}"
        assert client.get(ruta, headers=ana).status_code == 404
        assert client.patch(ruta, headers=ana, json={"nombre": "Intento"}).status_code == 404
        assert client.delete(ruta, headers=ana).status_code == 404
    assert _obtener(client, beto, ajeno["id"])["nombre"] == "Leche Colun Semidescremada 1 L"
    assert _obtener(client, beto, ajeno["id"])["activo"] is True


# --- modificación ---


def test_actualiza_parcialmente_un_insumo(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche, presentacion="1 L", advertencias="Contiene leche")

    response = client.patch(
        f"/gestion/insumos/{insumo['id']}",
        headers=ana,
        json={"nombre": "Leche Colun Entera 1 L", "ingredientes_declarados": "Leche entera"},
    )

    assert response.status_code == 200
    actualizado = response.json()
    assert actualizado["nombre"] == "Leche Colun Entera 1 L"
    assert actualizado["ingredientes_declarados"] == "Leche entera"
    assert actualizado["presentacion"] == "1 L"
    assert actualizado["advertencias"] == "Contiene leche"
    assert actualizado["marca_origen"] == "Colun"
    assert _obtener(client, ana, insumo["id"])["nombre"] == "Leche Colun Entera 1 L"


def test_los_campos_opcionales_se_pueden_limpiar_con_null(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche, presentacion="1 L", codigo_barras=EAN_13, ficha={"a": 1}, fecha_recuperacion="2026-10-04T15:30:00Z")

    response = client.patch(
        f"/gestion/insumos/{insumo['id']}",
        headers=ana,
        json={"presentacion": None, "codigo_barras": None, "ficha": None, "fecha_recuperacion": None},
    )

    assert response.status_code == 200
    assert {k: response.json()[k] for k in ("presentacion", "codigo_barras", "ficha", "fecha_recuperacion")} == {
        "presentacion": None, "codigo_barras": None, "ficha": None, "fecha_recuperacion": None,
    }
    # the barcode is free again
    assert _crear(client, ana, leche, nombre="Otro", codigo_barras=EAN_13)["codigo_barras"] == EAN_13


@pytest.mark.parametrize("campo", ["nombre", "marca_origen", "ingrediente_id", "fuente", "habitual", "activo"])
def test_los_obligatorios_no_admiten_null_al_modificar(client, ana, leche, campo) -> None:
    insumo = _crear(client, ana, leche)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={campo: None})

    assert response.status_code == 422


@pytest.mark.parametrize(
    "cuerpo",
    [{"productor_id": 99}, {"id": 7}, {"alergenos_declarados": []}, {"created_at": "2026-01-01T00:00:00Z"}, {"nombre": ""}, {"codigo_barras": "1234"}],
)
def test_rechaza_campos_no_permitidos_o_invalidos_al_modificar(client, ana, leche, cuerpo) -> None:
    insumo = _crear(client, ana, leche)

    assert client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json=cuerpo).status_code == 422


def test_un_cuerpo_vacio_devuelve_el_insumo_sin_cambios(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={})

    assert response.status_code == 200
    assert response.json() == insumo


def test_modificar_un_insumo_cambia_su_ingrediente(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    insumo = _crear(client, ana, leche)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"ingrediente_id": harina})

    assert response.status_code == 200
    assert response.json()["ingrediente"] == {"id": harina, "nombre": "Harina"}


# --- desactivar y reactivar ---


def test_desactivar_responde_204_y_el_insumo_deja_el_listado_de_activos(client, db_session, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    assert client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana).status_code == 204

    assert client.get("/gestion/insumos", headers=ana).json() == []
    assert db_session.get(InsumoComercial, insumo["id"]) is not None
    assert _obtener(client, ana, insumo["id"])["activo"] is False


def test_desactivar_es_idempotente(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    assert client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana).status_code == 204
    assert client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana).status_code == 204


def test_se_puede_desactivar_con_patch_y_reactivar_con_patch(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    desactivado = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"activo": False})
    reactivado = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"activo": True})

    assert desactivado.status_code == 200 and desactivado.json()["activo"] is False
    assert reactivado.status_code == 200 and reactivado.json()["activo"] is True
    assert reactivado.json()["habitual"] is False
    assert [i["id"] for i in client.get("/gestion/insumos", headers=ana).json()] == [insumo["id"]]


def test_un_insumo_inactivo_se_puede_editar(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"nombre": "Corregido"})

    assert response.status_code == 200
    assert response.json()["nombre"] == "Corregido"
    assert response.json()["activo"] is False


# --- insumo habitual: las cuatro reglas ---


def _habitual_de(client, headers, ingrediente_id) -> list[int]:
    listado = client.get(f"/gestion/insumos?ingrediente_id={ingrediente_id}", headers=headers).json()
    return sorted(i["id"] for i in listado if i["habitual"])


def test_regla_1_marcar_un_habitual_desmarca_al_anterior_del_mismo_ingrediente(client, ana, leche) -> None:
    primero = _crear(client, ana, leche, nombre="A", habitual=True)
    segundo = _crear(client, ana, leche, nombre="B")

    response = client.patch(f"/gestion/insumos/{segundo['id']}", headers=ana, json={"habitual": True})

    assert response.status_code == 200
    assert response.json()["habitual"] is True
    assert _obtener(client, ana, primero["id"])["habitual"] is False
    assert _habitual_de(client, ana, leche) == [segundo["id"]]


def test_regla_1_crear_como_habitual_tambien_desmarca_al_anterior(client, ana, leche) -> None:
    primero = _crear(client, ana, leche, nombre="A", habitual=True)

    segundo = _crear(client, ana, leche, nombre="B", habitual=True)

    assert segundo["habitual"] is True
    assert _habitual_de(client, ana, leche) == [segundo["id"]]
    assert _obtener(client, ana, primero["id"])["habitual"] is False


def test_regla_1_cada_ingrediente_tiene_su_propio_habitual(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    de_leche = _crear(client, ana, leche, nombre="Leche", habitual=True)
    de_harina = _crear(client, ana, harina, nombre="Harina", habitual=True)

    assert _obtener(client, ana, de_leche["id"])["habitual"] is True
    assert _obtener(client, ana, de_harina["id"])["habitual"] is True


def test_regla_1_marcar_de_nuevo_al_que_ya_es_habitual_no_cambia_nada(client, ana, leche) -> None:
    habitual = _crear(client, ana, leche, habitual=True)

    response = client.patch(f"/gestion/insumos/{habitual['id']}", headers=ana, json={"habitual": True})

    assert response.status_code == 200
    assert _habitual_de(client, ana, leche) == [habitual["id"]]


def test_regla_2_un_insumo_desactivado_no_puede_marcarse_como_habitual(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"habitual": True})

    assert response.status_code == 422
    assert "desactivado" in response.json()["detail"]
    assert _obtener(client, ana, insumo["id"])["habitual"] is False


def test_regla_2_desactivar_y_marcar_habitual_en_la_misma_peticion_se_rechaza(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"activo": False, "habitual": True})

    assert response.status_code == 422
    estado = _obtener(client, ana, insumo["id"])
    assert (estado["activo"], estado["habitual"]) == (True, False)


def test_regla_2_reactivar_y_marcar_habitual_en_la_misma_peticion_si_se_permite(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    client.delete(f"/gestion/insumos/{insumo['id']}", headers=ana)

    response = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"activo": True, "habitual": True})

    assert response.status_code == 200
    assert (response.json()["activo"], response.json()["habitual"]) == (True, True)


@pytest.mark.parametrize("como", ["delete", "patch"])
def test_regla_3_al_desactivar_un_habitual_pierde_la_marca(client, ana, leche, como) -> None:
    habitual = _crear(client, ana, leche, habitual=True)
    ruta = f"/gestion/insumos/{habitual['id']}"

    respuesta = client.delete(ruta, headers=ana) if como == "delete" else client.patch(ruta, headers=ana, json={"activo": False})

    assert respuesta.status_code in (200, 204)
    estado = _obtener(client, ana, habitual["id"])
    assert (estado["activo"], estado["habitual"]) == (False, False)
    # the ingredient has no habitual supply and another one can take the mark
    otro = _crear(client, ana, leche, nombre="Otro", habitual=True)
    assert _habitual_de(client, ana, leche) == [otro["id"]]


def test_regla_3_al_reactivar_no_recupera_la_marca(client, ana, leche) -> None:
    habitual = _crear(client, ana, leche, habitual=True)
    client.delete(f"/gestion/insumos/{habitual['id']}", headers=ana)

    reactivado = client.patch(f"/gestion/insumos/{habitual['id']}", headers=ana, json={"activo": True})

    assert reactivado.json()["habitual"] is False


def test_regla_4_cambiar_el_ingrediente_de_un_habitual_le_quita_la_marca(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    habitual = _crear(client, ana, leche, habitual=True)

    response = client.patch(f"/gestion/insumos/{habitual['id']}", headers=ana, json={"ingrediente_id": harina})

    assert response.status_code == 200
    assert response.json()["habitual"] is False
    assert _habitual_de(client, ana, leche) == []
    assert _habitual_de(client, ana, harina) == []


def test_regla_4_si_la_misma_modificacion_pide_habitual_lo_es_del_nuevo_ingrediente(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    habitual_leche = _crear(client, ana, leche, nombre="Leche", habitual=True)
    habitual_harina = _crear(client, ana, harina, nombre="Harina vieja", habitual=True)

    response = client.patch(
        f"/gestion/insumos/{habitual_leche['id']}",
        headers=ana,
        json={"ingrediente_id": harina, "habitual": True},
    )

    assert response.status_code == 200
    assert (response.json()["ingrediente_id"], response.json()["habitual"]) == (harina, True)
    assert _habitual_de(client, ana, harina) == [habitual_leche["id"]]
    assert _obtener(client, ana, habitual_harina["id"])["habitual"] is False
    assert _habitual_de(client, ana, leche) == []


def test_regla_4_un_no_habitual_que_cambia_de_ingrediente_sigue_sin_serlo(client, ana, leche) -> None:
    harina = _ingrediente(client, ana, "HAR-001", "Harina")
    habitual_harina = _crear(client, ana, harina, nombre="Harina", habitual=True)
    insumo = _crear(client, ana, leche, nombre="Leche")

    client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"ingrediente_id": harina})

    assert _habitual_de(client, ana, harina) == [habitual_harina["id"]]


# --- atomicidad ---


def test_las_reglas_del_habitual_son_atomicas_si_algo_falla_al_guardar(client, ana, leche, monkeypatch) -> None:
    anterior = _crear(client, ana, leche, nombre="A", habitual=True)
    nuevo = _crear(client, ana, leche, nombre="B")

    def falla_al_confirmar(self) -> None:
        self.db.rollback()
        raise IntegrityError("COMMIT", {}, Exception("fallo simulado"))

    with monkeypatch.context() as m:
        m.setattr(InsumoRepository, "commit", falla_al_confirmar)
        response = client.patch(f"/gestion/insumos/{nuevo['id']}", headers=ana, json={"habitual": True})

    assert response.status_code == 409
    assert "cambio simultáneo" in response.json()["detail"]
    assert _habitual_de(client, ana, leche) == [anterior["id"]]
    assert _obtener(client, ana, nuevo["id"])["habitual"] is False


def test_un_error_de_validacion_no_desmarca_al_habitual_anterior(client, ana, leche) -> None:
    anterior = _crear(client, ana, leche, nombre="A", habitual=True)
    otro = _crear(client, ana, leche, nombre="B", codigo_barras=EAN_13)
    _crear(client, ana, leche, nombre="C", codigo_barras=OTRO_EAN_13)

    response = client.patch(
        f"/gestion/insumos/{otro['id']}",
        headers=ana,
        json={"habitual": True, "codigo_barras": OTRO_EAN_13},
    )

    assert response.status_code == 409
    assert _habitual_de(client, ana, leche) == [anterior["id"]]


def test_el_indice_parcial_respalda_el_habitual_unico_si_dos_peticiones_compiten(client, ana, leche, monkeypatch) -> None:
    anterior = _crear(client, ana, leche, nombre="A", habitual=True)
    nuevo = _crear(client, ana, leche, nombre="B")
    # Simulates a race: the other request marked a habitual after this one cleared the mark.
    monkeypatch.setattr(InsumoRepository, "clear_habitual", lambda *a, **k: None)

    response = client.patch(f"/gestion/insumos/{nuevo['id']}", headers=ana, json={"habitual": True})

    assert response.status_code == 409
    assert "cambio simultáneo" in response.json()["detail"]
    monkeypatch.undo()
    assert _habitual_de(client, ana, leche) == [anterior["id"]]
