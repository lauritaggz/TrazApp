"""HU05 elaboración, lote de insumo y uso de insumo model tests (T05-01).

Run on SQLite (schema from metadata.create_all) and on PostgreSQL when
TEST_DATABASE_URL is set. SQLite only enforces foreign keys with PRAGMA foreign_keys=ON,
so the tests that depend on them (composite and RESTRICT / CASCADE) run on PostgreSQL only.
The migration itself is covered in test_migracion_015_elaboraciones.py.
"""

from datetime import date

import pytest
from sqlalchemy import MetaData, create_engine, inspect, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import (
    Elaboracion,
    Ingrediente,
    InsumoComercial,
    LoteInsumo,
    Producto,
    Productor,
    UsoInsumo,
    VersionProducto,
)
from tests.conftest import USE_POSTGRESQL

solo_postgresql = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Las claves foráneas solo se hacen cumplir en PostgreSQL.",
)


def _productor(session: Session, email: str = "elaboraciones@ejemplo.com") -> Productor:
    productor = Productor(nombre="Productora HU05", email=email, password_hash="hash")
    session.add(productor)
    session.commit()
    return productor


def _producto(session: Session, productor: Productor, nombre: str = "Queque de vainilla") -> Producto:
    producto = Producto(productor_id=productor.id, nombre=nombre)
    session.add(producto)
    session.commit()
    return producto


def _version(session: Session, producto: Producto, numero: int = 1) -> VersionProducto:
    version = VersionProducto(producto_id=producto.id, numero_version=numero, descripcion=f"Versión {numero}")
    session.add(version)
    session.commit()
    return version


def _ingrediente(session: Session, productor: Productor, nombre: str = "Leche") -> Ingrediente:
    ingrediente = Ingrediente(productor_id=productor.id, nombre=nombre, activo=True)
    session.add(ingrediente)
    session.commit()
    return ingrediente


def _insumo(
    session: Session,
    productor: Productor,
    ingrediente: Ingrediente,
    nombre: str = "Leche Colun Semidescremada 1 L",
) -> InsumoComercial:
    insumo = InsumoComercial(
        productor_id=productor.id,
        ingrediente_id=ingrediente.id,
        nombre=nombre,
        marca_origen="Colun",
    )
    session.add(insumo)
    session.commit()
    return insumo


def _elaboracion(
    productor: Productor,
    producto: Producto,
    version: VersionProducto,
    codigo: str = "E-001",
    **extra: object,
) -> Elaboracion:
    return Elaboracion(
        productor_id=productor.id,
        producto_id=producto.id,
        version_producto_id=version.id,
        codigo=codigo,
        fecha_elaboracion=date(2026, 10, 6),
        **extra,
    )


@pytest.fixture
def escenario(db_session: Session) -> dict:
    productor = _productor(db_session)
    producto = _producto(db_session, productor)
    version = _version(db_session, producto)
    leche = _ingrediente(db_session, productor)
    insumo = _insumo(db_session, productor, leche)
    return {
        "productor": productor,
        "producto": producto,
        "version": version,
        "ingrediente": leche,
        "insumo": insumo,
    }


def _guardar(session: Session, *objetos: object) -> None:
    session.add_all(objetos)
    session.commit()


def _rechaza(session: Session, *objetos: object) -> None:
    session.add_all(objetos)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


# --- Elaboracion -------------------------------------------------------------------------


def test_registra_una_elaboracion_en_borrador_con_los_datos_obligatorios(
    db_session: Session, escenario: dict
) -> None:
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"])
    _guardar(db_session, elaboracion)
    db_session.refresh(elaboracion)

    assert elaboracion.id is not None
    assert elaboracion.productor_id == escenario["productor"].id
    assert elaboracion.producto_id == escenario["producto"].id
    assert elaboracion.version_producto_id == escenario["version"].id
    assert elaboracion.codigo == "E-001"
    assert elaboracion.fecha_elaboracion == date(2026, 10, 6)
    assert elaboracion.estado == "borrador"
    assert elaboracion.finalizada_at is None
    assert elaboracion.created_at is not None
    assert elaboracion.updated_at is not None
    assert elaboracion.producto is escenario["producto"]
    assert elaboracion.productor is escenario["productor"]
    assert elaboracion.version_producto is escenario["version"]
    assert elaboracion.usos == []


