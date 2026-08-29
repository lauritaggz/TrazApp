"""Logical product deletion API tests (T01-14)."""

from sqlalchemy import func, select

from app.models import Producto, VersionProducto
from tests.test_gestion_productos import (
    PRODUCTO_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _count_versiones,
    _register_and_login,
)


def _create_product(client) -> dict:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    response = client.post(
        "/gestion/productos",
        headers=headers,
        json=PRODUCTO_BASE,
    )
    assert response.status_code == 201
    return {"login": login, "headers": headers, "producto": response.json()}


def test_eliminar_producto_propio_marca_inactivo(client, db_session) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]

    response = client.delete(
        f"/gestion/productos/{producto_id}",
        headers=created["headers"],
    )

    assert response.status_code == 204
    db_session.expire_all()
    producto = db_session.get(Producto, producto_id)
    assert producto is not None
    assert producto.activo is False


def test_eliminar_desaparece_del_listado_y_get_devuelve_404(client) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]
    headers = created["headers"]

    list_before = client.get("/gestion/productos", headers=headers)
    assert list_before.status_code == 200
    assert len(list_before.json()) == 1

    delete_response = client.delete(
        f"/gestion/productos/{producto_id}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_after = client.get("/gestion/productos", headers=headers)
    assert list_after.status_code == 200
    assert list_after.json() == []

    detail = client.get(f"/gestion/productos/{producto_id}", headers=headers)
    assert detail.status_code == 404


def test_eliminar_producto_inexistente_devuelve_404(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    response = client.delete(
        "/gestion/productos/9999",
        headers=_auth_headers(login["access_token"]),
    )
    assert response.status_code == 404


def test_eliminar_producto_de_otro_productor_devuelve_404(
    client,
    db_session,
) -> None:
    created = _create_product(client)
    login_b = _register_and_login(client, PRODUCTOR_B)

    response = client.delete(
        f"/gestion/productos/{created['producto']['id']}",
        headers=_auth_headers(login_b["access_token"]),
    )

    assert response.status_code == 404
    db_session.expire_all()
    producto = db_session.get(Producto, created["producto"]["id"])
    assert producto is not None
    assert producto.activo is True


def test_eliminar_mantiene_version_producto_existente(
    client,
    db_session,
) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]
    version = VersionProducto(
        producto_id=producto_id,
        numero_version=1,
        descripcion="Versión histórica",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)

    response = client.delete(
        f"/gestion/productos/{producto_id}",
        headers=created["headers"],
    )
    assert response.status_code == 204

    db_session.expire_all()
    assert db_session.get(VersionProducto, version.id) is not None
    assert _count_versiones(db_session, producto_id) == 1
    producto = db_session.get(Producto, producto_id)
    assert producto is not None
    assert producto.activo is False


def test_eliminar_no_genera_version_producto(client, db_session) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]
    assert _count_versiones(db_session, producto_id) == 0

    response = client.delete(
        f"/gestion/productos/{producto_id}",
        headers=created["headers"],
    )
    assert response.status_code == 204
    db_session.expire_all()
    assert _count_versiones(db_session, producto_id) == 0


def test_eliminar_no_afecta_otros_productos(client, db_session) -> None:
    created = _create_product(client)
    headers = created["headers"]

    second = client.post(
        "/gestion/productos",
        headers=headers,
        json={
            **PRODUCTO_BASE,
            "codigo_interno": "PAN-001",
            "nombre": "Pan integral",
        },
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    delete_response = client.delete(
        f"/gestion/productos/{created['producto']['id']}",
        headers=headers,
    )
    assert delete_response.status_code == 204

    listing = client.get("/gestion/productos", headers=headers)
    assert listing.status_code == 200
    body = listing.json()
    assert len(body) == 1
    assert body[0]["id"] == second_id
    assert body[0]["activo"] is True

    count = db_session.scalar(select(func.count()).select_from(Producto))
    assert count == 2
