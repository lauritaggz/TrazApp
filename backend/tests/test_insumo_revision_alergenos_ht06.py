"""Allergen review state of a commercial supply: model and read schema (HT06-01).

Only the column and what the API reads from it. Nothing sets the date yet: marking a supply as
reviewed is HT06-02, so these tests write the column directly.
"""

from datetime import datetime, timezone

import pytest

from app.models import Alergeno, InsumoAlergeno, InsumoComercial
from app.schemas.insumo import InsumoRead
from tests.test_gestion_insumos_hu04 import _crear, _headers, _ingrediente, _obtener

FECHA = datetime(2026, 10, 7, 15, 30, tzinfo=timezone.utc)


def _utc(texto: str) -> datetime:
    """SQLite returns naive datetimes (stored as UTC); PostgreSQL returns them with a zone."""
    fecha = datetime.fromisoformat(texto)
    return fecha if fecha.tzinfo else fecha.replace(tzinfo=timezone.utc)


@pytest.fixture
def ana(client) -> dict[str, str]:
    return _headers(client)


@pytest.fixture
def leche(client, ana) -> int:
    return _ingrediente(client, ana)


def _revisar(db_session, insumo_id: int, fecha: datetime | None = FECHA) -> None:
    db_session.get(InsumoComercial, insumo_id).alergenos_revisados_at = fecha
    db_session.commit()


def test_un_insumo_nuevo_nace_sin_revisar(client, db_session, ana, leche) -> None:
    creado = _crear(client, ana, leche)

    assert creado["alergenos_revisados"] is False
    assert creado["alergenos_revisados_at"] is None
    assert db_session.get(InsumoComercial, creado["id"]).alergenos_revisados_at is None


def test_el_detalle_y_el_listado_exponen_el_estado_de_revision(client, db_session, ana, leche) -> None:
    sin_revisar = _crear(client, ana, leche, nombre="Leche sin revisar")
    revisado = _crear(client, ana, leche, nombre="Leche revisada")
    _revisar(db_session, revisado["id"])

    detalle = _obtener(client, ana, revisado["id"])
    assert detalle["alergenos_revisados"] is True
    assert _utc(detalle["alergenos_revisados_at"]) == FECHA
    assert _obtener(client, ana, sin_revisar["id"])["alergenos_revisados"] is False

    listado = {i["id"]: i for i in client.get("/gestion/insumos", headers=ana).json()}
    assert listado[revisado["id"]]["alergenos_revisados"] is True
    assert _utc(listado[revisado["id"]]["alergenos_revisados_at"]) == FECHA
    assert listado[sin_revisar["id"]]["alergenos_revisados"] is False
    assert listado[sin_revisar["id"]]["alergenos_revisados_at"] is None


def test_revisado_sin_alergenos_se_distingue_de_sin_revisar(client, db_session, ana, leche) -> None:
    """Both have an empty allergen list; only the date tells them apart."""
    sin_revisar = _crear(client, ana, leche, nombre="Sin revisar")
    revisado_vacio = _crear(client, ana, leche, nombre="Revisado vacío")
    _revisar(db_session, revisado_vacio["id"])

    a = _obtener(client, ana, sin_revisar["id"])
    b = _obtener(client, ana, revisado_vacio["id"])

    assert a["alergenos_declarados"] == b["alergenos_declarados"] == []
    assert (a["alergenos_revisados"], b["alergenos_revisados"]) == (False, True)


def test_editar_el_insumo_no_cambia_el_estado_de_revision(client, db_session, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    _revisar(db_session, insumo["id"])

    respuesta = client.patch(f"/gestion/insumos/{insumo['id']}", headers=ana, json={"marca_origen": "Otra marca"})

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["alergenos_revisados"] is True
    assert _utc(respuesta.json()["alergenos_revisados_at"]) == FECHA


def test_el_cliente_no_puede_enviar_el_estado_de_revision_al_crear(client, ana, leche) -> None:
    respuesta = client.post(
        "/gestion/insumos",
        headers=ana,
        json={"ingrediente_id": leche, "nombre": "Leche", "marca_origen": "Colun", "alergenos_revisados_at": FECHA.isoformat()},
    )

    assert respuesta.status_code == 422


def test_el_cliente_no_puede_cambiar_el_estado_de_revision_al_editar(client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)

    respuesta = client.patch(
        f"/gestion/insumos/{insumo['id']}", headers=ana, json={"alergenos_revisados_at": FECHA.isoformat()}
    )

    assert respuesta.status_code == 422
    assert _obtener(client, ana, insumo["id"])["alergenos_revisados"] is False


def test_el_schema_de_lectura_deriva_el_booleano_de_la_fecha(db_session, client, ana, leche) -> None:
    insumo = _crear(client, ana, leche)
    _revisar(db_session, insumo["id"])
    modelo = db_session.get(InsumoComercial, insumo["id"])

    assert InsumoRead.from_insumo(modelo).alergenos_revisados is True
    modelo.alergenos_revisados_at = None
    leida = InsumoRead.from_insumo(modelo)
    assert (leida.alergenos_revisados, leida.alergenos_revisados_at) == (False, None)


def test_las_filas_de_alergenos_no_marcan_la_revision_por_si_solas(client, db_session, ana, leche) -> None:
    """The review date is set by the endpoints (HT06-02), never derived from the rows at read time."""
    insumo = _crear(client, ana, leche)
    alergeno = Alergeno(codigo="zz-fila", nombre="Fila", obligatorio_chile=False)
    db_session.add(alergeno)
    db_session.flush()
    db_session.add(InsumoAlergeno(insumo_id=insumo["id"], alergeno_id=alergeno.id, tipo="contiene"))
    db_session.commit()

    detalle = _obtener(client, ana, insumo["id"])

    assert [a["codigo"] for a in detalle["alergenos_declarados"]] == ["zz-fila"]
    assert detalle["alergenos_revisados"] is False
