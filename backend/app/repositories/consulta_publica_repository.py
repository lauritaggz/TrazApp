"""Reads for the public consultation (HU10).

Each method selects only the columns the public response can use, so nothing internal (email,
costs, ids of other tables) is even loaded. Four queries at most per request, whatever the number
of supplies or elaboraciones.
"""

from typing import Any

from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.models import Elaboracion, Producto, Productor, UsoInsumo
from app.models.categoria import Categoria, productos_categorias
from app.models.elaboracion import ElaboracionOculta


class ConsultaPublicaRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_producto_por_id_publico(self, id_publico: str) -> Any | None:
        """The product row (whatever its state: the service decides availability) or None."""
        stmt = (
            select(
                Producto.id,
                Producto.id_publico,
                Producto.publicado,
                Producto.activo,
                Producto.nombre,
                Producto.contenido_neto,
                Producto.unidad_medida,
                Producto.presentacion,
                Producto.imagen_url,
                Productor.nombre_negocio,
            )
            .outerjoin(Productor, Productor.id == Producto.productor_id)
            .where(Producto.id_publico == id_publico)
        )
        return self.db.execute(stmt).first()

    def nombres_categorias(self, producto_id: int) -> list[str]:
        stmt = (
            select(Categoria.nombre)
            .join(productos_categorias, productos_categorias.c.categoria_id == Categoria.id)
            .where(productos_categorias.c.producto_id == producto_id)
            .order_by(Categoria.nombre)
        )
        return list(self.db.scalars(stmt))

    def filas_elaboraciones(self, producto_id: int) -> list[Any]:
        """Every elaboración of the product in "Predeterminada" order, with its hidden flag.

        Borradores come too: visibility is decided by the HU09 rule in the service, not here.
        """
        stmt = (
            select(
                Elaboracion.id,
                Elaboracion.codigo,
                Elaboracion.fecha_elaboracion,
                Elaboracion.estado,
                exists().where(ElaboracionOculta.elaboracion_id == Elaboracion.id).correlate(Elaboracion).label("oculta"),
            )
            .where(Elaboracion.producto_id == producto_id)
            .order_by(Elaboracion.fecha_elaboracion.desc(), Elaboracion.id.desc())
        )
        return list(self.db.execute(stmt).all())

    def copias_conservadas(self, elaboracion_id: int) -> list[tuple[int, Any]]:
        """(use id, conserved copy) of an elaboración, in formulation order (the uses are created in it)."""
        stmt = (
            select(UsoInsumo.id, UsoInsumo.informacion_conservada)
            .where(UsoInsumo.elaboracion_id == elaboracion_id)
            .order_by(UsoInsumo.id)
        )
        return [(fila[0], fila[1]) for fila in self.db.execute(stmt)]
