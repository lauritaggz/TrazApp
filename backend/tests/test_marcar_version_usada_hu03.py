"""HU03 / T03-01: marcar_version_usada service method tests."""

import pytest

from app.models import Producto, VersionProducto
from app.repositories.ingrediente_repository import IngredienteRepository
from app.repositories.producto_formulacion_repository import ProductoFormulacionRepository
from app.repositories.producto_repository import ProductoRepository
from app.services.producto_formulacion_service import (
    ProductoFormulacionService,
    VersionProductoNotFoundError,
)


def _service(db_session) -> ProductoFormulacionService:
    return ProductoFormulacionService(
        ProductoFormulacionRepository(db_session),
        ProductoRepository(db_session),
        IngredienteRepository(db_session),
    )


def _create_version(db_session) -> VersionProducto:
    producto = Producto(nombre="Pan amasado", activo=True)
    db_session.add(producto)
    db_session.commit()
    version = VersionProducto(
        producto_id=producto.id,
        numero_version=1,
        descripcion="Versión 1",
        vigente=True,
    )
    db_session.add(version)
    db_session.commit()
    db_session.refresh(version)
    return version


def test_marcar_version_usada(db_session) -> None:
    version = _create_version(db_session)

    marcada = _service(db_session).marcar_version_usada(version.id)
    db_session.commit()
    db_session.expire_all()

    assert marcada.id == version.id
    assert db_session.get(VersionProducto, version.id).usada_en_elaboracion is True


def test_marcar_version_usada_es_idempotente(db_session) -> None:
    version = _create_version(db_session)
    service = _service(db_session)

    service.marcar_version_usada(version.id)
    db_session.commit()
    service.marcar_version_usada(version.id)
    db_session.commit()
    db_session.expire_all()

    assert db_session.get(VersionProducto, version.id).usada_en_elaboracion is True


def test_marcar_version_usada_no_confirma_la_transaccion(db_session) -> None:
    """The caller commits together with the elaboración; a rollback undoes the flag."""
    version = _create_version(db_session)

    _service(db_session).marcar_version_usada(version.id)
    db_session.rollback()
    db_session.expire_all()

    assert db_session.get(VersionProducto, version.id).usada_en_elaboracion is False


def test_marcar_version_usada_inexistente(db_session) -> None:
    with pytest.raises(VersionProductoNotFoundError):
        _service(db_session).marcar_version_usada(999_999)
