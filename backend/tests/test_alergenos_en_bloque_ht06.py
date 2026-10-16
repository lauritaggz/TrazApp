"""Allergens in bulk and the review state they record (HT06-02).

POST /gestion/insumos with `alergenos`, PUT /gestion/insumos/{id}/alergenos and the effect of the
individual allergen endpoints on `alergenos_revisados_at`. These tests share one session between
the request and the assertions; the persistence and concurrency cases (own sessions, locks) are in
test_persistencia_alergenos_ht06.py.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy import exists, func, select, update
from sqlalchemy.sql.functions import FunctionElement

from app.models import Alergeno, InsumoAlergeno, InsumoComercial
from app.repositories.insumo_repository import InsumoRepository
from tests.test_gestion_insumos_hu04 import PRODUCTOR_A, PRODUCTOR_B, _crear, _headers, _ingrediente, _obtener

ANTIGUO = datetime(2020, 1, 1, 12, 0, tzinfo=timezone.utc)
SIN_ZONA = ANTIGUO.replace(tzinfo=None)
MSG_NO_VALIDO = "Alérgeno no válido"
MSG_REPETIDO_EN_LISTA = "El alérgeno está repetido en la lista."
MSG_REPETIDO_INDIVIDUAL = "El alérgeno ya está asociado al insumo."


@pytest.fixture
def ana(client) -> dict[str, str]:
    return _headers(client, PRODUCTOR_A)


@pytest.fixture
def beto(client, ana) -> dict[str, str]:
    return _headers(client, PRODUCTOR_B)


@pytest.fixture
def leche(client, ana) -> int:
    return _ingrediente(client, ana)


@pytest.fixture
def catalogo(db_session) -> dict[str, int]:
    filas = [
        Alergeno(codigo="lacteos", nombre="Leche", obligatorio_chile=True),
        Alergeno(codigo="cacahuetes", nombre="Maní", obligatorio_chile=True),
        Alergeno(codigo="soja", nombre="Soya", obligatorio_chile=True),
        Alergeno(codigo="sesamo", nombre="Sésamo", obligatorio_chile=False),
        Alergeno(codigo="apio", nombre="Apio", obligatorio_chile=False),
    ]
    db_session.add_all(filas)
    db_session.commit()
    return {fila.codigo: fila.id for fila in filas}


@pytest.fixture
def insumo(client, ana, leche) -> int:
    return _crear(client, ana, leche)["id"]


# --- ayudas ------------------------------------------------------------------------------


def _lista(catalogo: dict[str, int], *pares: tuple[str, str]) -> list[dict]:
    return [{"alergeno_id": catalogo[codigo], "tipo": tipo} for codigo, tipo in pares]


def _pares(detalle: dict) -> list[tuple[str, str]]:
    return sorted((a["codigo"], a["tipo"]) for a in detalle["alergenos_declarados"])


def _put(client, headers, insumo_id: int, alergenos):
    return client.put(f"/gestion/insumos/{insumo_id}/alergenos", headers=headers, json={"alergenos": alergenos})


def _fecha(detalle: dict) -> datetime | None:
    texto = detalle["alergenos_revisados_at"]
    if texto is None:
        return None
    fecha = datetime.fromisoformat(texto.replace("Z", "+00:00"))
    return fecha.replace(tzinfo=None)


def _retroceder(db_session, insumo_id: int) -> None:
    """Backdate both dates so any renewal is visible even on clocks with one second resolution."""
    db_session.execute(
        update(InsumoComercial)
        .where(InsumoComercial.id == insumo_id)
        .values(alergenos_revisados_at=ANTIGUO, updated_at=ANTIGUO)
    )
    db_session.commit()
    db_session.expire_all()


def _total(db_session, modelo) -> int:
    return db_session.scalar(select(func.count()).select_from(modelo))


def _con_filas_sin_revisar(db_session) -> list[int]:
    """The invariant of HT06: a supply with allergen rows is always reviewed. Returns the violators."""
    return list(
        db_session.scalars(
            select(InsumoComercial.id).where(
                InsumoComercial.alergenos_revisados_at.is_(None),
                exists().where(InsumoAlergeno.insumo_id == InsumoComercial.id),
            )
        )
    )


def _payload(ingrediente_id: int, **extra) -> dict:
    return {"ingrediente_id": ingrediente_id, "nombre": "Leche Colun Semidescremada 1 L", "marca_origen": "Colun", **extra}


# --- POST /gestion/insumos con alergenos ---------------------------------------------------


def test_el_alta_con_alergenos_crea_el_insumo_con_sus_filas_y_lo_deja_revisado(
    client, db_session, ana, leche, catalogo
) -> None:
    respuesta = client.post(
        "/gestion/insumos",
        headers=ana,
        json=_payload(leche, alergenos=_lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas"))),
    )

    assert respuesta.status_code == 201, respuesta.text
    creado = respuesta.json()
    assert _pares(creado) == [("lacteos", "contiene"), ("soja", "trazas")]
    assert creado["alergenos_revisados"] is True
    assert creado["alergenos_revisados_at"] is not None
    # Same payload when read back, and the rows exist.
    assert _obtener(client, ana, creado["id"]) == creado
    assert _total(db_session, InsumoAlergeno) == 2
    assert _con_filas_sin_revisar(db_session) == []


def test_el_alta_con_lista_vacia_queda_revisada_sin_alergenos(client, db_session, ana, leche, catalogo) -> None:
    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche, alergenos=[]))

    assert respuesta.status_code == 201, respuesta.text
    creado = respuesta.json()
    assert creado["alergenos_declarados"] == []
    assert creado["alergenos_revisados"] is True
    assert creado["alergenos_revisados_at"] is not None
    assert _total(db_session, InsumoAlergeno) == 0


def test_el_alta_sin_el_campo_queda_sin_revisar(client, db_session, ana, leche, catalogo) -> None:
    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche))

    assert respuesta.status_code == 201, respuesta.text
    creado = respuesta.json()
    assert creado["alergenos_declarados"] == []
    assert creado["alergenos_revisados"] is False
    assert creado["alergenos_revisados_at"] is None


def test_el_alta_con_alergenos_null_equivale_a_no_enviar_el_campo(client, ana, leche, catalogo) -> None:
    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche, alergenos=None))

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["alergenos_revisados"] is False


def test_el_alta_con_alergenos_respeta_la_marca_de_habitual(client, ana, leche, catalogo) -> None:
    anterior = _crear(client, ana, leche, nombre="Leche anterior", habitual=True)

    respuesta = client.post(
        "/gestion/insumos",
        headers=ana,
        json=_payload(leche, habitual=True, alergenos=_lista(catalogo, ("lacteos", "contiene"))),
    )

    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json()["habitual"] is True
    assert _obtener(client, ana, anterior["id"])["habitual"] is False


def _sin_rastro(client, ana, db_session) -> None:
    assert client.get("/gestion/insumos", headers=ana).json() == []
    assert client.get("/gestion/insumos?activo=false", headers=ana).json() == []
    assert _total(db_session, InsumoComercial) == 0
    assert _total(db_session, InsumoAlergeno) == 0


CASOS_INVALIDOS = {
    "desconocido": (
        lambda c: [{"alergeno_id": 99999, "tipo": "contiene"}],
        lambda c: {"mensaje": MSG_NO_VALIDO, "alergeno_id": 99999},
    ),
    "valido_y_desconocido": (
        lambda c: _lista(c, ("lacteos", "contiene")) + [{"alergeno_id": 99999, "tipo": "trazas"}],
        lambda c: {"mensaje": MSG_NO_VALIDO, "alergeno_id": 99999},
    ),
    "repetido_mismo_tipo": (
        lambda c: _lista(c, ("lacteos", "contiene"), ("soja", "contiene"), ("lacteos", "contiene")),
        lambda c: {"mensaje": MSG_REPETIDO_EN_LISTA, "alergeno_id": c["lacteos"]},
    ),
    "repetido_otro_tipo": (
        lambda c: _lista(c, ("lacteos", "contiene"), ("lacteos", "trazas")),
        lambda c: {"mensaje": MSG_REPETIDO_EN_LISTA, "alergeno_id": c["lacteos"]},
    ),
}


@pytest.mark.parametrize("caso", sorted(CASOS_INVALIDOS))
def test_el_alta_es_todo_o_nada_ante_una_lista_invalida(client, db_session, ana, leche, catalogo, caso) -> None:
    lista, detalle = CASOS_INVALIDOS[caso]

    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche, alergenos=lista(catalogo)))

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == detalle(catalogo)
    _sin_rastro(client, ana, db_session)


@pytest.mark.parametrize(
    "alergenos",
    [
        [{"alergeno_id": 1, "tipo": "otro"}],
        [{"alergeno_id": 1}],
        [{"tipo": "contiene"}],
        [{"alergeno_id": 0, "tipo": "contiene"}],
        [{"alergeno_id": "x", "tipo": "contiene"}],
        [{"alergeno_id": 1, "tipo": "contiene", "extra": True}],
        "lacteos",
        [1, 2],
    ],
)
def test_el_alta_con_tipo_invalido_o_items_mal_formados_responde_422_y_no_crea_nada(
    client, db_session, ana, leche, catalogo, alergenos
) -> None:
    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche, alergenos=alergenos))

    assert respuesta.status_code == 422
    _sin_rastro(client, ana, db_session)


def test_un_tipo_invalido_no_deja_un_insumo_a_medias_aunque_el_alergeno_exista(
    client, db_session, ana, leche, catalogo
) -> None:
    lista = [{"alergeno_id": catalogo["lacteos"], "tipo": "contiene"}, {"alergeno_id": catalogo["soja"], "tipo": "quizas"}]

    respuesta = client.post("/gestion/insumos", headers=ana, json=_payload(leche, alergenos=lista))

    assert respuesta.status_code == 422
    _sin_rastro(client, ana, db_session)


def test_el_resto_del_alta_no_cambia_con_alergenos_codigo_repetido(client, db_session, ana, leche, catalogo) -> None:
    primero = _crear(client, ana, leche, codigo_barras="7802910000971")
    filas = _total(db_session, InsumoAlergeno)

    respuesta = client.post(
        "/gestion/insumos",
        headers=ana,
        json=_payload(leche, codigo_barras="7802910000971", alergenos=_lista(catalogo, ("lacteos", "contiene"))),
    )

    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == {
        "mensaje": "Ya existe un insumo con ese código de barras.",
        "insumo_id": primero["id"],
        "activo": True,
    }
    assert _total(db_session, InsumoComercial) == 1
    assert _total(db_session, InsumoAlergeno) == filas


def test_el_resto_del_alta_no_cambia_con_alergenos_ingrediente_invalido(client, db_session, ana, catalogo) -> None:
    respuesta = client.post(
        "/gestion/insumos",
        headers=ana,
        json=_payload(99999, alergenos=_lista(catalogo, ("lacteos", "contiene"))),
    )

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == "Ingrediente no válido"
    assert _total(db_session, InsumoAlergeno) == 0


# --- PUT /gestion/insumos/{id}/alergenos ---------------------------------------------------


def test_el_put_reemplaza_la_lista_completa_y_deja_el_insumo_revisado(client, db_session, ana, insumo, catalogo) -> None:
    assert _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas"))).status_code == 200

    respuesta = _put(client, ana, insumo, _lista(catalogo, ("soja", "contiene"), ("apio", "contiene")))

    assert respuesta.status_code == 200, respuesta.text
    detalle = respuesta.json()
    # lacteos removed, soja changed its type, apio added.
    assert _pares(detalle) == [("apio", "contiene"), ("soja", "contiene")]
    assert detalle["alergenos_revisados"] is True and detalle["alergenos_revisados_at"] is not None
    assert _obtener(client, ana, insumo) == detalle
    assert _total(db_session, InsumoAlergeno) == 2
    assert _con_filas_sin_revisar(db_session) == []


def test_el_put_responde_con_el_insumo_completo(client, ana, insumo, catalogo) -> None:
    antes = _obtener(client, ana, insumo)

    respuesta = _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))

    assert respuesta.status_code == 200
    assert set(respuesta.json()) == set(antes)
    assert respuesta.json()["ingrediente"] == antes["ingrediente"]


def test_el_put_con_lista_vacia_quita_todo_y_deja_revisado_sin_alergenos(client, db_session, ana, insumo, catalogo) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas")))

    respuesta = _put(client, ana, insumo, [])

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["alergenos_declarados"] == []
    assert respuesta.json()["alergenos_revisados"] is True
    assert _total(db_session, InsumoAlergeno) == 0


def test_el_put_con_lista_vacia_sobre_un_insumo_sin_revisar_lo_marca_revisado(client, ana, insumo) -> None:
    assert _obtener(client, ana, insumo)["alergenos_revisados"] is False

    respuesta = _put(client, ana, insumo, [])

    assert respuesta.status_code == 200
    assert respuesta.json()["alergenos_revisados"] is True
    assert respuesta.json()["alergenos_declarados"] == []


def test_el_put_es_idempotente_y_solo_renueva_la_fecha(client, db_session, ana, insumo, catalogo) -> None:
    lista = _lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas"))
    _put(client, ana, insumo, lista)
    _retroceder(db_session, insumo)
    antes = _obtener(client, ana, insumo)
    assert _fecha(antes) == SIN_ZONA

    repetido = _put(client, ana, insumo, lista)

    assert repetido.status_code == 200
    despues = repetido.json()
    assert _fecha(despues) > SIN_ZONA
    assert _pares(despues) == _pares(antes) == [("lacteos", "contiene"), ("soja", "trazas")]
    for campo in ("alergenos_revisados_at", "updated_at"):
        antes.pop(campo)
        despues.pop(campo)
    assert despues == antes
    assert _total(db_session, InsumoAlergeno) == 2


def test_el_put_no_altera_el_resto_del_insumo_ni_los_alergenos_de_otros(client, db_session, ana, leche, catalogo) -> None:
    objetivo = _crear(client, ana, leche, nombre="Objetivo", presentacion="Caja 1 L", habitual=True)["id"]
    otro = _crear(client, ana, leche, nombre="Otro")["id"]
    _put(client, ana, otro, _lista(catalogo, ("lacteos", "contiene")))
    otro_antes = _obtener(client, ana, otro)
    antes = _obtener(client, ana, objetivo)

    _put(client, ana, objetivo, _lista(catalogo, ("lacteos", "trazas")))

    despues = _obtener(client, ana, objetivo)
    for campo in ("updated_at", "alergenos_revisados", "alergenos_revisados_at", "alergenos_declarados"):
        antes.pop(campo)
        despues.pop(campo)
    assert despues == antes
    assert _obtener(client, ana, otro) == otro_antes


def test_el_put_sobre_un_insumo_ajeno_o_inexistente_responde_404_y_no_toca_nada(
    client, db_session, ana, beto, insumo, catalogo
) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))
    _retroceder(db_session, insumo)
    antes = _obtener(client, ana, insumo)

    ajeno = _put(client, beto, insumo, _lista(catalogo, ("soja", "contiene")))
    inexistente = _put(client, ana, 99999, _lista(catalogo, ("soja", "contiene")))

    assert ajeno.status_code == 404 and inexistente.status_code == 404
    assert ajeno.json()["detail"] == "Insumo no encontrado"
    assert _obtener(client, ana, insumo) == antes


def test_el_404_va_antes_que_el_422(client, ana, beto, insumo, catalogo) -> None:
    respuesta = _put(client, beto, insumo, [{"alergeno_id": 99999, "tipo": "contiene"}])

    assert respuesta.status_code == 404


@pytest.mark.parametrize("caso", sorted(CASOS_INVALIDOS))
def test_un_put_invalido_responde_422_y_deja_la_lista_y_la_fecha_como_estaban(
    client, db_session, ana, insumo, catalogo, caso
) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("sesamo", "contiene"), ("apio", "trazas")))
    _retroceder(db_session, insumo)
    antes = _obtener(client, ana, insumo)
    lista, detalle = CASOS_INVALIDOS[caso]

    respuesta = _put(client, ana, insumo, lista(catalogo))

    assert respuesta.status_code == 422
    assert respuesta.json()["detail"] == detalle(catalogo)
    assert _obtener(client, ana, insumo) == antes
    assert _pares(antes) == [("apio", "trazas"), ("sesamo", "contiene")]
    assert _fecha(antes) == SIN_ZONA


@pytest.mark.parametrize(
    "cuerpo",
    [
        {},
        {"alergenos": None},
        {"alergenos": [{"alergeno_id": 1, "tipo": "otro"}]},
        {"alergenos": [], "extra": 1},
        {"alergenos": "lacteos"},
        {"alergenos": [{"alergeno_id": 1, "tipo": "contiene", "extra": 1}]},
    ],
)
def test_un_put_mal_formado_responde_422_y_no_cambia_nada(client, db_session, ana, insumo, catalogo, cuerpo) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))
    antes = _obtener(client, ana, insumo)

    respuesta = client.put(f"/gestion/insumos/{insumo}/alergenos", headers=ana, json=cuerpo)

    assert respuesta.status_code == 422
    assert _obtener(client, ana, insumo) == antes


def test_el_put_sobre_un_insumo_inactivo_se_permite_igual_que_el_patch(client, ana, insumo, catalogo) -> None:
    """The rule of PATCH /gestion/insumos/{id}: a deactivated supply can still be edited (200)."""
    client.delete(f"/gestion/insumos/{insumo}", headers=ana)
    parche = client.patch(f"/gestion/insumos/{insumo}", headers=ana, json={"nombre": "Corregido"})
    assert parche.status_code == 200

    respuesta = _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))

    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["activo"] is False
    assert respuesta.json()["alergenos_revisados"] is True
    assert _pares(respuesta.json()) == [("lacteos", "contiene")]


def test_el_put_requiere_autenticacion(client, insumo) -> None:
    assert client.put(f"/gestion/insumos/{insumo}/alergenos", json={"alergenos": []}).status_code == 401


# --- endpoints individuales: fijan la revisión ---------------------------------------------


def test_asociar_un_alergeno_deja_el_insumo_revisado(client, db_session, ana, insumo, catalogo) -> None:
    assert _obtener(client, ana, insumo)["alergenos_revisados"] is False

    respuesta = client.post(
        f"/gestion/insumos/{insumo}/alergenos", headers=ana, json={"alergeno_id": catalogo["lacteos"], "tipo": "contiene"}
    )

    assert respuesta.status_code == 201
    detalle = _obtener(client, ana, insumo)
    assert detalle["alergenos_revisados"] is True and detalle["alergenos_revisados_at"] is not None
    assert _con_filas_sin_revisar(db_session) == []


def test_asociar_un_alergeno_renueva_la_fecha_de_un_insumo_ya_revisado(client, db_session, ana, insumo, catalogo) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))
    _retroceder(db_session, insumo)

    client.post(f"/gestion/insumos/{insumo}/alergenos", headers=ana, json={"alergeno_id": catalogo["soja"], "tipo": "trazas"})

    assert _fecha(_obtener(client, ana, insumo)) > SIN_ZONA


def test_cambiar_el_tipo_renueva_la_fecha_de_revision(client, db_session, ana, insumo, catalogo) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))
    _retroceder(db_session, insumo)

    respuesta = client.patch(
        f"/gestion/insumos/{insumo}/alergenos/{catalogo['lacteos']}", headers=ana, json={"tipo": "trazas"}
    )

    assert respuesta.status_code == 200
    detalle = _obtener(client, ana, insumo)
    assert detalle["alergenos_revisados"] is True and _fecha(detalle) > SIN_ZONA


def test_cambiar_al_mismo_tipo_no_renueva_la_fecha_de_un_insumo_ya_revisado(client, db_session, ana, insumo, catalogo) -> None:
    """Nothing changes, so nothing is renewed (same contract as updated_at)."""
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene")))
    _retroceder(db_session, insumo)

    respuesta = client.patch(
        f"/gestion/insumos/{insumo}/alergenos/{catalogo['lacteos']}", headers=ana, json={"tipo": "contiene"}
    )

    assert respuesta.status_code == 200
    assert _fecha(_obtener(client, ana, insumo)) == SIN_ZONA


def test_cambiar_al_mismo_tipo_marca_revisado_si_el_insumo_con_filas_no_lo_estaba(
    client, db_session, ana, insumo, catalogo
) -> None:
    """Rows created outside the API (a script) never leave the supply unreviewed once touched."""
    db_session.add(InsumoAlergeno(insumo_id=insumo, alergeno_id=catalogo["lacteos"], tipo="contiene"))
    db_session.commit()
    assert _con_filas_sin_revisar(db_session) == [insumo]

    respuesta = client.patch(
        f"/gestion/insumos/{insumo}/alergenos/{catalogo['lacteos']}", headers=ana, json={"tipo": "contiene"}
    )

    assert respuesta.status_code == 200
    assert _obtener(client, ana, insumo)["alergenos_revisados"] is True
    assert _con_filas_sin_revisar(db_session) == []


def test_quitar_un_alergeno_renueva_la_fecha_de_revision(client, db_session, ana, insumo, catalogo) -> None:
    _put(client, ana, insumo, _lista(catalogo, ("lacteos", "contiene"), ("soja", "trazas")))
    _retroceder(db_session, insumo)

    assert client.delete(f"/gestion/insumos/{insumo}/alergenos/{catalogo['soja']}", headers=ana).status_code == 204

    detalle = _obtener(client, ana, insumo)
    assert _pares(detalle) == [("lacteos", "contiene")]
    assert _fecha(detalle) > SIN_ZONA


def test_borrar_el_ultimo_alergeno_deja_el_insumo_revisado_sin_alergenos(client, db_session, ana, insumo, catalogo) -> None:
    client.post(f"/gestion/insumos/{insumo}/alergenos", headers=ana, json={"alergeno_id": catalogo["lacteos"], "tipo": "contiene"})

    assert client.delete(f"/gestion/insumos/{insumo}/alergenos/{catalogo['lacteos']}", headers=ana).status_code == 204

    detalle = _obtener(client, ana, insumo)
    assert detalle["alergenos_declarados"] == []
    assert detalle["alergenos_revisados"] is True and detalle["alergenos_revisados_at"] is not None
    # Different from a supply nobody reviewed.
    nuevo = _crear(client, ana, detalle["ingrediente_id"], nombre="Nuevo")
    assert _obtener(client, ana, nuevo["id"])["alergenos_revisados"] is False


def test_las_operaciones_individuales_que_fallan_no_marcan_la_revision(
    client, db_session, ana, beto, insumo, catalogo
) -> None:
    client.post(f"/gestion/insumos/{insumo}/alergenos", headers=ana, json={"alergeno_id": catalogo["lacteos"], "tipo": "contiene"})
    _retroceder(db_session, insumo)
    base = f"/gestion/insumos/{insumo}/alergenos"

    resultados = [
        client.post(base, headers=ana, json={"alergeno_id": catalogo["lacteos"], "tipo": "trazas"}),  # repeated
        client.post(base, headers=ana, json={"alergeno_id": 99999, "tipo": "contiene"}),  # unknown
        client.post(base, headers=beto, json={"alergeno_id": catalogo["soja"], "tipo": "contiene"}),  # not theirs
        client.patch(f"{base}/{catalogo['soja']}", headers=ana, json={"tipo": "trazas"}),  # not declared
        client.patch(f"{base}/{catalogo['lacteos']}", headers=beto, json={"tipo": "trazas"}),  # not theirs
        client.delete(f"{base}/{catalogo['soja']}", headers=ana),  # not declared
        client.delete(f"{base}/{catalogo['lacteos']}", headers=beto),  # not theirs
    ]

    assert [r.status_code for r in resultados] == [422, 422, 404, 404, 404, 404, 404]
    assert resultados[0].json()["detail"] == MSG_REPETIDO_INDIVIDUAL
    assert _fecha(_obtener(client, ana, insumo)) == SIN_ZONA


# --- invariante: filas => revisado -----------------------------------------------------------


def test_tras_cualquier_operacion_un_insumo_con_filas_esta_revisado(client, db_session, ana, beto, leche, catalogo) -> None:
    base = "/gestion/insumos"

    def comprobar(paso: str) -> None:
        assert _con_filas_sin_revisar(db_session) == [], paso

    sin_campo = _crear(client, ana, leche, nombre="Sin campo")["id"]
    comprobar("alta sin campo")
    con_lista = client.post(base, headers=ana, json=_payload(leche, nombre="Con lista", alergenos=_lista(catalogo, ("lacteos", "contiene")))).json()["id"]
    comprobar("alta con lista")
    con_vacia = client.post(base, headers=ana, json=_payload(leche, nombre="Con vacía", alergenos=[])).json()["id"]
    comprobar("alta con lista vacía")
    client.post(base, headers=ana, json=_payload(leche, nombre="Inválida", alergenos=[{"alergeno_id": 99999, "tipo": "contiene"}]))
    comprobar("alta inválida")

    client.post(f"{base}/{sin_campo}/alergenos", headers=ana, json={"alergeno_id": catalogo["soja"], "tipo": "contiene"})
    comprobar("POST individual")
    client.post(f"{base}/{sin_campo}/alergenos", headers=ana, json={"alergeno_id": catalogo["soja"], "tipo": "trazas"})
    comprobar("POST individual repetido")
    client.patch(f"{base}/{sin_campo}/alergenos/{catalogo['soja']}", headers=ana, json={"tipo": "trazas"})
    comprobar("PATCH individual")
    client.patch(f"{base}/{sin_campo}/alergenos/{catalogo['soja']}", headers=ana, json={"tipo": "trazas"})
    comprobar("PATCH individual sin cambio")
    _put(client, ana, con_vacia, _lista(catalogo, ("apio", "contiene"), ("sesamo", "trazas")))
    comprobar("PUT con lista")
    _put(client, ana, con_lista, [{"alergeno_id": catalogo["lacteos"], "tipo": "contiene"}, {"alergeno_id": catalogo["lacteos"], "tipo": "trazas"}])
    comprobar("PUT inválido")
    _put(client, beto, con_lista, [])
    comprobar("PUT ajeno")
    client.delete(f"{base}/{con_vacia}/alergenos/{catalogo['apio']}", headers=ana)
    comprobar("DELETE individual")
    client.delete(f"{base}/{con_vacia}/alergenos/{catalogo['sesamo']}", headers=ana)
    comprobar("DELETE del último")
    _put(client, ana, con_lista, [])
    comprobar("PUT vacío")
    client.delete(f"{base}/{sin_campo}", headers=ana)
    comprobar("desactivar")
    client.patch(f"{base}/{sin_campo}", headers=ana, json={"activo": True, "nombre": "Reactivado"})
    comprobar("PATCH del insumo")
    _put(client, ana, sin_campo, _lista(catalogo, ("lacteos", "contiene")))
    comprobar("PUT final")

    estados = {i["id"]: i["alergenos_revisados"] for i in client.get(base, headers=ana).json()}
    assert estados == {sin_campo: True, con_lista: True, con_vacia: True}


# --- la fuente de tiempo -----------------------------------------------------------------


def test_la_fecha_de_revision_usa_la_misma_fuente_de_tiempo_que_updated_at() -> None:
    """Both are SQL now() evaluated by the database, never a clock of the application."""
    insumo = InsumoComercial(productor_id=1, ingrediente_id=1, nombre="x", marca_origen="y")

    InsumoRepository(db=None).marcar_alergenos_revisados(insumo)  # type: ignore[arg-type]

    assert isinstance(insumo.alergenos_revisados_at, FunctionElement)
    assert str(insumo.alergenos_revisados_at) == str(insumo.updated_at) == "now()"
