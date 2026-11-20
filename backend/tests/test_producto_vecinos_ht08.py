"""HT08 / T-HT08-04: GET /gestion/productos/{id}/vecinos (previous and next product of the detail).

Covers PT-HT08-09 (walk from the first to the last product and back, in the order of the list, with no
neighbour at the ends), PT-HT08-10 (another productor's products never appear; their id answers 404),
archived products, a single product, 401, read-only and a constant number of queries.
"""

from datetime import datetime, timedelta, timezone

from sqlalchemy import event, select

from app.models import Producto
from app.repositories.vecinos import buscar_vecinos
from tests.escenario_hu05 import PRODUCTOR_B, crear_producto, registrar

NO_ENCONTRADO = {"detail": "Producto no encontrado"}
BASE = datetime(2026, 11, 1, 12, 0, tzinfo=timezone.utc)


def _vecinos(client, headers, producto_id: int):
    return client.get(f"/gestion/productos/{producto_id}/vecinos", headers=headers)


def _orden_de_la_lista(client, headers) -> list[int]:
    return [p["id"] for p in client.get("/gestion/productos", headers=headers).json()]


def _fechar(db_session, fechas: dict[int, datetime]) -> None:
    """Fix created_at so the order of the list does not depend on how fast the test runs."""
    for producto_id, fecha in fechas.items():
        db_session.get(Producto, producto_id).created_at = fecha
    db_session.commit()


def _productos(client, headers, db_session, *nombres: str, desde: datetime = BASE) -> list[dict]:
    creados = [crear_producto(client, headers, nombre, f"p-{i:03d}") for i, nombre in enumerate(nombres)]
    # Days apart, and NOT in id order: the second one is the most recent.
    dias = [0, 2, 1, 3][: len(creados)]
    _fechar(db_session, {p["id"]: desde + timedelta(days=d) for p, d in zip(creados, dias)})
    return creados


def test_pt_ht08_09_recorre_del_primero_al_ultimo_y_vuelve_en_el_orden_de_la_lista(client, db_session) -> None:
    headers = registrar(client)
    _productos(client, headers, db_session, "Alfajor", "Berlín", "Chilenito", "Donut")
    orden = _orden_de_la_lista(client, headers)
    assert len(orden) == 4

    # Forward with «Siguiente».
    recorrido = [orden[0]]
    respuesta = _vecinos(client, headers, orden[0]).json()
    assert respuesta["anterior"] is None
    while respuesta["siguiente"] is not None:
        recorrido.append(respuesta["siguiente"]["id"])
        respuesta = _vecinos(client, headers, recorrido[-1]).json()
    assert recorrido == orden

    # Back with «Anterior».
    regreso = [orden[-1]]
    respuesta = _vecinos(client, headers, orden[-1]).json()
    assert respuesta["siguiente"] is None
    while respuesta["anterior"] is not None:
        regreso.append(respuesta["anterior"]["id"])
        respuesta = _vecinos(client, headers, regreso[-1]).json()
    assert regreso == list(reversed(orden))


def test_el_orden_es_el_de_mas_recientes_no_el_del_id(client, db_session) -> None:
    headers = registrar(client)
    alfajor, berlin, chilenito = _productos(client, headers, db_session, "Alfajor", "Berlín", "Chilenito")

    # created_at: Berlín (day 2) > Chilenito (day 1) > Alfajor (day 0).
    assert _orden_de_la_lista(client, headers) == [berlin["id"], chilenito["id"], alfajor["id"]]
    assert _vecinos(client, headers, chilenito["id"]).json() == {
        "anterior": {"id": berlin["id"], "nombre": "Berlín"},
        "siguiente": {"id": alfajor["id"], "nombre": "Alfajor"},
    }


def test_con_la_misma_fecha_desempata_por_id_como_la_lista(client, db_session) -> None:
    headers = registrar(client)
    a, b, c = (crear_producto(client, headers, n, f"m-{n}") for n in ("A", "B", "C"))
    _fechar(db_session, {p["id"]: BASE for p in (a, b, c)})

    orden = _orden_de_la_lista(client, headers)
    assert orden == [c["id"], b["id"], a["id"]]
    medio = _vecinos(client, headers, b["id"]).json()
    assert (medio["anterior"]["id"], medio["siguiente"]["id"]) == (c["id"], a["id"])


