"""Authenticated product management API tests (T01-03 / HU01)."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import Categoria, Producto, VersionProducto

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu01@ejemplo.com",
    "password": "SecretoProductor123!",
}

PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu01@ejemplo.com",
    "password": "SecretoProductor123!",
}

PRODUCTO_BASE = {
    "codigo_interno": "gal-001",
    "nombre": "Galleta de chocolate",
    "descripcion": "Galleta artesanal con cobertura de chocolate.",
    "contenido_neto": "250.000",
    "unidad_medida": "g",
    "presentacion": "Bolsa resellable",
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


def _count_versiones(db_session, producto_id: int) -> int:
    return db_session.scalar(
        select(func.count())
        .select_from(VersionProducto)
        .where(VersionProducto.producto_id == producto_id)
    )


def test_productor_autenticado_crea_producto_valido(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/productos",
        headers=_auth_headers(login["access_token"]),
        json=PRODUCTO_BASE,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["codigo_interno"] == "GAL-001"
    assert body["nombre"] == PRODUCTO_BASE["nombre"]
    assert body["descripcion"] == PRODUCTO_BASE["descripcion"]
    assert Decimal(body["contenido_neto"]) == Decimal("250.000")
    assert body["unidad_medida"] == "g"
    assert body["presentacion"] == "Bolsa resellable"
    assert body["activo"] is True
    assert body["productor_id"] == login["productor"]["id"]
    assert body["created_at"] is not None


def test_producto_queda_asociado_al_productor_autenticado(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/productos",
        headers=_auth_headers(login["access_token"]),
        json=PRODUCTO_BASE,
    )
    assert response.status_code == 201
    producto_id = response.json()["id"]

    producto = db_session.get(Producto, producto_id)
    assert producto is not None
    assert producto.productor_id == login["productor"]["id"]


def test_productor_id_no_puede_enviarse_desde_el_cliente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.post(
        "/gestion/productos",
        headers=_auth_headers(login["access_token"]),
        json={**PRODUCTO_BASE, "productor_id": 999},
    )

    assert response.status_code == 422


def test_productor_lista_unicamente_sus_propios_productos(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created_a = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_a["access_token"]),
        json=PRODUCTO_BASE,
    ).json()
    created_b = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_b["access_token"]),
        json={**PRODUCTO_BASE, "codigo_interno": "pan-001", "nombre": "Pan"},
    ).json()

    list_a = client.get(
        "/gestion/productos",
        headers=_auth_headers(login_a["access_token"]),
    )
    assert list_a.status_code == 200
    ids_a = {item["id"] for item in list_a.json()}
    assert created_a["id"] in ids_a
    assert created_b["id"] not in ids_a
    assert all(item["productor_id"] == login_a["productor"]["id"] for item in list_a.json())


def test_dos_productores_pueden_usar_mismo_codigo_interno(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    response_a = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_a["access_token"]),
        json=PRODUCTO_BASE,
    )
    response_b = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_b["access_token"]),
        json=PRODUCTO_BASE,
    )

    assert response_a.status_code == 201
    assert response_b.status_code == 201
    assert response_a.json()["codigo_interno"] == "GAL-001"
    assert response_b.json()["codigo_interno"] == "GAL-001"
    assert response_a.json()["productor_id"] != response_b.json()["productor_id"]


def test_mismo_productor_no_puede_repetir_codigo_interno(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    first = client.post("/gestion/productos", headers=headers, json=PRODUCTO_BASE)
    duplicate = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "nombre": "Otra galleta"},
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "Ya existe un producto con ese código interno."


def test_codigo_duplicado_409_y_operacion_posterior_sigue_funcionando(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    assert (
        client.post("/gestion/productos", headers=headers, json=PRODUCTO_BASE).status_code
        == 201
    )
    conflict = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "nombre": "Duplicada"},
    )
    assert conflict.status_code == 409

    recovery = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "codigo_interno": "gal-002", "nombre": "Recuperada"},
    )
    assert recovery.status_code == 201
    assert recovery.json()["codigo_interno"] == "GAL-002"


def test_productor_consulta_producto_propio(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()

    response = client.get(f"/gestion/productos/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]
    assert response.json()["codigo_interno"] == "GAL-001"


def test_producto_de_otro_productor_devuelve_404(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    created_b = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_b["access_token"]),
        json=PRODUCTO_BASE,
    ).json()

    get_response = client.get(
        f"/gestion/productos/{created_b['id']}",
        headers=_auth_headers(login_a["access_token"]),
    )
    patch_response = client.patch(
        f"/gestion/productos/{created_b['id']}",
        headers=_auth_headers(login_a["access_token"]),
        json={"nombre": "Intento indebido"},
    )

    assert get_response.status_code == 404
    assert patch_response.status_code == 404


def test_producto_legacy_null_no_aparece_en_listado_hu01(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    legacy = Producto(nombre="Legacy RT-01", activo=True)
    db_session.add(legacy)
    db_session.commit()
    db_session.refresh(legacy)
    assert legacy.productor_id is None

    owned = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()

    list_response = client.get("/gestion/productos", headers=headers)
    assert list_response.status_code == 200
    ids = {item["id"] for item in list_response.json()}
    assert owned["id"] in ids
    assert legacy.id not in ids

    get_legacy = client.get(f"/gestion/productos/{legacy.id}", headers=headers)
    assert get_legacy.status_code == 404

    patch_legacy = client.patch(
        f"/gestion/productos/{legacy.id}",
        headers=headers,
        json={"nombre": "Intento sobre legacy"},
    )
    assert patch_legacy.status_code == 404


def test_patch_codigo_duplicado_409_y_operacion_posterior_sigue_funcionando(
    client,
) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    first = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()
    second = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "codigo_interno": "pan-001", "nombre": "Pan"},
    ).json()

    conflict = client.patch(
        f"/gestion/productos/{second['id']}",
        headers=headers,
        json={"codigo_interno": first["codigo_interno"]},
    )
    assert conflict.status_code == 409

    recovery = client.patch(
        f"/gestion/productos/{second['id']}",
        headers=headers,
        json={"codigo_interno": "pan-002", "nombre": "Pan recuperado"},
    )
    assert recovery.status_code == 200
    assert recovery.json()["codigo_interno"] == "PAN-002"
    assert recovery.json()["nombre"] == "Pan recuperado"
    assert recovery.json()["id"] == second["id"]


def test_endpoints_legacy_no_operan_sobre_producto_hu01(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    owned = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()
    assert owned["productor_id"] == login["productor"]["id"]

    create_version = client.post(
        f"/productos/{owned['id']}/versiones",
        json={"descripcion": "Intento legacy sobre HU01"},
    )
    list_versions = client.get(f"/productos/{owned['id']}/versiones")

    assert create_version.status_code == 404
    assert list_versions.status_code == 404
    assert _count_versiones(db_session, owned["id"]) == 0

    # Even if a version existed for an owned product, lote creation must fail.
    version = VersionProducto(
        producto_id=owned["id"],
        numero_version=1,
        descripcion="Versión inyectada",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)

    lote_response = client.post(
        "/lotes-productos",
        json={
            "codigo_lote": "LP-HU01-BYPASS",
            "version_producto_id": version.id,
            "lotes_ingredientes": ["CH-NOEXISTE"],
        },
    )
    assert lote_response.status_code == 404



def test_patch_parcial_conserva_omitidos_y_mantiene_id_productor(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={"nombre": "Galleta revisada"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == created["id"]
    assert body["productor_id"] == created["productor_id"]
    assert body["nombre"] == "Galleta revisada"
    assert body["codigo_interno"] == created["codigo_interno"]
    assert body["descripcion"] == created["descripcion"]
    assert body["contenido_neto"] == created["contenido_neto"]
    assert body["unidad_medida"] == created["unidad_medida"]
    assert body["presentacion"] == created["presentacion"]


def test_patch_presentacion_null_elimina_presentacion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()
    assert created["presentacion"] == "Bolsa resellable"

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={"presentacion": None},
    )

    assert response.status_code == 200
    assert response.json()["presentacion"] is None


def test_patch_codigo_duplicado_mismo_productor_409(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    first = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()
    second = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "codigo_interno": "pan-001", "nombre": "Pan"},
    ).json()

    response = client.patch(
        f"/gestion/productos/{second['id']}",
        headers=headers,
        json={"codigo_interno": first["codigo_interno"]},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Ya existe un producto con ese código interno."


def test_patch_codigo_ocupado_por_otro_productor_permitido(client) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)

    client.post(
        "/gestion/productos",
        headers=_auth_headers(login_a["access_token"]),
        json=PRODUCTO_BASE,
    )
    created_b = client.post(
        "/gestion/productos",
        headers=_auth_headers(login_b["access_token"]),
        json={**PRODUCTO_BASE, "codigo_interno": "pan-001", "nombre": "Pan B"},
    ).json()

    response = client.patch(
        f"/gestion/productos/{created_b['id']}",
        headers=_auth_headers(login_b["access_token"]),
        json={"codigo_interno": "gal-001"},
    )

    assert response.status_code == 200
    assert response.json()["codigo_interno"] == "GAL-001"


def test_creacion_y_edicion_no_generan_version_producto(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    created = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()
    assert _count_versiones(db_session, created["id"]) == 0

    patched = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={
            "nombre": "Galleta editada",
            "descripcion": "Nueva descripción general",
            "contenido_neto": "300.000",
        },
    )
    assert patched.status_code == 200
    db_session.expire_all()
    assert _count_versiones(db_session, created["id"]) == 0


def test_endpoints_sin_autenticacion_son_rechazados(client) -> None:
    create_response = client.post("/gestion/productos", json=PRODUCTO_BASE)
    list_response = client.get("/gestion/productos")
    get_response = client.get("/gestion/productos/1")
    patch_response = client.patch("/gestion/productos/1", json={"nombre": "X"})
    categorias_response = client.get("/gestion/categorias")

    assert create_response.status_code == 401
    assert list_response.status_code == 401
    assert get_response.status_code == 401
    assert patch_response.status_code == 401
    assert categorias_response.status_code == 401


def _create_categorias(db_session, nombres: list[str]) -> list[Categoria]:
    categorias = [Categoria(nombre=nombre) for nombre in nombres]
    db_session.add_all(categorias)
    db_session.commit()
    for categoria in categorias:
        db_session.refresh(categoria)
    return categorias


def test_producto_con_costo_precio_imagen_y_categorias(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    categorias = _create_categorias(
        db_session,
        ["Pastelería", "Dulce", "Bebidas"],
    )

    response = client.post(
        "/gestion/productos",
        headers=headers,
        json={
            **PRODUCTO_BASE,
            "costo_produccion": "12.50",
            "precio_venta": "25.00",
            "imagen_url": "https://cdn.ejemplo.com/galleta.jpg",
            "categoria_ids": [categorias[0].id, categorias[1].id],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert Decimal(body["costo_produccion"]) == Decimal("12.50")
    assert Decimal(body["precio_venta"]) == Decimal("25.00")
    assert body["imagen_url"] == "https://cdn.ejemplo.com/galleta.jpg"
    assert [item["nombre"] for item in body["categorias"]] == ["Pastelería", "Dulce"]


def test_producto_sin_categorias_devuelve_lista_vacia(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    response = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    )

    assert response.status_code == 201
    assert response.json()["categorias"] == []
    assert response.json()["costo_produccion"] is None
    assert response.json()["precio_venta"] is None
    assert response.json()["imagen_url"] is None


@pytest.mark.parametrize("field_name", ["costo_produccion", "precio_venta"])
def test_valores_negativos_son_rechazados(client, field_name: str) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    response = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, field_name: "-0.01"},
    )

    assert response.status_code == 422


def test_patch_permite_null_en_costo_precio_e_imagen(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json={
            **PRODUCTO_BASE,
            "costo_produccion": "10.00",
            "precio_venta": "20.00",
            "imagen_url": "https://cdn.ejemplo.com/galleta.jpg",
        },
    ).json()

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={
            "costo_produccion": None,
            "precio_venta": None,
            "imagen_url": None,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["costo_produccion"] is None
    assert body["precio_venta"] is None
    assert body["imagen_url"] is None


def test_patch_actualiza_categorias(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    categorias = _create_categorias(
        db_session,
        ["Panadería", "Salado", "Otros"],
    )
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "categoria_ids": [categorias[0].id]},
    ).json()

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={"categoria_ids": [categorias[1].id, categorias[2].id]},
    )

    assert response.status_code == 200
    assert [item["nombre"] for item in response.json()["categorias"]] == [
        "Salado",
        "Otros",
    ]


def test_patch_quitar_todas_las_categorias(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    categorias = _create_categorias(db_session, ["Pastelería", "Dulce"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "categoria_ids": [categorias[0].id, categorias[1].id]},
    ).json()

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={"categoria_ids": []},
    )

    assert response.status_code == 200
    assert response.json()["categorias"] == []


def test_categoria_ids_invalidos_devuelven_422(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])

    response = client.post(
        "/gestion/productos",
        headers=headers,
        json={**PRODUCTO_BASE, "categoria_ids": [9999]},
    )

    assert response.status_code == 422


def test_cambios_comerciales_no_generan_version_producto(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    categorias = _create_categorias(db_session, ["Pastelería", "Dulce"])

    created = client.post(
        "/gestion/productos",
        headers=headers,
        json={
            **PRODUCTO_BASE,
            "costo_produccion": "5.00",
            "precio_venta": "12.00",
            "imagen_url": "https://cdn.ejemplo.com/galleta.jpg",
            "categoria_ids": [categorias[0].id],
        },
    ).json()
    assert _count_versiones(db_session, created["id"]) == 0

    patched = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={
            "costo_produccion": "6.50",
            "precio_venta": "15.00",
            "imagen_url": "https://cdn.ejemplo.com/galleta-nueva.jpg",
            "categoria_ids": [categorias[1].id],
        },
    )
    assert patched.status_code == 200
    db_session.expire_all()
    assert _count_versiones(db_session, created["id"]) == 0


def test_patch_rechaza_activo_desde_cliente(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    created = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    ).json()

    response = client.patch(
        f"/gestion/productos/{created['id']}",
        headers=headers,
        json={"activo": False},
    )

    assert response.status_code == 422
