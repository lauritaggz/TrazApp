"""Authenticated ingredient management API tests (T02-02 / HU02)."""

import pytest
from sqlalchemy import func, select

from app.models import Ingrediente, VersionIngrediente

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu02@ejemplo.com",
    "password": "SecretoProductor123!",
}

PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu02@ejemplo.com",
    "password": "SecretoProductor123!",
}

INGREDIENTE_BASE = {
    "codigo_interno": "har-001",
    "nombre": "Harina de trigo",
    "descripcion": "Harina integral",
    "tipo": "simple",
}


def _register_and_login(client, payload: dict) -> dict:
    register_response = client.post("/auth/register", json=payload)
    assert register_response.status_code == 201
    login_response = client.post(
        "/auth/login",
        json={"email": payload["email"], "password": payload["password"]},
    )
    assert login_response.status_code == 200
    return login_response.json()


def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _count_versiones(db_session, ingrediente_id: int) -> int:
    return db_session.scalar(
        select(func.count())
        .select_from(VersionIngrediente)
        .where(VersionIngrediente.ingrediente_id == ingrediente_id)
    )


def test_productor_autenticado_crea_ingrediente_valido(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login["access_token"]),
        json=INGREDIENTE_BASE,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["codigo_interno"] == "HAR-001"
    assert body["nombre"] == INGREDIENTE_BASE["nombre"]
    assert body["descripcion"] == INGREDIENTE_BASE["descripcion"]
    assert body["tipo"] == "simple"
    assert body["activo"] is True
    assert body["productor_id"] == login["productor"]["id"]
    assert body["created_at"] is not None


def test_ingrediente_queda_asociado_al_productor_autenticado(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login["access_token"]),
        json=INGREDIENTE_BASE,
    )
    assert response.status_code == 201
    ingrediente_id = response.json()["id"]

    ingrediente = db_session.get(Ingrediente, ingrediente_id)
    assert ingrediente is not None
    assert ingrediente.productor_id == login["productor"]["id"]


def test_creacion_rechaza_campos_obligatorios_vacios(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    response = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={
            "codigo_interno": "",
            "nombre": "Harina",
            "tipo": "simple",
        },
    )
    assert response.status_code == 422


def test_creacion_rechaza_tipo_invalido(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login["access_token"]),
        json={**INGREDIENTE_BASE, "tipo": "mezcla"},
    )

    assert response.status_code == 422


def test_productor_id_no_puede_enviarse_desde_el_cliente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login["access_token"]),
        json={**INGREDIENTE_BASE, "productor_id": 999},
    )

    assert response.status_code == 422


def test_codigo_interno_duplicado_devuelve_409(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    first = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    )
    assert first.status_code == 201

    duplicate = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={**INGREDIENTE_BASE, "nombre": "Otra harina"},
    )
    assert duplicate.status_code == 409


def test_dos_productores_pueden_usar_mismo_codigo_interno(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created_a = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
        json=INGREDIENTE_BASE,
    )
    created_b = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_b["access_token"]),
        json=INGREDIENTE_BASE,
    )

    assert created_a.status_code == 201
    assert created_b.status_code == 201


def test_productor_lista_unicamente_sus_propios_ingredientes(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created_a = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
        json=INGREDIENTE_BASE,
    ).json()
    created_b = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_b["access_token"]),
        json={**INGREDIENTE_BASE, "codigo_interno": "azu-001", "nombre": "Azúcar"},
    ).json()

    list_a = client.get(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
    )
    list_b = client.get(
        "/gestion/ingredientes",
        headers=_auth_headers(login_b["access_token"]),
    )

    assert list_a.status_code == 200
    assert list_b.status_code == 200
    assert [item["id"] for item in list_a.json()] == [created_a["id"]]
    assert [item["id"] for item in list_b.json()] == [created_b["id"]]


def test_productor_consulta_detalle_de_su_ingrediente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    detail = client.get(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
    )

    assert detail.status_code == 200
    assert detail.json()["id"] == created["id"]
    assert detail.json()["nombre"] == INGREDIENTE_BASE["nombre"]


def test_acceso_a_ingrediente_ajeno_devuelve_404(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
        json=INGREDIENTE_BASE,
    ).json()

    detail = client.get(
        f"/gestion/ingredientes/{created['id']}",
        headers=_auth_headers(login_b["access_token"]),
    )

    assert detail.status_code == 404


def test_actualizacion_parcial_de_ingrediente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
        json={"nombre": "Harina premium", "tipo": "compuesto"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["nombre"] == "Harina premium"
    assert body["tipo"] == "compuesto"
    assert body["codigo_interno"] == "HAR-001"


def test_actualizacion_permite_limpiar_descripcion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
        json={"descripcion": None},
    )

    assert response.status_code == 200
    assert response.json()["descripcion"] is None


