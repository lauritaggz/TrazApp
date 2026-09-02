"""Product image upload API tests (T01-13)."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models import VersionProducto
from tests.test_gestion_productos import (
    PRODUCTO_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _count_versiones,
    _register_and_login,
)

# Minimal valid 1x1 PNG
PNG_1X1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01"
    b"\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


@pytest.fixture
def uploads_products_dir(tmp_path, monkeypatch):
    products_dir = tmp_path / "products"
    products_dir.mkdir(parents=True)
    monkeypatch.setenv("UPLOADS_ROOT", str(tmp_path))
    from app.core.config import get_settings

    get_settings.cache_clear()
    yield products_dir
    get_settings.cache_clear()


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


def test_subir_imagen_valida_actualiza_imagen_url(client, uploads_products_dir) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]

    response = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=created["headers"],
        files={"file": ("galleta.png", PNG_1X1, "image/png")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["imagen_url"] is not None
    assert body["imagen_url"].startswith("/uploads/products/p")
    assert body["imagen_url"].endswith(".png")

    stored_files = list(uploads_products_dir.glob("*.png"))
    assert len(stored_files) == 1
    assert stored_files[0].read_bytes() == PNG_1X1


def test_reemplazar_imagen_elimina_archivo_anterior(client, uploads_products_dir) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]
    headers = created["headers"]

    first = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=headers,
        files={"file": ("primera.png", PNG_1X1, "image/png")},
    ).json()
    first_path = uploads_products_dir / first["imagen_url"].split("/")[-1]
    assert first_path.exists()

    second = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=headers,
        files={"file": ("segunda.png", PNG_1X1, "image/png")},
    )
    assert second.status_code == 200
    second_url = second.json()["imagen_url"]
    assert second_url != first["imagen_url"]
    assert not first_path.exists()
    assert len(list(uploads_products_dir.glob("*.png"))) == 1


def test_formato_invalido_devuelve_422(client, uploads_products_dir) -> None:
    created = _create_product(client)
    response = client.post(
        f"/gestion/productos/{created['producto']['id']}/imagen",
        headers=created["headers"],
        files={"file": ("nota.txt", b"hola", "text/plain")},
    )

    assert response.status_code == 422
    assert "Formato no permitido" in response.json()["detail"]


def test_imagen_mayor_a_5mb_devuelve_422(client, uploads_products_dir) -> None:
    created = _create_product(client)
    oversized = b"x" * (5 * 1024 * 1024 + 1)
    response = client.post(
        f"/gestion/productos/{created['producto']['id']}/imagen",
        headers=created["headers"],
        files={"file": ("grande.png", oversized, "image/png")},
    )

    assert response.status_code == 422
    assert "5 MB" in response.json()["detail"]


def test_producto_inexistente_devuelve_404(client, uploads_products_dir) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    response = client.post(
        "/gestion/productos/9999/imagen",
        headers=_auth_headers(login["access_token"]),
        files={"file": ("galleta.png", PNG_1X1, "image/png")},
    )

    assert response.status_code == 404


def test_producto_de_otro_productor_devuelve_404(client, uploads_products_dir) -> None:
    created = _create_product(client)
    login_b = _register_and_login(client, PRODUCTOR_B)

    response = client.post(
        f"/gestion/productos/{created['producto']['id']}/imagen",
        headers=_auth_headers(login_b["access_token"]),
        files={"file": ("galleta.png", PNG_1X1, "image/png")},
    )

    assert response.status_code == 404
    assert list(uploads_products_dir.glob("*")) == []


def test_subir_imagen_no_genera_version_producto(
    client,
    db_session,
    uploads_products_dir,
) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]

    response = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=created["headers"],
        files={"file": ("galleta.png", PNG_1X1, "image/png")},
    )
    assert response.status_code == 200
    db_session.expire_all()
    assert _count_versiones(db_session, producto_id) == 0

    replace = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=created["headers"],
        files={"file": ("galleta-2.png", PNG_1X1, "image/png")},
    )
    assert replace.status_code == 200
    db_session.expire_all()
    assert _count_versiones(db_session, producto_id) == 0

    count = db_session.scalar(
        select(func.count()).select_from(VersionProducto)
    )
    assert count == 0


def test_patch_quitar_imagen_elimina_archivo_subido(
    client,
    uploads_products_dir,
) -> None:
    created = _create_product(client)
    producto_id = created["producto"]["id"]
    headers = created["headers"]

    upload = client.post(
        f"/gestion/productos/{producto_id}/imagen",
        headers=headers,
        files={"file": ("galleta.png", PNG_1X1, "image/png")},
    )
    assert upload.status_code == 200
    imagen_url = upload.json()["imagen_url"]
    stored_file = uploads_products_dir / imagen_url.split("/")[-1]
    assert stored_file.exists()

    response = client.patch(
        f"/gestion/productos/{producto_id}",
        headers=headers,
        json={"imagen_url": None},
    )

    assert response.status_code == 200
    assert response.json()["imagen_url"] is None
    assert not stored_file.exists()