@pytest.mark.parametrize("campo", ["productor_id", "producto_id", "version_producto_id", "codigo", "fecha_elaboracion"])
def test_los_campos_obligatorios_de_la_elaboracion_no_admiten_nulo(
    db_session: Session, escenario: dict, campo: str
) -> None:
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"])
    setattr(elaboracion, campo, None)

    _rechaza(db_session, elaboracion)


@pytest.mark.parametrize("estado", ["", "Borrador", "en_proceso", "cancelada"])
def test_el_estado_solo_admite_borrador_o_finalizada(
    db_session: Session, escenario: dict, estado: str
) -> None:
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"], estado=estado)

    _rechaza(db_session, elaboracion)


def test_finalizada_exige_su_fecha_de_finalizacion_y_borrador_no_la_admite(
    db_session: Session, escenario: dict
) -> None:
    """finalizada_at goes with the state. An elaboración is born as borrador and is finalized later."""
    from datetime import datetime, timezone

    ahora = datetime(2026, 10, 6, 15, 0, tzinfo=timezone.utc)
    productor, producto, version = escenario["productor"], escenario["producto"], escenario["version"]

    # A borrador cannot carry a finalization date.
    _rechaza(db_session, _elaboracion(productor, producto, version, "E-002", finalizada_at=ahora))

    # Becoming finalizada without the date is rejected (CHECK; on PostgreSQL the trigger says it first).
    sin_fecha = _elaboracion(productor, producto, version, "E-001")
    _guardar(db_session, sin_fecha)
    sin_fecha.estado = "finalizada"
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # With the date, and its use already carrying its copy, it is finalized.
    valida = _elaboracion(productor, producto, version, "E-003")
    _guardar(db_session, valida)
    _guardar(
        db_session,
        UsoInsumo(
            elaboracion_id=valida.id,
            ingrediente_id=escenario["ingrediente"].id,
            insumo_id=escenario["insumo"].id,
            sin_lote=True,
            informacion_conservada={"esquema": 1},
        ),
    )
    valida.estado = "finalizada"
    valida.finalizada_at = ahora
    db_session.commit()
    assert db_session.get(Elaboracion, valida.id).estado == "finalizada"


@pytest.mark.parametrize("codigo", ["", "   "])
def test_el_codigo_de_elaboracion_no_puede_estar_vacio(
    db_session: Session, escenario: dict, codigo: str
) -> None:
    _rechaza(
        db_session,
        _elaboracion(escenario["productor"], escenario["producto"], escenario["version"], codigo),
    )


def test_codigo_repetido_en_el_mismo_producto_se_rechaza(db_session: Session, escenario: dict) -> None:
    productor, producto, version = escenario["productor"], escenario["producto"], escenario["version"]
    _guardar(db_session, _elaboracion(productor, producto, version, "E-014"))

    _rechaza(db_session, _elaboracion(productor, producto, version, "E-014"))


@pytest.mark.parametrize("variante", ["elab-a1", "ELAB-A1", "eLAB-a1"])
def test_el_codigo_repetido_se_detecta_sin_distinguir_mayusculas(
    db_session: Session, escenario: dict, variante: str
) -> None:
    productor, producto, version = escenario["productor"], escenario["producto"], escenario["version"]
    _guardar(db_session, _elaboracion(productor, producto, version, "Elab-A1"))

    _rechaza(db_session, _elaboracion(productor, producto, version, variante))


def test_el_mismo_codigo_en_productos_distintos_se_permite(db_session: Session, escenario: dict) -> None:
    productor, producto, version = escenario["productor"], escenario["producto"], escenario["version"]
    otro_producto = _producto(db_session, productor, "Galletas")
    otra_version = _version(db_session, otro_producto)

    _guardar(
        db_session,
        _elaboracion(productor, producto, version, "E-001"),
        _elaboracion(productor, otro_producto, otra_version, "E-001"),
    )

    assert len(db_session.scalars(select(Elaboracion)).all()) == 2


