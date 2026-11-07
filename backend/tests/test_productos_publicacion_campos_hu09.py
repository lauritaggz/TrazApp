"""Public-presentation fields are not accepted by the product API (T09-01 / HU09, CA10, PT09-11).

The management schemas forbid unknown fields (422); the legacy RT-01 schema drops them silently.
Neither can leave a product published. Responses are not asserted here: T09-02 changes them.
"""

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Producto
from tests.escenario_hu05 import registrar
from tests.test_gestion_productos import PRODUCTO_BASE

PRODUCTOR = {
    "nombre": "Productor HU09",
    "nombre_negocio": "Panaderia HU09",
    "email": "productor.campos.hu09@ejemplo.com",
    "password": "SecretoProductor123!",
}
CAMPOS = [
    {"publicado": True},
    {"id_publico": "inventado"},
    {"publicado_en": "2026-11-06T00:00:00Z"},
    {"publicado": True, "id_publico": "inventado", "publicado_en": "2026-11-06T00:00:00Z"},
]


@pytest.fixture
def headers(client) -> dict:
    return registrar(client, PRODUCTOR)


def _estado(db_session: Session) -> list[tuple]:
    db_session.expire_all()
    return [
        (p.nombre, p.publicado, p.id_publico, p.publicado_en)
        for p in db_session.scalars(select(Producto).order_by(Producto.id))
    ]


@pytest.mark.parametrize("extra", CAMPOS)
def test_post_producto_rechaza_los_campos_de_publicacion(client, headers, db_session, extra) -> None:
    respuesta = client.post("/gestion/productos", headers=headers, json={**PRODUCTO_BASE, **extra})
    assert respuesta.status_code == 422
    assert _estado(db_session) == []


@pytest.mark.parametrize("extra", CAMPOS)
def test_patch_producto_rechaza_los_campos_de_publicacion(client, headers, db_session, extra) -> None:
    creado = client.post("/gestion/productos", headers=headers, json=PRODUCTO_BASE)
    assert creado.status_code == 201
    antes = _estado(db_session)

    respuesta = client.patch(f"/gestion/productos/{creado.json()['id']}", headers=headers, json=extra)

    assert respuesta.status_code == 422
    assert _estado(db_session) == antes
    assert antes[0][1:] == (False, None, None)


@pytest.mark.parametrize("extra", CAMPOS)
def test_producto_legacy_rt01_descarta_los_campos_de_publicacion(client, db_session, extra) -> None:
    respuesta = client.post("/productos", json={"nombre": "Legacy", **extra})
    assert respuesta.status_code == 201
    assert _estado(db_session) == [("Legacy", False, None, None)]