def test_pt_ht08_10_productos_de_otro_productor_nunca_son_vecinos(client, db_session) -> None:
    headers = registrar(client)
    otro = registrar(client, PRODUCTOR_B)
    propios = _productos(client, headers, db_session, "Alfajor", "Berlín", "Chilenito")
    # B's products fall right between A's in time.
    ajenos = [crear_producto(client, otro, f"Ajeno {i}", f"aj-{i}") for i in range(3)]
    _fechar(db_session, {p["id"]: BASE + timedelta(days=i, hours=12) for i, p in enumerate(ajenos)})

    ids_propios = {p["id"] for p in propios}
    for producto in propios:
        cuerpo = _vecinos(client, headers, producto["id"]).json()
        for vecino in (cuerpo["anterior"], cuerpo["siguiente"]):
            assert vecino is None or vecino["id"] in ids_propios

    respuesta = _vecinos(client, headers, ajenos[0]["id"])
    assert respuesta.status_code == 404
    assert respuesta.json() == NO_ENCONTRADO


def test_un_producto_archivado_no_es_vecino_y_el_propio_archivado_da_404(client, db_session) -> None:
    headers = registrar(client)
    alfajor, berlin, chilenito = _productos(client, headers, db_session, "Alfajor", "Berlín", "Chilenito")
    # Order: Berlín, Chilenito, Alfajor. Archive the middle one.
    assert client.delete(f"/gestion/productos/{chilenito['id']}", headers=headers).status_code == 204

    assert _vecinos(client, headers, berlin["id"]).json()["siguiente"] == {"id": alfajor["id"], "nombre": "Alfajor"}
    assert _vecinos(client, headers, alfajor["id"]).json()["anterior"] == {"id": berlin["id"], "nombre": "Berlín"}
    archivado = _vecinos(client, headers, chilenito["id"])
    assert archivado.status_code == 404
    assert archivado.json() == NO_ENCONTRADO


def test_un_solo_producto_no_tiene_vecinos(client) -> None:
    headers = registrar(client)
    unico = crear_producto(client, headers, "Único", "uni-001")

    respuesta = _vecinos(client, headers, unico["id"])

    assert respuesta.status_code == 200
    assert respuesta.json() == {"anterior": None, "siguiente": None}


def test_inexistente_da_404_y_sin_token_401(client) -> None:
    headers = registrar(client)
    unico = crear_producto(client, headers, "Único", "uni-001")

    assert _vecinos(client, headers, 999_999).json() == NO_ENCONTRADO
    assert client.get(f"/gestion/productos/{unico['id']}/vecinos").status_code == 401


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


def test_solo_lee_y_hace_las_mismas_consultas_con_pocos_o_muchos_productos(client, db_session) -> None:
    headers = registrar(client)
    primero = crear_producto(client, headers, "Primero", "pri-001")
    url = f"/gestion/productos/{primero['id']}/vecinos"
    pocas = _sentencias(client, db_session, url, headers)
    for i in range(8):
        crear_producto(client, headers, f"Otro {i}", f"otr-{i}")

    muchas = _sentencias(client, db_session, url, headers)

    assert len(pocas) == len(muchas)
    assert not [s for s in muchas if s.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE"))]


# --- buscar_vecinos: the reusable helper (products now; elaboraciones and supplies in T-HT08-04B) ----


def _consulta_por_nombre(productor_id: int):
    """Any filtered and ordered query works: here by name, not the product list's order."""
    return (
        select(Producto.id, Producto.nombre)
        .where(Producto.productor_id == productor_id)
        .order_by(Producto.nombre.asc())
    )


def test_buscar_vecinos_respeta_el_orden_de_la_consulta_que_recibe(client, db_session) -> None:
    headers = registrar(client)
    ids = {n: crear_producto(client, headers, n, f"v-{n}")["id"] for n in ("Cecina", "Alfajor", "Berlín")}
    productor_id = db_session.get(Producto, ids["Alfajor"]).productor_id
    consulta = _consulta_por_nombre(productor_id)

    primero = buscar_vecinos(db_session, consulta, ids["Alfajor"])
    medio = buscar_vecinos(db_session, consulta, ids["Berlín"])
    ultimo = buscar_vecinos(db_session, consulta, ids["Cecina"])

    assert primero.anterior is None and primero.siguiente.nombre == "Berlín"
    assert (medio.anterior.nombre, medio.siguiente.nombre) == ("Alfajor", "Cecina")
    assert ultimo.anterior.nombre == "Berlín" and ultimo.siguiente is None


def test_buscar_vecinos_da_none_si_el_registro_no_esta_en_la_consulta(client, db_session) -> None:
    headers = registrar(client)
    otro = registrar(client, PRODUCTOR_B)
    propio = crear_producto(client, headers, "Propio", "pro-001")
    ajeno = crear_producto(client, otro, "Ajeno", "aje-001")
    productor_id = db_session.get(Producto, propio["id"]).productor_id

    assert buscar_vecinos(db_session, _consulta_por_nombre(productor_id), ajeno["id"]) is None
    assert buscar_vecinos(db_session, _consulta_por_nombre(productor_id), 999_999) is None
    solo = buscar_vecinos(db_session, _consulta_por_nombre(productor_id), propio["id"])
    assert (solo.anterior, solo.siguiente) == (None, None)