def test_varias_elaboraciones_de_la_misma_version_con_codigos_distintos(
    db_session: Session, escenario: dict
) -> None:
    productor, producto, version = escenario["productor"], escenario["producto"], escenario["version"]

    _guardar(
        db_session,
        _elaboracion(productor, producto, version, "E-001"),
        _elaboracion(productor, producto, version, "E-002"),
    )

    assert len(db_session.scalars(select(Elaboracion)).all()) == 2


def test_actualizar_una_elaboracion_renueva_updated_at(db_session: Session, escenario: dict) -> None:
    from datetime import datetime, timezone

    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"])
    _guardar(db_session, elaboracion)
    antiguo = datetime(2020, 1, 1, tzinfo=timezone.utc)
    db_session.execute(update(Elaboracion).where(Elaboracion.id == elaboracion.id).values(updated_at=antiguo))
    db_session.commit()
    db_session.refresh(elaboracion)

    elaboracion.codigo = "E-002"
    db_session.commit()
    db_session.refresh(elaboracion)

    assert elaboracion.updated_at.replace(tzinfo=timezone.utc) > antiguo


# --- LoteInsumo --------------------------------------------------------------------------


def test_registra_un_lote_con_su_vencimiento_opcional(db_session: Session, escenario: dict) -> None:
    insumo = escenario["insumo"]
    con_vencimiento = LoteInsumo(insumo_id=insumo.id, codigo="X123", fecha_vencimiento=date(2026, 10, 15))
    sin_vencimiento = LoteInsumo(insumo_id=insumo.id, codigo="X124")
    _guardar(db_session, con_vencimiento, sin_vencimiento)
    db_session.refresh(con_vencimiento)
    db_session.refresh(sin_vencimiento)

    assert con_vencimiento.fecha_vencimiento == date(2026, 10, 15)
    assert sin_vencimiento.fecha_vencimiento is None
    assert con_vencimiento.created_at is not None
    assert con_vencimiento.insumo is insumo


@pytest.mark.parametrize("campo", ["insumo_id", "codigo"])
def test_los_campos_obligatorios_del_lote_no_admiten_nulo(
    db_session: Session, escenario: dict, campo: str
) -> None:
    lote = LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123")
    setattr(lote, campo, None)

    _rechaza(db_session, lote)


@pytest.mark.parametrize("codigo", ["", "   "])
def test_el_codigo_del_lote_no_puede_estar_vacio(db_session: Session, escenario: dict, codigo: str) -> None:
    _rechaza(db_session, LoteInsumo(insumo_id=escenario["insumo"].id, codigo=codigo))


@pytest.mark.parametrize("repetido", ["X123", "x123"])
def test_codigo_de_lote_repetido_para_el_mismo_insumo_se_rechaza_sin_distinguir_mayusculas(
    db_session: Session, escenario: dict, repetido: str
) -> None:
    insumo = escenario["insumo"]
    _guardar(db_session, LoteInsumo(insumo_id=insumo.id, codigo="X123"))

    _rechaza(db_session, LoteInsumo(insumo_id=insumo.id, codigo=repetido))


def test_el_mismo_codigo_de_lote_en_insumos_distintos_se_permite(db_session: Session, escenario: dict) -> None:
    productor, leche = escenario["productor"], escenario["ingrediente"]
    otro = _insumo(db_session, productor, leche, "Leche Soprole 1 L")

    _guardar(
        db_session,
        LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123"),
        LoteInsumo(insumo_id=otro.id, codigo="X123"),
    )

    assert len(db_session.scalars(select(LoteInsumo)).all()) == 2


# --- UsoInsumo ---------------------------------------------------------------------------


def _borrador(db_session: Session, escenario: dict, codigo: str = "E-001") -> Elaboracion:
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"], codigo)
    _guardar(db_session, elaboracion)
    return elaboracion


