import uuid
from pathlib import Path

from fastapi import UploadFile

from app.models import Producto, Productor
from app.repositories.producto_repository import ProductoRepository
from app.schemas.producto import ProductoGestionRead
from app.services.producto_service import ProductoNotFoundError

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
PRODUCTS_UPLOAD_PREFIX = "/uploads/products/"


class InvalidProductImageError(Exception):
    """Raised when an uploaded image fails validation."""


class ProductImageService:
    def __init__(
        self,
        repository: ProductoRepository,
        uploads_products_dir: Path,
    ) -> None:
        self.repository = repository
        self.uploads_products_dir = uploads_products_dir
        self.uploads_products_dir.mkdir(parents=True, exist_ok=True)

    async def upload_product_image(
        self,
        productor: Productor,
        producto_id: int,
        upload: UploadFile,
    ) -> ProductoGestionRead:
        producto = self.repository.get_by_id_and_productor(producto_id, productor.id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")

        content = await upload.read()
        self._validate_image(upload.filename, upload.content_type, len(content))

        extension = self._resolve_extension(upload.filename, upload.content_type)
        filename = f"p{producto_id}_{uuid.uuid4().hex}{extension}"
        destination = self.uploads_products_dir / filename

        self._delete_stored_image(producto.imagen_url)
        destination.write_bytes(content)

        imagen_url = f"{PRODUCTS_UPLOAD_PREFIX}{filename}"
        updated = self.repository.update(producto, imagen_url=imagen_url)
        return ProductoGestionRead.model_validate(updated)

    def _validate_image(
        self,
        filename: str | None,
        content_type: str | None,
        size: int,
    ) -> None:
        if size == 0:
            raise InvalidProductImageError("La imagen no puede estar vacía.")
        if size > MAX_IMAGE_SIZE_BYTES:
            raise InvalidProductImageError("La imagen no puede superar 5 MB.")

        extension = self._extension_from_filename(filename)
        if extension not in ALLOWED_EXTENSIONS:
            raise InvalidProductImageError(
                "Formato no permitido. Usa JPG, JPEG, PNG o WEBP."
            )

        if content_type and content_type not in ALLOWED_CONTENT_TYPES:
            raise InvalidProductImageError(
                "Formato no permitido. Usa JPG, JPEG, PNG o WEBP."
            )

    def _resolve_extension(
        self,
        filename: str | None,
        content_type: str | None,
    ) -> str:
        extension = self._extension_from_filename(filename)
        if extension in ALLOWED_EXTENSIONS:
            return extension

        if content_type == "image/jpeg":
            return ".jpg"
        if content_type == "image/png":
            return ".png"
        if content_type == "image/webp":
            return ".webp"

        raise InvalidProductImageError(
            "Formato no permitido. Usa JPG, JPEG, PNG o WEBP."
        )

    @staticmethod
    def _extension_from_filename(filename: str | None) -> str:
        if not filename:
            return ""
        return Path(filename).suffix.lower()

    def delete_stored_image(self, imagen_url: str | None) -> None:
        self._delete_stored_image(imagen_url)

    def _delete_stored_image(self, imagen_url: str | None) -> None:
        if not imagen_url or not imagen_url.startswith(PRODUCTS_UPLOAD_PREFIX):
            return

        filename = Path(imagen_url).name
        if not filename or filename in {".", ".."}:
            return

        candidate = (self.uploads_products_dir / filename).resolve()
        products_root = self.uploads_products_dir.resolve()
        try:
            candidate.relative_to(products_root)
        except ValueError:
            return
        if candidate.exists() and candidate.is_file():
            candidate.unlink()
