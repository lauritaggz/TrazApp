"""HT08 / T-HT08-01: read-only queries of the ingredient detail.

GET /gestion/ingredientes/{id}/productos («Uso en formulaciones», CA1 without quantity) and
GET /gestion/ingredientes/{id}/insumos («Insumos asociados», CA2). Covers PT-HT08-01, 02, 03,
05 (backend), 07 and 08, plus archived (left out) and unpublished (kept) products, the order of
each list, the supply's own productor as a safeguard, and a constant number of queries.
"""

import pytest
from sqlalchemy import event, select, update

from app.models import FormulacionVersionProducto, InsumoComercial, Producto, Productor, VersionProducto
from tests.escenario_hu05 import (
    PRODUCTOR_B,
    crear_ingrediente,
    crear_insumo,
    crear_producto,
    formular,
    registrar,
)

NO_ENCONTRADO = {"detail": "Ingrediente no encontrado"}


def _productos(client, headers, ingrediente_id: int):
    return client.get(f"/gestion/ingredientes/{ingrediente_id}/productos", headers=headers)


def _insumos(client, headers, ingrediente_id: int):
    return client.get(f"/gestion/ingredientes/{ingrediente_id}/insumos", headers=headers)


def _marcar_usada(db_session, producto_id: int) -> None:
    """A version used by an elaboración is frozen, so the next formulation creates a new one (HU03)."""
    db_session.execute(
        update(VersionProducto)
        .where(VersionProducto.producto_id == producto_id, VersionProducto.vigente.is_(True))
        .values(usada_en_elaboracion=True)
    )
    db_session.commit()


def _productor_id(db_session, email: str) -> int:
    return db_session.scalar(select(Productor.id).where(Productor.email == email))


@pytest.fixture
def ctx(client) -> dict:
    headers = registrar(client)
    return {
        "headers": headers,
        "harina": crear_ingrediente(client, headers, "Harina", "har-001"),
        "leche": crear_ingrediente(client, headers, "Leche", "lec-001"),
        "sal": crear_ingrediente(client, headers, "Sal", "sal-001"),
    }


# --- Uso en formulaciones ---------------------------------------------------------------------------


def test_pt_ht08_01_dos_productos_con_su_version_vigente(client, ctx, db_session) -> None:
    pan = crear_producto(client, ctx["headers"], "Pan amasado", "pan-001")
    queque = crear_producto(client, ctx["headers"], "Queque", "que-001")
    formular(client, ctx["headers"], pan["id"], ctx["harina"])
    formular(client, ctx["headers"], queque["id"], ctx["harina"])
    _marcar_usada(db_session, queque["id"])
    formular(client, ctx["headers"], queque["id"], ctx["harina"], ctx["leche"])  # queque v2

    respuesta = _productos(client, ctx["headers"], ctx["harina"]["id"])

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == [
        {"id": pan["id"], "nombre": "Pan amasado", "numero_version": 1},
        {"id": queque["id"], "nombre": "Queque", "numero_version": 2},
    ]


def test_pt_ht08_02_solo_en_una_version_anterior_no_aparece(client, ctx, db_session) -> None:
    pan = crear_producto(client, ctx["headers"], "Pan amasado", "pan-001")
    formular(client, ctx["headers"], pan["id"], ctx["harina"], ctx["sal"])
    _marcar_usada(db_session, pan["id"])
    formular(client, ctx["headers"], pan["id"], ctx["harina"])  # v2 without sal

    assert _productos(client, ctx["headers"], ctx["sal"]["id"]).json() == []
    assert _productos(client, ctx["headers"], ctx["harina"]["id"]).json() == [
        {"id": pan["id"], "nombre": "Pan amasado", "numero_version": 2}
    ]


def test_producto_archivado_no_aparece_y_no_publicado_si(client, ctx, db_session) -> None:
    archivado = crear_producto(client, ctx["headers"], "Archivado", "arc-001")
    borrador = crear_producto(client, ctx["headers"], "Borrador", "bor-001")
    publicado = crear_producto(client, ctx["headers"], "Publicado", "pub-001")
    for producto in (archivado, borrador, publicado):
        formular(client, ctx["headers"], producto["id"], ctx["harina"])
    assert client.delete(f"/gestion/productos/{archivado['id']}", headers=ctx["headers"]).status_code == 204
    fila = db_session.get(Producto, publicado["id"])
    fila.publicado, fila.id_publico = True, "a" * 32
    db_session.commit()

    nombres = [p["nombre"] for p in _productos(client, ctx["headers"], ctx["harina"]["id"]).json()]

    assert nombres == ["Borrador", "Publicado"]