def test_un_uso_pendiente_tiene_valores_por_defecto(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    uso = UsoInsumo(elaboracion_id=elaboracion.id, ingrediente_id=escenario["ingrediente"].id)
    _guardar(db_session, uso)
    db_session.refresh(uso)

    assert uso.insumo_id is None
    assert uso.lote_id is None
    assert uso.sin_lote is False
    assert uso.informacion_conservada is None
    assert uso.created_at is not None
    assert uso.updated_at is not None
    assert uso.elaboracion is elaboracion
    assert uso.ingrediente is escenario["ingrediente"]
    assert elaboracion.usos == [uso]


def test_un_uso_referencia_al_insumo_y_a_su_lote(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    lote = LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123")
    _guardar(db_session, lote)

    uso = UsoInsumo(
        elaboracion_id=elaboracion.id,
        ingrediente_id=escenario["ingrediente"].id,
        insumo_id=escenario["insumo"].id,
        lote_id=lote.id,
    )
    _guardar(db_session, uso)
    db_session.refresh(uso)

    assert uso.insumo is escenario["insumo"]
    assert uso.lote is lote


def test_un_insumo_sin_lote_sigue_siendo_identificable(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    uso = UsoInsumo(
        elaboracion_id=elaboracion.id,
        ingrediente_id=escenario["ingrediente"].id,
        insumo_id=escenario["insumo"].id,
        sin_lote=True,
    )
    _guardar(db_session, uso)
    db_session.refresh(uso)

    assert uso.sin_lote is True
    assert uso.lote_id is None
    assert uso.insumo is escenario["insumo"]


def test_un_uso_por_ingrediente_en_cada_elaboracion(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    otra = _borrador(db_session, escenario, "E-002")
    leche = escenario["ingrediente"]
    _guardar(db_session, UsoInsumo(elaboracion_id=elaboracion.id, ingrediente_id=leche.id))

    _rechaza(db_session, UsoInsumo(elaboracion_id=elaboracion.id, ingrediente_id=leche.id))

    # The same ingredient in another elaboración is fine.
    _guardar(db_session, UsoInsumo(elaboracion_id=otra.id, ingrediente_id=leche.id))
    assert len(db_session.scalars(select(UsoInsumo)).all()) == 2


@pytest.mark.parametrize("campo", ["elaboracion_id", "ingrediente_id"])
def test_los_campos_obligatorios_del_uso_no_admiten_nulo(
    db_session: Session, escenario: dict, campo: str
) -> None:
    elaboracion = _borrador(db_session, escenario)
    uso = UsoInsumo(elaboracion_id=elaboracion.id, ingrediente_id=escenario["ingrediente"].id)
    setattr(uso, campo, None)

    _rechaza(db_session, uso)


def test_sin_lote_excluye_un_lote(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    lote = LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123")
    _guardar(db_session, lote)

    _rechaza(
        db_session,
        UsoInsumo(
            elaboracion_id=elaboracion.id,
            ingrediente_id=escenario["ingrediente"].id,
            insumo_id=escenario["insumo"].id,
            lote_id=lote.id,
            sin_lote=True,
        ),
    )


def test_un_lote_exige_un_insumo(db_session: Session, escenario: dict) -> None:
    """Without this CHECK the composite foreign key is skipped when insumo_id is NULL."""
    elaboracion = _borrador(db_session, escenario)
    lote = LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123")
    _guardar(db_session, lote)

    _rechaza(
        db_session,
        UsoInsumo(
            elaboracion_id=elaboracion.id,
            ingrediente_id=escenario["ingrediente"].id,
            lote_id=lote.id,
        ),
    )


def test_la_informacion_conservada_guarda_un_documento_con_su_estructura(
    db_session: Session, escenario: dict
) -> None:
    elaboracion = _borrador(db_session, escenario)
    conservada = {
        "esquema": 1,
        "ingrediente": {"id": 1, "nombre": "Leche"},
        "insumo": {"id": 10, "nombre": "Leche Colun Semidescremada 1 L", "marca_origen": "Colun"},
        "alergenos": [{"alergeno_id": 7, "codigo": "leche", "tipo": "contiene", "obligatorio_chile": True}],
        "lote": {"id": 5, "codigo": "X123", "fecha_vencimiento": "2026-10-15"},
        "sin_lote": False,
    }
    uso = UsoInsumo(
        elaboracion_id=elaboracion.id,
        ingrediente_id=escenario["ingrediente"].id,
        insumo_id=escenario["insumo"].id,
        sin_lote=True,
        informacion_conservada=conservada,
    )
    _guardar(db_session, uso)
    db_session.expire_all()

    assert db_session.get(UsoInsumo, uso.id).informacion_conservada == conservada


def test_eliminar_una_elaboracion_en_borrador_elimina_sus_usos(db_session: Session, escenario: dict) -> None:
    elaboracion = _borrador(db_session, escenario)
    _guardar(db_session, UsoInsumo(elaboracion_id=elaboracion.id, ingrediente_id=escenario["ingrediente"].id))

    db_session.delete(elaboracion)
    db_session.commit()

    assert db_session.scalars(select(UsoInsumo)).all() == []
    assert db_session.scalars(select(Elaboracion)).all() == []


# --- Claves foráneas (PostgreSQL) --------------------------------------------------------


@solo_postgresql
def test_una_elaboracion_no_puede_usar_la_version_de_otro_producto(
    db_session: Session, escenario: dict
) -> None:
    """Composite foreign key (version_producto_id, producto_id)."""
    productor = escenario["productor"]
    otro_producto = _producto(db_session, productor, "Galletas")
    version_ajena = _version(db_session, otro_producto)

    _rechaza(db_session, _elaboracion(productor, escenario["producto"], version_ajena))


@solo_postgresql
def test_un_uso_no_puede_apuntar_al_lote_de_otro_insumo(db_session: Session, escenario: dict) -> None:
    """Composite foreign key (lote_id, insumo_id)."""
    elaboracion = _borrador(db_session, escenario)
    otro_insumo = _insumo(db_session, escenario["productor"], escenario["ingrediente"], "Leche Soprole 1 L")
    lote_ajeno = LoteInsumo(insumo_id=otro_insumo.id, codigo="X123")
    _guardar(db_session, lote_ajeno)

    _rechaza(
        db_session,
        UsoInsumo(
            elaboracion_id=elaboracion.id,
            ingrediente_id=escenario["ingrediente"].id,
            insumo_id=escenario["insumo"].id,
            lote_id=lote_ajeno.id,
        ),
    )


@solo_postgresql
@pytest.mark.parametrize("campo", ["productor_id", "producto_id"])
def test_las_claves_foraneas_de_la_elaboracion_deben_existir(
    db_session: Session, escenario: dict, campo: str
) -> None:
    elaboracion = _elaboracion(escenario["productor"], escenario["producto"], escenario["version"])
    setattr(elaboracion, campo, 99999)

    _rechaza(db_session, elaboracion)


@solo_postgresql
def test_no_se_puede_eliminar_lo_que_una_elaboracion_o_un_uso_referencian(
    db_session: Session, escenario: dict
) -> None:
    elaboracion = _borrador(db_session, escenario)
    lote = LoteInsumo(insumo_id=escenario["insumo"].id, codigo="X123")
    _guardar(db_session, lote)
    _guardar(
        db_session,
        UsoInsumo(
            elaboracion_id=elaboracion.id,
            ingrediente_id=escenario["ingrediente"].id,
            insumo_id=escenario["insumo"].id,
            lote_id=lote.id,
        ),
    )

    for tabla, id_ in (
        ("versiones_producto", escenario["version"].id),
        ("productos", escenario["producto"].id),
        ("insumos_comerciales", escenario["insumo"].id),
        ("ingredientes", escenario["ingrediente"].id),
        ("lotes_insumo", lote.id),
    ):
        with pytest.raises(IntegrityError):
            db_session.execute(text(f"DELETE FROM {tabla} WHERE id = :id"), {"id": id_})
        db_session.rollback()


# --- Definición en el modelo -------------------------------------------------------------


def test_los_indices_de_unicidad_ignoran_mayusculas_en_el_modelo() -> None:
    elaboraciones = {ix.name: ix for ix in Elaboracion.__table__.indexes}
    lotes = {ix.name: ix for ix in LoteInsumo.__table__.indexes}

    codigo = elaboraciones["uq_elaboraciones_producto_codigo"]
    assert codigo.unique
    assert [str(e) for e in codigo.expressions] == ["elaboraciones.producto_id", "lower(elaboraciones.codigo)"]
    lote = lotes["uq_lotes_insumo_insumo_codigo"]
    assert lote.unique
    assert [str(e) for e in lote.expressions] == ["lotes_insumo.insumo_id", "lower(lotes_insumo.codigo)"]


def test_los_indices_de_consulta_estan_en_el_modelo() -> None:
    elaboraciones = {ix.name: ix for ix in Elaboracion.__table__.indexes}
    usos = {ix.name: ix for ix in UsoInsumo.__table__.indexes}

    assert not elaboraciones["ix_elaboraciones_productor_fecha"].unique
    assert [str(e) for e in elaboraciones["ix_elaboraciones_productor_fecha"].expressions] == [
        "elaboraciones.productor_id",
        "elaboraciones.fecha_elaboracion DESC",
    ]
    assert [c.name for c in elaboraciones["ix_elaboraciones_version_producto_id"].columns] == [
        "version_producto_id"
    ]
    assert [c.name for c in usos["ix_usos_insumo_insumo_id"].columns] == ["insumo_id"]
    assert [c.name for c in usos["ix_usos_insumo_lote_id"].columns] == ["lote_id"]


def test_las_claves_foraneas_compuestas_estan_en_el_modelo() -> None:
    def fks(tabla) -> dict[str, tuple]:
        return {
            fk.name: (
                tuple(c.name for c in fk.columns),
                tuple(e.target_fullname for e in fk.elements),
                fk.ondelete,
            )
            for fk in tabla.foreign_key_constraints
            if fk.name
        }

    assert fks(Elaboracion.__table__)["fk_elaboraciones_version_producto"] == (
        ("version_producto_id", "producto_id"),
        ("versiones_producto.id", "versiones_producto.producto_id"),
        "RESTRICT",
    )
    assert fks(UsoInsumo.__table__)["fk_usos_insumo_lote_del_insumo"] == (
        ("lote_id", "insumo_id"),
        ("lotes_insumo.id", "lotes_insumo.insumo_id"),
        "RESTRICT",
    )
    unicas = {c.name for c in VersionProducto.__table__.constraints if c.name}
    assert "uq_version_producto_id_producto" in unicas
    assert "uq_lotes_insumo_id_insumo" in {c.name for c in LoteInsumo.__table__.constraints if c.name}


def test_sin_los_indices_los_codigos_repetidos_pasan() -> None:
    """Control: las pruebas de unicidad dependen de los índices del modelo.

    Copia las tablas sin índices a una base SQLite aparte: ahí el código repetido y el que
    solo cambia en mayúsculas sí entran, y por eso las pruebas de arriba fallarían si la
    protección saliera del modelo.
    """
    metadata = MetaData()
    for tabla_modelo in Base.metadata.sorted_tables:
        tabla_modelo.to_metadata(metadata)
    for nombre in ("elaboraciones", "lotes_insumo"):
        tabla = metadata.tables[nombre]
        for indice in list(tabla.indexes):
            tabla.indexes.discard(indice)
    engine = create_engine("sqlite://")
    metadata.create_all(engine)
    assert inspect(engine).get_indexes("elaboraciones") == []
    assert inspect(engine).get_indexes("lotes_insumo") == []

    elaboraciones = metadata.tables["elaboraciones"]
    base = {
        "productor_id": 1,
        "producto_id": 1,
        "version_producto_id": 1,
        "fecha_elaboracion": date(2026, 10, 6),
        "estado": "borrador",
    }
    with engine.begin() as conn:
        conn.execute(
            elaboraciones.insert(),
            [{**base, "codigo": "E-014"}, {**base, "codigo": "e-014"}, {**base, "codigo": "E-014"}],
        )
        assert len(conn.execute(elaboraciones.select()).fetchall()) == 3
