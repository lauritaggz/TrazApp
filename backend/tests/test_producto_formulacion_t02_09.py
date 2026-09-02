"""Product version formulation management tests (T02-09)."""

from app.models import LoteProducto, VersionProducto
from tests.test_gestion_ingredientes import (
    INGREDIENTE_BASE,
    PRODUCTOR_A,
    PRODUCTOR_B,
    _auth_headers,
    _register_and_login,
)
from tests.test_gestion_productos import PRODUCTO_BASE


def _create_producto(client, headers) -> dict:
    response = client.post("/gestion/productos", headers=headers, json=PRODUCTO_BASE)
    assert response.status_code == 201
    return response.json()


def _create_ingrediente(client, headers, codigo: str, nombre: str) -> dict:
    response = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={**INGREDIENTE_BASE, "codigo_interno": codigo, "nombre": nombre, "tipo": "simple"},
    )
    assert response.status_code == 201
    return response.json()


def _create_version_producto(db_session, producto_id: int, descripcion: str = "VP test") -> VersionProducto:
    version = VersionProducto(
        producto_id=producto_id,
        numero_version=1,
        descripcion=descripcion,
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)
    return version


def _formulacion_url(producto_id: int, version_id: int, linea_id: int | None = None) -> str:
    base = f"/gestion/productos/{producto_id}/versiones/{version_id}/formulacion"
    if linea_id is None:
        return base
    return f"{base}/{linea_id}"


def _add_linea(
    client,
    headers,
    producto_id: int,
    version_id: int,
    ingrediente_id: int,
    *,
    porcentaje: str | None = "50",
    cantidad: str | None = None,
    unidad: str | None = None,
    orden: int | None = 1,
):
    payload: dict = {"ingrediente_id": ingrediente_id}
    if porcentaje is not None:
        payload["porcentaje"] = porcentaje
    if cantidad is not None:
        payload["cantidad"] = cantidad
    if unidad is not None:
        payload["unidad"] = unidad
    if orden is not None:
        payload["orden"] = orden
    return client.post(
        _formulacion_url(producto_id, version_id),
        headers=headers,
        json=payload,
    )