def test_productos_ordenados_por_nombre_sin_distinguir_mayusculas_y_luego_id(client, ctx) -> None:
    ids = {}
    for nombre, codigo in (("berlín", "b-001"), ("Alfajor", "a-001"), ("Berlín", "b-002")):
        ids[codigo] = crear_producto(client, ctx["headers"], nombre, codigo)["id"]
        formular(client, ctx["headers"], ids[codigo], ctx["harina"])

    filas = _productos(client, ctx["headers"], ctx["harina"]["id"]).json()

    assert [f["id"] for f in filas] == [ids["a-001"], ids["b-001"], ids["b-002"]]


# --- Insumos asociados ------------------------------------------------------------------------------


def test_pt_ht08_03_insumo_activo_e_inactivo_con_marca_y_estado(client, ctx) -> None:
    activo = crear_insumo(client, ctx["headers"], ctx["leche"]["id"], "Leche Soprole 1 L", marca_origen="Soprole")
    inactivo = crear_insumo(client, ctx["headers"], ctx["leche"]["id"], "Leche de feria", marca_origen="Feria local")
    assert client.delete(f"/gestion/insumos/{inactivo['id']}", headers=ctx["headers"]).status_code == 204

    respuesta = _insumos(client, ctx["headers"], ctx["leche"]["id"])

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json() == [
        {"id": activo["id"], "nombre": "Leche Soprole 1 L", "marca_origen": "Soprole", "activo": True},
        {"id": inactivo["id"], "nombre": "Leche de feria", "marca_origen": "Feria local", "activo": False},
    ]


def test_insumos_activos_primero_y_luego_por_nombre(client, ctx) -> None:
    zeta = crear_insumo(client, ctx["headers"], ctx["leche"]["id"], "zeta")
    beta = crear_insumo(client, ctx["headers"], ctx["leche"]["id"], "Beta")
    alfa_inactivo = crear_insumo(client, ctx["headers"], ctx["leche"]["id"], "Alfa")
    client.delete(f"/gestion/insumos/{alfa_inactivo['id']}", headers=ctx["headers"])
    crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Aaa de otro ingrediente")

    filas = _insumos(client, ctx["headers"], ctx["leche"]["id"]).json()

    assert [f["id"] for f in filas] == [beta["id"], zeta["id"], alfa_inactivo["id"]]


# --- PT-HT08-05: sin datos ---------------------------------------------------------------------------


def test_pt_ht08_05_ingrediente_sin_productos_ni_insumos_da_listas_vacias(client, ctx) -> None:
    assert _productos(client, ctx["headers"], ctx["sal"]["id"]).json() == []
    assert _insumos(client, ctx["headers"], ctx["sal"]["id"]).json() == []


# --- PT-HT08-07: aislamiento por productor ------------------------------------------------------------


@pytest.mark.parametrize("ruta", ["productos", "insumos"])
def test_pt_ht08_07_ingrediente_de_otro_productor_responde_404(client, ctx, ruta) -> None:
    otro = registrar(client, PRODUCTOR_B)

    respuesta = client.get(f"/gestion/ingredientes/{ctx['harina']['id']}/{ruta}", headers=otro)

    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO


@pytest.mark.parametrize("ruta", ["productos", "insumos"])
def test_ingrediente_desactivado_o_inexistente_responde_404(client, ctx, ruta) -> None:
    assert client.delete(f"/gestion/ingredientes/{ctx['sal']['id']}", headers=ctx["headers"]).status_code == 204

    for ingrediente_id in (ctx["sal"]["id"], 999_999):
        respuesta = client.get(f"/gestion/ingredientes/{ingrediente_id}/{ruta}", headers=ctx["headers"])
        assert respuesta.status_code == 404
        assert respuesta.json() == NO_ENCONTRADO


