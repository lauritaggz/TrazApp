"""HU02 ingredient model and migration smoke tests (T02-01)."""

from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import (
    Alergeno,
    ComposicionIngrediente,
    Ingrediente,
    Productor,
    VersionIngrediente,
)


def _create_productor(session, email: str = "prod@ejemplo.com") -> Productor:
    productor = Productor(
        nombre="Productor HU02",
        email=email,
        password_hash="hash",
        activo=True,
    )
    session.add(productor)
    session.commit()
    session.refresh(productor)
    return productor


def test_ingrediente_hu02_persiste_campos_gestion(db_session) -> None:
    productor = _create_productor(db_session)

    ingrediente = Ingrediente(
        productor_id=productor.id,
        codigo_interno="HAR-001",
        nombre="Harina de trigo",
        descripcion="Harina integral",
        tipo="simple",
        activo=True,
    )
    db_session.add(ingrediente)
    db_session.commit()
    db_session.refresh(ingrediente)

    assert ingrediente.id is not None
    assert ingrediente.productor_id == productor.id
    assert ingrediente.codigo_interno == "HAR-001"
    assert ingrediente.tipo == "simple"
    assert ingrediente.created_at is not None


def test_ingrediente_legacy_rt01_sin_productor_sigue_siendo_valido(db_session) -> None:
    legacy = Ingrediente(nombre="Chocolate", activo=True)
    db_session.add(legacy)
    db_session.commit()
    db_session.refresh(legacy)

    version = VersionIngrediente(
        ingrediente_id=legacy.id,
        numero_version=1,
        composicion_declarada="Cacao, azúcar",
        alergenos_declarados="Leche",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()

    assert legacy.productor_id is None
    assert legacy.codigo_interno is None
    assert legacy.tipo is None
    assert len(legacy.versiones) == 1


def test_codigo_interno_unico_por_productor(db_session) -> None:
    productor = _create_productor(db_session, email="dup@ejemplo.com")

    first = Ingrediente(
        productor_id=productor.id,
        codigo_interno="AZU-001",
        nombre="Azúcar",
        tipo="simple",
        activo=True,
    )
    db_session.add(first)
    db_session.commit()

    duplicate = Ingrediente(
        productor_id=productor.id,
        codigo_interno="AZU-001",
        nombre="Azúcar refinada",
        tipo="simple",
        activo=True,
    )
    db_session.add(duplicate)

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_composicion_ingrediente_compuesto(db_session) -> None:
    productor = _create_productor(db_session, email="comp@ejemplo.com")

    harina = Ingrediente(
        productor_id=productor.id,
        codigo_interno="HAR-001",
        nombre="Harina",
        tipo="simple",
        activo=True,
    )
    agua = Ingrediente(
        productor_id=productor.id,
        codigo_interno="AGU-001",
        nombre="Agua",
        tipo="simple",
        activo=True,
    )
    masa = Ingrediente(
        productor_id=productor.id,
        codigo_interno="MAS-001",
        nombre="Masa base",
        tipo="compuesto",
        activo=True,
    )
    db_session.add_all([harina, agua, masa])
    db_session.commit()

    db_session.add_all(
        [
            ComposicionIngrediente(
                ingrediente_compuesto_id=masa.id,
                ingrediente_componente_id=harina.id,
                porcentaje=Decimal("60.000"),
                orden=1,
            ),
            ComposicionIngrediente(
                ingrediente_compuesto_id=masa.id,
                ingrediente_componente_id=agua.id,
                porcentaje=Decimal("40.000"),
                orden=2,
            ),
        ]
    )
    db_session.commit()
    db_session.refresh(masa)

    assert len(masa.componentes) == 2
    assert masa.componentes[0].porcentaje == Decimal("60.000")


def test_composicion_rechaza_autoreferencia(db_session) -> None:
    productor = _create_productor(db_session, email="auto@ejemplo.com")
    ingrediente = Ingrediente(
        productor_id=productor.id,
        codigo_interno="AUT-001",
        nombre="Ingrediente único",
        tipo="compuesto",
        activo=True,
    )
    db_session.add(ingrediente)
    db_session.commit()

    db_session.add(
        ComposicionIngrediente(
            ingrediente_compuesto_id=ingrediente.id,
            ingrediente_componente_id=ingrediente.id,
            porcentaje=Decimal("100.000"),
        )
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_ingrediente_asocia_alergenos_catalogo(db_session) -> None:
    productor = _create_productor(db_session, email="alerg@ejemplo.com")
    gluten = Alergeno(codigo="gluten_test", nombre="Gluten test")
    lacteos = Alergeno(codigo="lacteos_test", nombre="Lácteos test")
    db_session.add_all([gluten, lacteos])
    db_session.commit()

    ingrediente = Ingrediente(
        productor_id=productor.id,
        codigo_interno="GAL-001",
        nombre="Galleta",
        tipo="simple",
        activo=True,
        alergenos=[gluten, lacteos],
    )
    db_session.add(ingrediente)
    db_session.commit()
    db_session.refresh(ingrediente)

    stored = db_session.scalar(
        select(Ingrediente).where(Ingrediente.id == ingrediente.id)
    )
    assert stored is not None
    assert {alergeno.codigo for alergeno in stored.alergenos} == {
        "gluten_test",
        "lacteos_test",
    }
