"""`tiene_formulacion` in the product read payload (HT06-07).

The Dashboard offers "Nueva elaboración" only for products that can have one, which needs to know it
for every product of the list without asking one by one. A product "has a formulation" when its
CURRENT version has at least one ingredient line (the same condition under which an elaboración can
be created).
"""

import pytest
from sqlalchemy import update

from app.models import VersionProducto
from tests.escenario_hu05 import PRODUCTOR_B, crear_ingrediente, crear_producto, formular, registrar
from tests.test_producto_imagen import PNG_1X1


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    return {
        "headers": headers,
        "harina": crear_ingrediente(client, headers, "Harina", "har-001"),
        "leche": crear_ingrediente(client, headers, "Leche", "lec-001"),
    }


def _listado(client, headers) -> dict[int, bool]:
    respuesta = client.get("/gestion/productos", headers=headers)
    assert respuesta.status_code == 200
    return {producto["id"]: producto["tiene_formulacion"] for producto in respuesta.json()}


def test_un_producto_nuevo_no_tiene_formulacion(client, ctx) -> None:
    producto = crear_producto(client, ctx["headers"])

    assert producto["tiene_formulacion"] is False
    assert client.get(f"/gestion/productos/{producto['id']}", headers=ctx["headers"]).json()["tiene_formulacion"] is False
    assert _listado(client, ctx["headers"]) == {producto["id"]: False}


def test_con_formulacion_el_detalle_y_el_listado_lo_indican(client, ctx) -> None:
    producto = crear_producto(client, ctx["headers"])
    formular(client, ctx["headers"], producto["id"], ctx["harina"], ctx["leche"])

    detalle = client.get(f"/gestion/productos/{producto['id']}", headers=ctx["headers"]).json()

    assert detalle["tiene_formulacion"] is True
    assert _listado(client, ctx["headers"]) == {producto["id"]: True}


def test_el_listado_distingue_los_productos_con_y_sin_formulacion(client, ctx) -> None:
    con = crear_producto(client, ctx["headers"], "Queque", "que-001")
    sin = crear_producto(client, ctx["headers"], "Galletas", "gal-001")
    otro_con = crear_producto(client, ctx["headers"], "Pan", "pan-001")
    formular(client, ctx["headers"], con["id"], ctx["harina"])
    formular(client, ctx["headers"], otro_con["id"], ctx["leche"])

    assert _listado(client, ctx["headers"]) == {con["id"]: True, sin["id"]: False, otro_con["id"]: True}


def test_las_demas_respuestas_del_producto_tambien_lo_indican(client, ctx) -> None:
    producto = crear_producto(client, ctx["headers"])
    formular(client, ctx["headers"], producto["id"], ctx["harina"])

    editado = client.patch(
        f"/gestion/productos/{producto['id']}", headers=ctx["headers"], json={"nombre": "Queque de vainilla 2"}
    )
    con_imagen = client.post(
        f"/gestion/productos/{producto['id']}/imagen",
        headers=ctx["headers"],
        files={"file": ("queque.png", PNG_1X1, "image/png")},
    )

    assert editado.status_code == 200 and editado.json()["tiene_formulacion"] is True
    assert con_imagen.status_code == 200 and con_imagen.json()["tiene_formulacion"] is True


def test_cambiar_la_formulacion_mantiene_el_indicador(client, ctx) -> None:
    producto = crear_producto(client, ctx["headers"])
    formular(client, ctx["headers"], producto["id"], ctx["harina"])

    formular(client, ctx["headers"], producto["id"], ctx["harina"], ctx["leche"])

    assert _listado(client, ctx["headers"]) == {producto["id"]: True}


def test_las_lineas_de_una_version_que_ya_no_es_vigente_no_cuentan(client, ctx, db_session) -> None:
    producto = crear_producto(client, ctx["headers"])
    formular(client, ctx["headers"], producto["id"], ctx["harina"])
    db_session.execute(update(VersionProducto).where(VersionProducto.producto_id == producto["id"]).values(vigente=False))
    db_session.commit()

    assert _listado(client, ctx["headers"]) == {producto["id"]: False}
    assert client.get(f"/gestion/productos/{producto['id']}", headers=ctx["headers"]).json()["tiene_formulacion"] is False


def test_la_formulacion_de_otro_productor_no_cuenta(client, ctx) -> None:
    mio = crear_producto(client, ctx["headers"])
    headers_b = registrar(client, PRODUCTOR_B)
    ingrediente_b = crear_ingrediente(client, headers_b, "Harina", "har-001")
    suyo = crear_producto(client, headers_b, "Queque B", "que-b01")
    formular(client, headers_b, suyo["id"], ingrediente_b)

    assert _listado(client, ctx["headers"]) == {mio["id"]: False}
    assert _listado(client, headers_b) == {suyo["id"]: True}


def test_sin_productos_el_listado_es_vacio(client, ctx) -> None:
    assert _listado(client, ctx["headers"]) == {}
