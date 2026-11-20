"""Results of the anonymous evaluation for the productor (HU11, T11-03)."""

from app.core.evaluacion_resultados import porcentaje_positivas
from app.repositories.evaluacion_repository import EvaluacionRepository
from app.schemas.evaluacion import EvaluacionElaboracionRead, ResultadosEvaluacionRead
from app.services.producto_service import ProductoNotFoundError


class EvaluacionResultadosService:
    def __init__(self, repository: EvaluacionRepository) -> None:
        self.repository = repository

    def resultados(self, productor_id: int, producto_id: int) -> ResultadosEvaluacionRead:
        """Two queries: ownership of the product, then one grouped read. The product totals are the
        sum of its elaboraciones' (every answer belongs to one), so they need no query of their own."""
        if not self.repository.producto_es_del_productor(producto_id, productor_id):
            # Unknown, deleted and another productor's product look the same (PT11-07).
            raise ProductoNotFoundError("Producto no encontrado")
        filas = self.repository.resultados_por_elaboracion(producto_id)
        total = sum(f[2] for f in filas)
        positivas = sum(f[3] for f in filas)
        return ResultadosEvaluacionRead(
            producto_id=producto_id,
            total=total,
            positivas=positivas,
            porcentaje=porcentaje_positivas(positivas, total),
            por_elaboracion=[
                EvaluacionElaboracionRead(
                    codigo=codigo,
                    fecha=fecha,
                    total=n,
                    positivas=pos,
                    porcentaje=porcentaje_positivas(pos, n),
                )
                for codigo, fecha, n, pos in filas
            ],
        )