@pytest.mark.parametrize("ruta", ["productos", "insumos"])
def test_sin_token_responde_401(client, ctx, ruta) -> None:
    assert client.get(f"/gestion/ingredientes/{ctx['harina']['id']}/{ruta}").status_code == 401


def test_pt_ht08_07_filas_de_otro_productor_nunca_aparecen(client, ctx, db_session) -> None:
    """Safeguard: rows of productor B that point to A's ingredient (impossible through the API,
    inserted directly) are left out because each query also filters by the row's own productor."""
    registrar(client, PRODUCTOR_B)
    productor_b = _productor_id(db_session, PRODUCTOR_B["email"])
    ajeno = Producto(productor_id=productor_b, nombre="Producto ajeno", activo=True)
    db_session.add(ajeno)
    db_session.flush()
    version = VersionProducto(producto_id=ajeno.id, numero_version=1, descripcion="v1", vigente=True)
    db_session.add(version)
    db_session.flush()
    db_session.add_all(
        [
            FormulacionVersionProducto(
                version_producto_id=version.id,
                ingrediente_id=ctx["harina"]["id"],
                ingrediente_nombre="Harina",
            ),
            InsumoComercial(
                productor_id=productor_b,
                ingrediente_id=ctx["harina"]["id"],
                nombre="Insumo ajeno",
                marca_origen="Marca B",
            ),
        ]
    )
    db_session.commit()
    propio = crear_producto(client, ctx["headers"], "Pan amasado", "pan-001")
    formular(client, ctx["headers"], propio["id"], ctx["harina"])
    insumo_propio = crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Harina Selecta")

    productos = _productos(client, ctx["headers"], ctx["harina"]["id"]).json()
    insumos = _insumos(client, ctx["headers"], ctx["harina"]["id"]).json()

    assert [p["id"] for p in productos] == [propio["id"]]
    assert [i["id"] for i in insumos] == [insumo_propio["id"]]


# --- PT-HT08-08: solo lectura y sin N+1 ----------------------------------------------------------------


def _sentencias(client, db_session, url: str, headers: dict) -> list[str]:
    sentencias: list[str] = []

    def registrar_sentencia(conn, cursor, statement, *args):
        sentencias.append(statement)

    motor = db_session.get_bind()
    event.listen(motor, "before_cursor_execute", registrar_sentencia)
    try:
        assert client.get(url, headers=headers).status_code == 200
    finally:
        event.remove(motor, "before_cursor_execute", registrar_sentencia)
    return sentencias


@pytest.mark.parametrize("ruta", ["productos", "insumos"])
def test_pt_ht08_08_las_consultas_no_escriben_en_la_base(client, ctx, db_session, ruta) -> None:
    producto = crear_producto(client, ctx["headers"], "Pan amasado", "pan-001")
    formular(client, ctx["headers"], producto["id"], ctx["harina"])
    crear_insumo(client, ctx["headers"], ctx["harina"]["id"], "Harina Selecta")

    sentencias = _sentencias(client, db_session, f"/gestion/ingredientes/{ctx['harina']['id']}/{ruta}", ctx["headers"])

    escrituras = [s for s in sentencias if s.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))]
    assert sentencias and escrituras == []


@pytest.mark.parametrize("ruta", ["productos", "insumos"])
def test_la_cantidad_de_consultas_no_crece_con_las_filas(client, ctx, db_session, ruta) -> None:
    url = f"/gestion/ingredientes/{ctx['harina']['id']}/{ruta}"

    def agregar(numero: int) -> None:
        producto = crear_producto(client, ctx["headers"], f"Producto {numero}", f"p-{numero:03d}")
        formular(client, ctx["headers"], producto["id"], ctx["harina"])
        crear_insumo(client, ctx["headers"], ctx["harina"]["id"], f"Insumo {numero}")

    agregar(1)
    pocas = len(_sentencias(client, db_session, url, ctx["headers"]))
    for numero in range(2, 6):
        agregar(numero)
    muchas = _sentencias(client, db_session, url, ctx["headers"])

    assert len(client.get(url, headers=ctx["headers"]).json()) == 5
    assert pocas == len(muchas)

