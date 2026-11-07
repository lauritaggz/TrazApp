from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from app.core.publicacion import construir_url_publica, generar_id_publico
from app.models import Producto, Productor
from app.services.qr_service import TIPOS_MEDIA, FormatoQr, generar_qr, nombre_archivo_qr
from app.repositories.producto_repository import IdPublicoDuplicadoError, ProductoRepository
from app.schemas.producto import (
    ProductoGestionCreate,
    ProductoGestionRead,
    ProductoGestionUpdate,
    PublicacionRead,
)

if TYPE_CHECKING:
    from app.services.product_image_service import ProductImageService


class ProductoNotFoundError(Exception):
    """Raised when a product is not visible to the authenticated productor."""


REQUISITO_SIN_FORMULACION = "sin_formulacion"
REQUISITO_SIN_ELABORACION_FINALIZADA = "sin_elaboracion_finalizada"
INTENTOS_ID_PUBLICO = 3


class PublicacionRequisitosError(Exception):
    """The product cannot be published yet; `faltantes` lists EVERY missing requirement."""

    def __init__(self, faltantes: list[str]) -> None:
        super().__init__("El producto aún no cumple los requisitos para publicarse.")
        self.faltantes = faltantes


class ProductoNoPublicadoError(Exception):
    """The product is not published right now, so its QR cannot be downloaded."""


@dataclass(frozen=True)
class ArchivoQr:
    contenido: bytes
    media_type: str
    nombre: str


class IdPublicoAgotadoError(Exception):
    """Every attempt to generate a free id_publico collided."""


def leer_productos(
    repository: ProductoRepository, productos: list[Producto]
) -> list[ProductoGestionRead]:
    """The read payload of products, each with `tiene_formulacion` (one query for all of them)."""
    con_formulacion = repository.ids_con_formulacion([producto.id for producto in productos])
    return [
        ProductoGestionRead.model_validate(producto).model_copy(
            update={"tiene_formulacion": producto.id in con_formulacion}
        )
        for producto in productos
    ]


class ProductoService:
    def __init__(
        self,
        repository: ProductoRepository,
        image_service: ProductImageService | None = None,
    ) -> None:
        self.repository = repository
        self.image_service = image_service

    def create(
        self,
        productor: Productor,
        payload: ProductoGestionCreate,
    ) -> ProductoGestionRead:
        data = payload.model_dump()
        categoria_ids = data.pop("categoria_ids", [])
        producto = self.repository.create(
            productor_id=productor.id,
            categoria_ids=categoria_ids,
            **data,
        )
        return leer_productos(self.repository, [producto])[0]

    def list_mine(self, productor: Productor) -> list[ProductoGestionRead]:
        productos = self.repository.list_by_productor(productor.id)
        return leer_productos(self.repository, productos)

    def get_mine(
        self,
        productor: Productor,
        producto_id: int,
    ) -> ProductoGestionRead:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        return leer_productos(self.repository, [producto])[0]

    def update_mine(
        self,
        productor: Productor,
        producto_id: int,
        payload: ProductoGestionUpdate,
    ) -> ProductoGestionRead:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        updates = payload.model_dump(exclude_unset=True)
        if (
            "imagen_url" in updates
            and updates["imagen_url"] is None
            and producto.imagen_url
            and self.image_service is not None
        ):
            self.image_service.delete_stored_image(producto.imagen_url)
        updated = self.repository.update(producto, **updates)
        return leer_productos(self.repository, [updated])[0]

    def delete_mine(self, productor: Productor, producto_id: int) -> None:
        producto = self._get_owned_or_raise(productor.id, producto_id)
        self.repository.deactivate(producto)

    def habilitar_publicacion(self, productor: Productor, producto_id: int) -> PublicacionRead:
        """Enable the publication. Idempotent: an already published product is returned as is.

        Requires a formulation (current version with at least one line) and at least one
        finalized elaboración. The id_publico is generated at the first enabling and never again.
        """
        producto = self._get_owned_or_raise(productor.id, producto_id)
        self.repository.bloquear(producto)
        if producto.publicado:
            return PublicacionRead.from_producto(producto)

        faltantes = self._requisitos_faltantes(producto)
        if faltantes:
            raise PublicacionRequisitosError(faltantes)

        ahora = datetime.now(timezone.utc)
        if producto.id_publico is not None:
            self.repository.publicar(producto, producto.id_publico, ahora)
            return PublicacionRead.from_producto(producto)

        for _ in range(INTENTOS_ID_PUBLICO):
            try:
                self.repository.publicar(producto, generar_id_publico(), ahora)
            except IdPublicoDuplicadoError:
                continue
            return PublicacionRead.from_producto(producto)
        raise IdPublicoAgotadoError("No se pudo generar un identificador público libre.")

    def deshabilitar_publicacion(self, productor: Productor, producto_id: int) -> PublicacionRead:
        """Disable the publication, keeping id_publico and publicado_en. Idempotent."""
        producto = self._get_owned_or_raise(productor.id, producto_id)
        self.repository.bloquear(producto)
        if producto.publicado:
            self.repository.despublicar(producto)
        return PublicacionRead.from_producto(producto)

    def obtener_qr(self, productor: Productor, producto_id: int, formato: FormatoQr) -> ArchivoQr:
        """QR of the public URL, only while the product is published. Generated on demand."""
        producto = self._get_owned_or_raise(productor.id, producto_id)
        if not producto.publicado or producto.id_publico is None:
            raise ProductoNoPublicadoError("El producto no está publicado: habilita la publicación para descargar su QR.")
        url = construir_url_publica(producto.id_publico)  # UrlPublicaNoConfiguradaError -> 500
        return ArchivoQr(
            contenido=generar_qr(url, formato),
            media_type=TIPOS_MEDIA[formato],
            nombre=nombre_archivo_qr(producto.codigo_interno, producto.id, formato),
        )

    def _requisitos_faltantes(self, producto: Producto) -> list[str]:
        faltantes = []
        if producto.id not in self.repository.ids_con_formulacion([producto.id]):
            faltantes.append(REQUISITO_SIN_FORMULACION)
        if not self.repository.tiene_elaboracion_finalizada(producto.id):
            faltantes.append(REQUISITO_SIN_ELABORACION_FINALIZADA)
        return faltantes

    def _get_owned_or_raise(self, productor_id: int, producto_id: int) -> Producto:
        producto = self.repository.get_by_id_and_productor(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")
        return producto
