"""Regression tests for historical traceability (RT-01)."""


def _crear_escenario_inicial(client) -> dict:
    producto = client.post("/productos", json={"nombre": "Galleta"}).json()
    vp1 = client.post(
        f"/productos/{producto['id']}/versiones",
        json={"descripcion": "Formulación original"},
    ).json()
    ingrediente = client.post("/ingredientes", json={"nombre": "Chocolate"}).json()
    vi1 = client.post(
        f"/ingredientes/{ingrediente['id']}/versiones",
        json={
            "composicion_declarada": "Cacao, azúcar, leche",
            "alergenos_declarados": "Leche",
        },
    ).json()
    ch001 = client.post(
        "/lotes-ingredientes",
        json={"codigo_lote": "CH-001", "version_ingrediente_id": vi1["id"]},
    ).json()
    lp001 = client.post(
        "/lotes-productos",
        json={
            "codigo_lote": "LP-001",
            "version_producto_id": vp1["id"],
            "lotes_ingredientes": ["CH-001"],
        },
    ).json()
    return {
        "producto": producto,
        "vp1": vp1,
        "ingrediente": ingrediente,
        "vi1": vi1,
        "ch001": ch001,
        "lp001": lp001,
    }


def _crear_escenario_posterior(client, escenario: dict) -> dict:
    vp2 = client.post(
        f"/productos/{escenario['producto']['id']}/versiones",
        json={"descripcion": "Formulación revisada"},
    ).json()
    vi2 = client.post(
        f"/ingredientes/{escenario['ingrediente']['id']}/versiones",
        json={
            "composicion_declarada": "Cacao, azúcar, leche descremada",
            "alergenos_declarados": "Leche",
        },
    ).json()
    ch002 = client.post(
        "/lotes-ingredientes",
        json={"codigo_lote": "CH-002", "version_ingrediente_id": vi2["id"]},
    ).json()
    lp002 = client.post(
        "/lotes-productos",
        json={
            "codigo_lote": "LP-002",
            "version_producto_id": vp2["id"],
            "lotes_ingredientes": ["CH-002"],
        },
    ).json()
    return {"vp2": vp2, "vi2": vi2, "ch002": ch002, "lp002": lp002}


def test_pr01_registrar_version_inicial_producto_e_ingrediente(client) -> None:
    """PR-01: registros creados correctamente."""
    producto_resp = client.post("/productos", json={"nombre": "Galleta"})
    assert producto_resp.status_code == 201
    producto = producto_resp.json()
    assert producto["nombre"] == "Galleta"
    assert producto["activo"] is True

    vp_resp = client.post(
        f"/productos/{producto['id']}/versiones",
        json={"descripcion": "Formulación original"},
    )
    assert vp_resp.status_code == 201
    vp1 = vp_resp.json()
    assert vp1["numero_version"] == 1
    assert vp1["descripcion"] == "Formulación original"

    ingrediente_resp = client.post("/ingredientes", json={"nombre": "Chocolate"})
    assert ingrediente_resp.status_code == 201
    ingrediente = ingrediente_resp.json()
    assert ingrediente["nombre"] == "Chocolate"

    vi_resp = client.post(
        f"/ingredientes/{ingrediente['id']}/versiones",
        json={
            "composicion_declarada": "Cacao, azúcar, leche",
            "alergenos_declarados": "Leche",
        },
    )
    assert vi_resp.status_code == 201
    vi1 = vi_resp.json()
    assert vi1["numero_version"] == 1
    assert vi1["composicion_declarada"] == "Cacao, azúcar, leche"


def test_pr02_registrar_lote_ingrediente_y_lote_producto(client) -> None:
    """PR-02: relaciones históricas almacenadas correctamente."""
    escenario = _crear_escenario_inicial(client)
    assert escenario["ch001"]["codigo_lote"] == "CH-001"
    assert escenario["ch001"]["version_ingrediente_id"] == escenario["vi1"]["id"]
    assert escenario["lp001"]["codigo_lote"] == "LP-001"
    assert escenario["lp001"]["version_producto_id"] == escenario["vp1"]["id"]

    trazabilidad = client.get("/lotes-productos/LP-001/trazabilidad").json()
    assert trazabilidad["lote_producto"] == "LP-001"
    assert trazabilidad["producto"]["version"] == 1
    assert trazabilidad["ingredientes_utilizados"][0]["lote"] == "CH-001"
    assert trazabilidad["ingredientes_utilizados"][0]["version"] == 1