def test_patch_ingrediente_ajeno_devuelve_404(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
        json=INGREDIENTE_BASE,
    ).json()

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=_auth_headers(login_b["access_token"]),
        json={"nombre": "Intento ajeno"},
    )

    assert response.status_code == 404


def test_patch_rechaza_activo_desde_cliente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    response = client.patch(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
        json={"activo": False},
    )

    assert response.status_code == 422


def test_desactivar_ingrediente_propio_marca_inactivo(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    response = client.delete(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
    )

    assert response.status_code == 204
    db_session.expire_all()
    ingrediente = db_session.get(Ingrediente, created["id"])
    assert ingrediente is not None
    assert ingrediente.activo is False


def test_desactivar_desaparece_del_listado_y_get_devuelve_404(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    list_before = client.get("/gestion/ingredientes", headers=headers)
    assert list_before.status_code == 200
    assert len(list_before.json()) == 1

    delete_response = client.delete(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_after = client.get("/gestion/ingredientes", headers=headers)
    assert list_after.status_code == 200
    assert list_after.json() == []

    detail = client.get(
        f"/gestion/ingredientes/{created['id']}",
        headers=headers,
    )
    assert detail.status_code == 404


def test_desactivar_ingrediente_ajeno_devuelve_404(client, db_session) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created = client.post(
        "/gestion/ingredientes",
        headers=_auth_headers(login_a["access_token"]),
        json=INGREDIENTE_BASE,
    ).json()

    response = client.delete(
        f"/gestion/ingredientes/{created['id']}",
        headers=_auth_headers(login_b["access_token"]),
    )

    assert response.status_code == 404
    db_session.expire_all()
    ingrediente = db_session.get(Ingrediente, created["id"])
    assert ingrediente is not None
    assert ingrediente.activo is True


def test_ingrediente_legacy_null_no_aparece_en_listado_hu02(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    legacy = Ingrediente(nombre="Chocolate legacy", activo=True)
    db_session.add(legacy)
    db_session.commit()
    db_session.refresh(legacy)
    assert legacy.productor_id is None

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    )
    assert created.status_code == 201

    listing = client.get("/gestion/ingredientes", headers=headers)
    assert listing.status_code == 200
    ids = {item["id"] for item in listing.json()}
    assert legacy.id not in ids

    get_legacy = client.get(f"/gestion/ingredientes/{legacy.id}", headers=headers)
    assert get_legacy.status_code == 404

    patch_legacy = client.patch(
        f"/gestion/ingredientes/{legacy.id}",
        headers=headers,
        json={"nombre": "Intento sobre legacy"},
    )
    assert patch_legacy.status_code == 404


def test_endpoints_legacy_no_operan_sobre_ingrediente_hu02(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    version_response = client.post(
        f"/ingredientes/{created['id']}/versiones",
        json={
            "composicion_declarada": "Intento legacy",
            "alergenos_declarados": "",
        },
    )
    assert version_response.status_code == 404

    list_versions = client.get(f"/ingredientes/{created['id']}/versiones")
    assert list_versions.status_code == 404


def test_crear_no_genera_version_ingrediente(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()

    assert _count_versiones(db_session, created["id"]) == 0


def test_desactivar_mantiene_version_ingrediente_existente(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json=INGREDIENTE_BASE,
    ).json()
    ingrediente_id = created["id"]

    version = VersionIngrediente(
        ingrediente_id=ingrediente_id,
        numero_version=1,
        composicion_declarada="Histórico",
        alergenos_declarados="",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)

    response = client.delete(
        f"/gestion/ingredientes/{ingrediente_id}",
        headers=headers,
    )
    assert response.status_code == 204

    db_session.expire_all()
    assert db_session.get(VersionIngrediente, version.id) is not None
    assert _count_versiones(db_session, ingrediente_id) == 1


def test_sin_autenticacion_devuelve_401(client) -> None:
    response = client.get("/gestion/ingredientes")
    assert response.status_code == 401


@pytest.mark.parametrize("method,path", [
    ("post", "/gestion/ingredientes"),
    ("get", "/gestion/ingredientes"),
    ("get", "/gestion/ingredientes/1"),
    ("patch", "/gestion/ingredientes/1"),
    ("delete", "/gestion/ingredientes/1"),
])
def test_rutas_gestion_requieren_autenticacion(client, method, path) -> None:
    request = getattr(client, method)
    kwargs = {}
    if method in {"post", "patch"}:
        kwargs["json"] = INGREDIENTE_BASE if method == "post" else {"nombre": "X"}
    response = request(path, **kwargs)
    assert response.status_code == 401