def test_crear_formulacion_valida(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-f09", "Harina")
    version = _create_version_producto(db_session, producto["id"])

    response = _add_linea(
        client,
        headers,
        producto["id"],
        version.id,
        harina["id"],
        porcentaje="62.5",
        orden=1,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["ingrediente_id"] == harina["id"]
    assert body["ingrediente_nombre"] == "Harina"
    assert body["ingrediente_codigo_interno"] == "HAR-F09"
    assert body["ingrediente_tipo"] == "simple"
    assert body["porcentaje"] == "62.500"
    assert body["orden"] == 1


def test_listar_formulacion(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-f09b", "Harina lista")
    agua = _create_ingrediente(client, headers, "agua-f09b", "Agua lista")
    version = _create_version_producto(db_session, producto["id"])

    assert _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="60", orden=1
    ).status_code == 201
    assert _add_linea(
        client, headers, producto["id"], version.id, agua["id"], porcentaje="40", orden=2
    ).status_code == 201

    response = client.get(
        _formulacion_url(producto["id"], version.id),
        headers=headers,
    )

    assert response.status_code == 200
    items = response.json()
    assert len(items) == 2
    assert items[0]["ingrediente_nombre"] == "Harina lista"
    assert items[1]["ingrediente_nombre"] == "Agua lista"


def test_actualizar_formulacion(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-f09c", "Harina update")
    version = _create_version_producto(db_session, producto["id"])
    created = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="50", orden=1
    ).json()

    response = client.patch(
        _formulacion_url(producto["id"], version.id, created["id"]),
        headers=headers,
        json={"porcentaje": "75", "orden": 3, "notas": "Tamizada"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["porcentaje"] == "75.000"
    assert body["orden"] == 3
    assert body["notas"] == "Tamizada"


def test_actualizar_cantidad_y_unidad(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    agua = _create_ingrediente(client, headers, "agua-f09d", "Agua qty")
    version = _create_version_producto(db_session, producto["id"])
    created = _add_linea(
        client,
        headers,
        producto["id"],
        version.id,
        agua["id"],
        porcentaje=None,
        cantidad="100",
        unidad="ml",
        orden=1,
    ).json()

    response = client.patch(
        _formulacion_url(producto["id"], version.id, created["id"]),
        headers=headers,
        json={"cantidad": "250", "unidad": "ml"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["porcentaje"] is None
    assert body["cantidad"] == "250.000"
    assert body["unidad"] == "ml"


def test_eliminar_linea_formulacion(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-f09e", "Harina delete")
    version = _create_version_producto(db_session, producto["id"])
    created = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="100", orden=1
    ).json()

    delete_response = client.delete(
        _formulacion_url(producto["id"], version.id, created["id"]),
        headers=headers,
    )
    assert delete_response.status_code == 204

    list_response = client.get(
        _formulacion_url(producto["id"], version.id),
        headers=headers,
    )
    assert list_response.status_code == 200
    assert list_response.json() == []


def test_ingrediente_inexistente(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    version = _create_version_producto(db_session, producto["id"])

    response = _add_linea(
        client, headers, producto["id"], version.id, 999_999, porcentaje="100", orden=1
    )

    assert response.status_code == 404


def test_ingrediente_de_otro_productor(client, db_session) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_a = _auth_headers(login_a["access_token"])
    headers_b = _auth_headers(login_b["access_token"])

    producto_a = _create_producto(client, headers_a)
    harina_b = _create_ingrediente(client, headers_b, "har-ajeno", "Harina ajena")
    version_a = _create_version_producto(db_session, producto_a["id"])

    response = _add_linea(
        client,
        headers_a,
        producto_a["id"],
        version_a.id,
        harina_b["id"],
        porcentaje="100",
        orden=1,
    )

    assert response.status_code == 404


def test_producto_ajeno(client, db_session) -> None:
    login_a = _register_and_login(client, PRODUCTOR_A)
    login_b = _register_and_login(client, PRODUCTOR_B)
    headers_b = _auth_headers(login_b["access_token"])

    producto_a = _create_producto(client, _auth_headers(login_a["access_token"]))
    version_a = _create_version_producto(db_session, producto_a["id"])

    response = client.get(
        _formulacion_url(producto_a["id"], version_a.id),
        headers=headers_b,
    )

    assert response.status_code == 404


def test_version_ajena(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    version = _create_version_producto(db_session, producto["id"])

    response = client.get(
        _formulacion_url(producto["id"], 999_999),
        headers=headers,
    )

    assert response.status_code == 404


def test_ingrediente_inactivo(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-inact", "Harina inactiva")
    version = _create_version_producto(db_session, producto["id"])

    deactivate = client.delete(f"/gestion/ingredientes/{harina['id']}", headers=headers)
    assert deactivate.status_code == 204

    response = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="100", orden=1
    )

    assert response.status_code == 422


def test_ingrediente_duplicado(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-dup", "Harina dup")
    version = _create_version_producto(db_session, producto["id"])

    first = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="50", orden=1
    )
    assert first.status_code == 201

    duplicate = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="10", orden=2
    )
    assert duplicate.status_code == 422


def test_snapshot_conserva_datos_originales(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-snap", "Harina snapshot")
    version = _create_version_producto(db_session, producto["id"])
    created = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="100", orden=1
    ).json()

    patch_ingrediente = client.patch(
        f"/gestion/ingredientes/{harina['id']}",
        headers=headers,
        json={"nombre": "Harina renombrada", "codigo_interno": "HAR-NEW"},
    )
    assert patch_ingrediente.status_code == 200

    list_response = client.get(
        _formulacion_url(producto["id"], version.id),
        headers=headers,
    )
    assert list_response.status_code == 200
    linea = list_response.json()[0]
    assert linea["id"] == created["id"]
    assert linea["ingrediente_nombre"] == "Harina snapshot"
    assert linea["ingrediente_codigo_interno"] == "HAR-SNAP"


def test_bloqueo_modificacion_cuando_existe_lote(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-lote", "Harina lote")
    agua = _create_ingrediente(client, headers, "agua-lote", "Agua lote")
    version = _create_version_producto(db_session, producto["id"])
    created = _add_linea(
        client, headers, producto["id"], version.id, harina["id"], porcentaje="100", orden=1
    ).json()

    db_session.add(
        LoteProducto(
            codigo_lote="LP-F09-001",
            version_producto_id=version.id,
        )
    )
    db_session.commit()

    post_blocked = _add_linea(
        client, headers, producto["id"], version.id, agua["id"], porcentaje="10", orden=2
    )
    patch_blocked = client.patch(
        _formulacion_url(producto["id"], version.id, created["id"]),
        headers=headers,
        json={"porcentaje": "80"},
    )
    delete_blocked = client.delete(
        _formulacion_url(producto["id"], version.id, created["id"]),
        headers=headers,
    )

    assert post_blocked.status_code == 409
    assert patch_blocked.status_code == 409
    assert delete_blocked.status_code == 409

    list_response = client.get(
        _formulacion_url(producto["id"], version.id),
        headers=headers,
    )
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1


def test_version_sin_formulacion_lista_vacia(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    version = _create_version_producto(db_session, producto["id"])

    response = client.get(
        _formulacion_url(producto["id"], version.id),
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json() == []


def test_rt01_sigue_funcionando_sin_formulacion_gestion(client) -> None:
    producto = client.post("/productos", json={"nombre": "Chocolate RT-01"}).json()
    ingrediente = client.post("/ingredientes", json={"nombre": "Cacao"}).json()

    version_producto = client.post(
        f"/productos/{producto['id']}/versiones",
        json={"descripcion": "Formulación original"},
    )
    version_ingrediente = client.post(
        f"/ingredientes/{ingrediente['id']}/versiones",
        json={
            "composicion_declarada": "100% cacao",
            "alergenos_declarados": "",
        },
    )
    assert version_producto.status_code == 201
    assert version_ingrediente.status_code == 201

    vp = version_producto.json()
    vi = version_ingrediente.json()

    lote_ingrediente = client.post(
        "/lotes-ingredientes",
        json={"codigo_lote": "RT-F09-ING", "version_ingrediente_id": vi["id"]},
    )
    lote_producto = client.post(
        "/lotes-productos",
        json={
            "codigo_lote": "RT-F09-PROD",
            "version_producto_id": vp["id"],
            "lotes_ingredientes": ["RT-F09-ING"],
        },
    )
    assert lote_ingrediente.status_code == 201
    assert lote_producto.status_code == 201

    trazabilidad = client.get("/lotes-productos/RT-F09-PROD/trazabilidad")
    assert trazabilidad.status_code == 200
    body = trazabilidad.json()
    assert body["producto"]["descripcion"] == "Formulación original"
    assert body["producto"]["version"] == 1