def test_pr03_nuevas_versiones_no_modifican_anteriores(client) -> None:
    """PR-03: versiones anteriores permanecen disponibles y sin modificaciones."""
    escenario = _crear_escenario_inicial(client)
    _crear_escenario_posterior(client, escenario)

    versiones_producto = client.get(
        f"/productos/{escenario['producto']['id']}/versiones"
    ).json()
    assert len(versiones_producto) == 2
    vp1 = next(v for v in versiones_producto if v["numero_version"] == 1)
    vp2 = next(v for v in versiones_producto if v["numero_version"] == 2)
    assert vp1["descripcion"] == "Formulación original"
    assert vp2["descripcion"] == "Formulación revisada"

    versiones_ingrediente = client.get(
        f"/ingredientes/{escenario['ingrediente']['id']}/versiones"
    ).json()
    assert len(versiones_ingrediente) == 2
    vi1 = next(v for v in versiones_ingrediente if v["numero_version"] == 1)
    vi2 = next(v for v in versiones_ingrediente if v["numero_version"] == 2)
    assert vi1["composicion_declarada"] == "Cacao, azúcar, leche"
    assert vi2["composicion_declarada"] == "Cacao, azúcar, leche descremada"


def test_pr04_registrar_nuevos_lotes_con_nuevas_versiones(client) -> None:
    """PR-04: nuevos lotes relacionados correctamente."""
    escenario = _crear_escenario_inicial(client)
    posterior = _crear_escenario_posterior(client, escenario)

    assert posterior["ch002"]["version_ingrediente_id"] == posterior["vi2"]["id"]
    assert posterior["lp002"]["version_producto_id"] == posterior["vp2"]["id"]

    traz_lp002 = client.get("/lotes-productos/LP-002/trazabilidad").json()
    assert traz_lp002["producto"]["version"] == 2
    assert traz_lp002["ingredientes_utilizados"][0]["lote"] == "CH-002"
    assert traz_lp002["ingredientes_utilizados"][0]["version"] == 2


def test_pr05_lp001_conserva_trazabilidad_historica(client) -> None:
    """PR-05: LP-001 recupera exclusivamente VP1 + CH-001 + VI1."""
    escenario = _crear_escenario_inicial(client)
    _crear_escenario_posterior(client, escenario)

    trazabilidad = client.get("/lotes-productos/LP-001/trazabilidad").json()
    assert trazabilidad["lote_producto"] == "LP-001"
    assert trazabilidad["producto"] == {
        "nombre": "Galleta",
        "version": 1,
        "descripcion": "Formulación original",
    }
    assert trazabilidad["ingredientes_utilizados"] == [
        {
            "ingrediente": "Chocolate",
            "lote": "CH-001",
            "version": 1,
            "composicion_declarada": "Cacao, azúcar, leche",
            "alergenos_declarados": "Leche",
        }
    ]


def test_pr06_lp002_recupera_trazabilidad_nueva(client) -> None:
    """PR-06: LP-002 recupera VP2 + CH-002 + VI2."""
    escenario = _crear_escenario_inicial(client)
    _crear_escenario_posterior(client, escenario)

    trazabilidad = client.get("/lotes-productos/LP-002/trazabilidad").json()
    assert trazabilidad["lote_producto"] == "LP-002"
    assert trazabilidad["producto"]["version"] == 2
    assert trazabilidad["producto"]["descripcion"] == "Formulación revisada"
    assert trazabilidad["ingredientes_utilizados"][0]["lote"] == "CH-002"
    assert trazabilidad["ingredientes_utilizados"][0]["version"] == 2
    assert (
        trazabilidad["ingredientes_utilizados"][0]["composicion_declarada"]
        == "Cacao, azúcar, leche descremada"
    )


def test_pr07_lotes_mantienen_trazabilidades_independientes(client) -> None:
    """PR-07: LP-001 y LP-002 mantienen trazabilidades históricas independientes."""
    escenario = _crear_escenario_inicial(client)
    _crear_escenario_posterior(client, escenario)

    traz_lp001 = client.get("/lotes-productos/LP-001/trazabilidad").json()
    traz_lp002 = client.get("/lotes-productos/LP-002/trazabilidad").json()

    assert traz_lp001["producto"]["version"] == 1
    assert traz_lp002["producto"]["version"] == 2
    assert traz_lp001["ingredientes_utilizados"][0]["lote"] == "CH-001"
    assert traz_lp002["ingredientes_utilizados"][0]["lote"] == "CH-002"
    assert traz_lp001 != traz_lp002
