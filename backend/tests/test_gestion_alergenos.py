"""Authenticated allergen catalog API tests (THT03-04)."""

from app.models import Alergeno

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.alergenos@ejemplo.com",
    "password": "SecretoProductor123!",
}

# Catalog as left by migration 011, inserted in id order.
CATALOGO_011 = (
    ("gluten", "Gluten", True),
    ("crustaceos", "Crustáceos", True),
    ("huevos", "Huevo", True),
    ("pescado", "Pescado", True),
    ("cacahuetes", "Maní", True),
    ("soja", "Soya", True),
    ("lacteos", "Leche", True),
    ("frutos_cascara", "Nueces", True),
    ("apio", "Apio", False),
    ("mostaza", "Mostaza", False),
    ("sesamo", "Sésamo", False),
    ("sulfitos", "Sulfitos", True),
    ("altramuces", "Altramuces", False),
    ("moluscos", "Moluscos", False),
)

ORDEN_ESPERADO = [
    "Crustáceos",
    "Gluten",
    "Huevo",
    "Leche",
    "Maní",
    "Nueces",
    "Pescado",
    "Soya",
    "Sulfitos",
    "Altramuces",
    "Apio",
    "Moluscos",
    "Mostaza",
    "Sésamo",
]


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


def _seed_catalogo(db_session) -> None:
    db_session.add_all(
        Alergeno(codigo=codigo, nombre=nombre, obligatorio_chile=obligatorio)
        for codigo, nombre, obligatorio in CATALOGO_011
    )
    db_session.commit()


def test_listar_alergenos_requiere_autenticacion(client, db_session) -> None:
    _seed_catalogo(db_session)

    response = client.get("/gestion/alergenos")

    assert response.status_code == 401


def test_listar_alergenos_rechaza_token_invalido(client, db_session) -> None:
    _seed_catalogo(db_session)

    response = client.get("/gestion/alergenos", headers=_auth_headers("no-es-un-jwt"))

    assert response.status_code == 401


def test_listar_alergenos_autenticado_devuelve_campos_del_catalogo(
    client, db_session
) -> None:
    _seed_catalogo(db_session)
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.get(
        "/gestion/alergenos",
        headers=_auth_headers(login["access_token"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body) == len(CATALOGO_011)
    assert all(
        set(item) == {"id", "codigo", "nombre", "obligatorio_chile"} for item in body
    )
    por_codigo = {item["codigo"]: item for item in body}
    assert por_codigo["lacteos"]["nombre"] == "Leche"
    assert por_codigo["lacteos"]["obligatorio_chile"] is True
    assert por_codigo["apio"]["obligatorio_chile"] is False
    assert sum(item["obligatorio_chile"] for item in body) == 9


def test_listar_alergenos_ordena_obligatorios_primero_y_luego_por_nombre(
    client, db_session
) -> None:
    _seed_catalogo(db_session)
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.get(
        "/gestion/alergenos",
        headers=_auth_headers(login["access_token"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["nombre"] for item in body] == ORDEN_ESPERADO
    obligatorios = [item["obligatorio_chile"] for item in body]
    assert obligatorios == sorted(obligatorios, reverse=True)
