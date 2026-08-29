from app.repositories.categoria_repository import CategoriaRepository
from app.schemas.producto import CategoriaRead


class CategoriaService:
    def __init__(self, repository: CategoriaRepository) -> None:
        self.repository = repository

    def list_available(self) -> list[CategoriaRead]:
        categorias = self.repository.list_all()
        return [CategoriaRead.model_validate(categoria) for categoria in categorias]
