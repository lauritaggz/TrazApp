"""Helpers shared by the HU05 test modules: build a productor, products, ingredients,
supplies and formulations through the real API."""

import threading
from typing import Any

PRODUCTOR_A = {
    "nombre": "Productor A",
    "nombre_negocio": "Panaderia A",
    "email": "productor.a.hu05@ejemplo.com",
    "password": "SecretoProductor123!",
}
PRODUCTOR_B = {
    "nombre": "Productor B",
    "nombre_negocio": "Panaderia B",
    "email": "productor.b.hu05@ejemplo.com",
    "password": "SecretoProductor123!",
}


def registrar(client, productor: dict = PRODUCTOR_A) -> dict[str, str]:
    assert client.post("/auth/register", json=productor).status_code == 201
    login = client.post(
        "/auth/login",
        json={"email": productor["email"], "password": productor["password"]},
    )
    assert login.status_code == 200
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def crear_producto(client, headers, nombre: str = "Queque de vainilla", codigo: str = "que-001") -> dict:
    response = client.post(
        "/gestion/productos",
        headers=headers,
        json={
            "codigo_interno": codigo,
            "nombre": nombre,
            "descripcion": "Producto casero.",
            "contenido_neto": "250.000",
            "unidad_medida": "g",
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def crear_ingrediente(client, headers, nombre: str, codigo: str | None = None) -> dict:
    response = client.post(
        "/gestion/ingredientes",
        headers=headers,
        json={"codigo_interno": codigo or nombre[:3].lower() + "-001", "nombre": nombre},
    )
    assert response.status_code == 201, response.text
    return response.json()


def crear_insumo(client, headers, ingrediente_id: int, nombre: str, **extra: Any) -> dict:
    response = client.post(
        "/gestion/insumos",
        headers=headers,
        json={"ingrediente_id": ingrediente_id, "nombre": nombre, "marca_origen": "Marca", **extra},
    )
    assert response.status_code == 201, response.text
    return response.json()


def formular(client, headers, producto_id: int, *ingredientes: dict) -> dict:
    """PUT the formulation (one line per ingredient, in the given order)."""
    response = client.put(
        f"/gestion/productos/{producto_id}/formulacion",
        headers=headers,
        json={"lineas": [{"ingrediente_id": item["id"]} for item in ingredientes]},
    )
    assert response.status_code == 200, response.text
    return response.json()


def crear_elaboracion(client, headers, producto_id: int, **cuerpo: Any):
    return client.post(
        f"/gestion/productos/{producto_id}/elaboraciones",
        headers=headers,
        json=cuerpo,
    )


def preparar(client, headers) -> dict:
    """Product with a formulation (harina, leche): leche has a habitual supply, harina none."""
    producto = crear_producto(client, headers)
    harina = crear_ingrediente(client, headers, "Harina", "har-001")
    leche = crear_ingrediente(client, headers, "Leche", "lec-001")
    habitual = crear_insumo(
        client, headers, leche["id"], "Leche Colun Semidescremada 1 L", habitual=True
    )
    otro = crear_insumo(client, headers, leche["id"], "Leche Soprole Entera 1 L")
    formulacion = formular(client, headers, producto["id"], harina, leche)
    return {
        "producto": producto,
        "harina": harina,
        "leche": leche,
        "insumo_habitual": habitual,
        "insumo_otro": otro,
        "version": formulacion["version"],
    }


EAN_LECHE = "7802910000971"


def crear_alergenos(sesion) -> dict[str, int]:
    """Catalog allergens (the test schema has no seed): leche and apio, soya as traces."""
    from app.models import Alergeno

    filas = {
        "leche": Alergeno(codigo="leche", nombre="Leche", obligatorio_chile=True),
        "soya": Alergeno(codigo="soya", nombre="Soya", obligatorio_chile=True),
        "apio": Alergeno(codigo="apio", nombre="Apio", obligatorio_chile=False),
    }
    sesion.add_all(filas.values())
    sesion.commit()
    return {codigo: alergeno.id for codigo, alergeno in filas.items()}


def completar_insumo(client, headers, insumo_id: int, alergenos: dict[str, int]) -> None:
    """Give the supply every conserved field, a raw source sheet and three declared allergens."""
    response = client.patch(
        f"/gestion/insumos/{insumo_id}",
        headers=headers,
        json={
            "presentacion": "Caja 1 L",
            "codigo_barras": EAN_LECHE,
            "ingredientes_declarados": "Leche semidescremada, vitaminas A y D",
            "advertencias": "Puede contener trazas de soya",
            "ficha": {"product_name": "ficha cruda de la fuente"},
            "fuente": "open_food_facts",
            "fecha_recuperacion": "2026-10-01T12:00:00Z",
        },
    )
    assert response.status_code == 200, response.text
    for codigo, tipo in (("soya", "trazas"), ("apio", "contiene"), ("leche", "contiene")):
        respuesta = client.post(
            f"/gestion/insumos/{insumo_id}/alergenos",
            headers=headers,
            json={"alergeno_id": alergenos[codigo], "tipo": tipo},
        )
        assert respuesta.status_code == 201, respuesta.text


def asignacion_completa(ctx: dict) -> list[dict]:
    """Harina without lot and leche with a new lot: every line complete."""
    return [
        {"ingrediente_id": ctx["harina"]["id"], "insumo_id": ctx["insumo_harina"]["id"], "lote": {"tipo": "sin_lote"}},
        {
            "ingrediente_id": ctx["leche"]["id"],
            "insumo_id": ctx["insumo_habitual"]["id"],
            "lote": {"tipo": "nuevo", "codigo": "X123", "fecha_vencimiento": "2026-10-15"},
        },
    ]


class Pausa:
    """Stops the first caller of a repository method until the test lets it continue."""

    def __init__(self) -> None:
        self.leido = threading.Event()
        self.continuar = threading.Event()
        self._usada = False

    def instalar(self, monkeypatch, clase, nombre: str) -> None:
        original = getattr(clase, nombre)
        pausa = self

        def envuelto(self, *args, **kwargs):
            resultado = original(self, *args, **kwargs)
            if not pausa._usada:
                pausa._usada = True
                pausa.leido.set()
                assert pausa.continuar.wait(timeout=30), "el test no liberó la pausa"
            return resultado

        monkeypatch.setattr(clase, nombre, envuelto)


def en_hilo(resultados: list, clave: str, funcion) -> threading.Thread:
    def correr() -> None:
        try:
            resultados.append((clave, funcion()))
        except BaseException as exc:  # noqa: BLE001 - the test inspects what happened
            resultados.append((clave, exc))

    hilo = threading.Thread(target=correr, daemon=True)
    hilo.start()
    return hilo
