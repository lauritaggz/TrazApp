"""Authenticated category listing API tests (T01-11)."""

from app.models import Categoria

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.categorias@ejemplo.com",
    "password": "SecretoProductor123!",
}

CATEGORIAS_CATALOGO = (
    "Pastelería",
    "Panadería",
    "Dulce",
    "Salado",
    "Bebidas",
    "Otros",
)


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


def _seed_categorias(db_session) -> list[Categoria]:
    categorias = [Categoria(nombre=nombre) for nombre in CATEGORIAS_CATALOGO]
    db_session.add_all(categorias)
    db_session.commit()
    for categoria in categorias:
        db_session.refresh(categoria)
    return categorias


def test_listar_categorias_requiere_autenticacion(client) -> None:
    response = client.get("/gestion/categorias")
    assert response.status_code == 401


def test_listar_categorias_devuelve_catalogo_ordenado(client, db_session) -> None:
    _seed_categorias(db_session)
    login = _register_and_login(client, PRODUCTOR_A)

    response = client.get(
        "/gestion/categorias",
        headers=_auth_headers(login["access_token"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["nombre"] for item in body] == sorted(CATEGORIAS_CATALOGO)
    assert all("id" in item for item in body)
