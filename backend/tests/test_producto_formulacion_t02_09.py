"""Product version formulation read tests (T02-09, adapted in HU03 / T03-03).

Formulation is written only through PUT /gestion/productos/{id}/formulacion
(see test_gestion_formulacion_hu03.py); per-version endpoints are read-only.
"""

import pytest

from app.models import VersionProducto
from app.repositories.ingrediente_repository import IngredienteRepository
from app.repositories.producto_formulacion_repository import ProductoFormulacionRepository
from app.repositories.producto_repository import ProductoRepository
from app.services.producto_formulacion_service import ProductoFormulacionService
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


def _guardar(client, headers, producto_id: int, lineas: list[dict]) -> dict:
    response = client.put(
        f"/gestion/productos/{producto_id}/formulacion",
        headers=headers,
        json={"lineas": lineas},
    )
    assert response.status_code == 200, response.text
    return response.json()["version"]


def _marcar_usada(db_session, version_id: int) -> None:
    ProductoFormulacionService(
        ProductoFormulacionRepository(db_session),
        ProductoRepository(db_session),
        IngredienteRepository(db_session),
    ).marcar_version_usada(version_id)
    db_session.commit()


def test_listar_formulacion(client) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-f09b", "Harina lista")
    agua = _create_ingrediente(client, headers, "agua-f09b", "Agua lista")
    version = _guardar(
        client,
        headers,
        producto["id"],
        [{"ingrediente_id": harina["id"], "cantidad": "500", "unidad": "g"}, {"ingrediente_id": agua["id"]}],
    )

    response = client.get(_formulacion_url(producto["id"], version["id"]), headers=headers)

    assert response.status_code == 200
    items = response.json()
    assert [(i["ingrediente_nombre"], i["cantidad"], i["unidad"], i["orden"]) for i in items] == [
        ("Harina lista", "500.000", "g", 1),
        ("Agua lista", None, None, 2),
    ]


def test_version_anterior_se_consulta_intacta(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-hist", "Harina historial")
    v1 = _guardar(
        client, headers, producto["id"], [{"ingrediente_id": harina["id"], "cantidad": "1", "unidad": "kg"}]
    )
    _marcar_usada(db_session, v1["id"])
    v2 = _guardar(
        client, headers, producto["id"], [{"ingrediente_id": harina["id"], "cantidad": "2", "unidad": "kg"}]
    )

    anterior = client.get(_formulacion_url(producto["id"], v1["id"]), headers=headers).json()
    vigente = client.get(_formulacion_url(producto["id"], v2["id"]), headers=headers).json()

    assert v2["id"] != v1["id"]
    assert [i["cantidad"] for i in anterior] == ["1.000"]
    assert [i["cantidad"] for i in vigente] == ["2.000"]


def test_snapshot_conserva_datos_originales(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-snap", "Harina snapshot")
    version = _guardar(client, headers, producto["id"], [{"ingrediente_id": harina["id"]}])
    _marcar_usada(db_session, version["id"])

    patch_ingrediente = client.patch(
        f"/gestion/ingredientes/{harina['id']}",
        headers=headers,
        json={"nombre": "Harina renombrada", "codigo_interno": "HAR-NEW"},
    )
    assert patch_ingrediente.status_code == 200

    list_response = client.get(_formulacion_url(producto["id"], version["id"]), headers=headers)
    assert list_response.status_code == 200
    linea = list_response.json()[0]
    assert linea["ingrediente_nombre"] == "Harina snapshot"
    assert linea["ingrediente_codigo_interno"] == "HAR-SNAP"


def test_listar_requiere_autenticacion(client, db_session) -> None:
    login = _register_and_login(client, PRODUCTOR_A)
    producto = _create_producto(client, _auth_headers(login["access_token"]))
    version = _create_version_producto(db_session, producto["id"])

    response = client.get(_formulacion_url(producto["id"], version.id))

    assert response.status_code == 401


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
    _create_version_producto(db_session, producto["id"])

    response = client.get(
        _formulacion_url(producto["id"], 999_999),
        headers=headers,
    )

    assert response.status_code == 404


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


@pytest.mark.parametrize(
    ("method", "con_linea", "esperado"),
    [("post", False, 405), ("patch", True, 404), ("delete", True, 404)],
)
def test_endpoints_de_escritura_por_version_eliminados(
    client, db_session, method: str, con_linea: bool, esperado: int
) -> None:
    """HU03: previous versions can never be modified through a version_id."""
    login = _register_and_login(client, PRODUCTOR_A)
    headers = _auth_headers(login["access_token"])
    producto = _create_producto(client, headers)
    harina = _create_ingrediente(client, headers, "har-405", "Harina 405")
    version = _guardar(client, headers, producto["id"], [{"ingrediente_id": harina["id"]}])
    linea_id = version["lineas"][0]["id"] if con_linea else None
    kwargs = {"json": {"ingrediente_id": harina["id"]}} if method != "delete" else {}

    response = getattr(client, method)(
        _formulacion_url(producto["id"], version["id"], linea_id),
        headers=headers,
        **kwargs,
    )

    assert response.status_code == esperado
    lineas = client.get(_formulacion_url(producto["id"], version["id"]), headers=headers).json()
    assert [linea["ingrediente_id"] for linea in lineas] == [harina["id"]]


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
