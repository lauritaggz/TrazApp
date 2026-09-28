"""Adapt T02-08 versioned formulation as the product formulation (HU03).

Revision ID: 012_formulacion_versionada_hu03
Revises: 011_alergenos_obligatorio_chile
Create Date: 2026-09-28

- Adds versiones_producto.usada_en_elaboracion. A used version is never
  modified in place; HU03 creates a new version instead. Versions that already
  have lotes_producto are backfilled as used.
- Formulation lines no longer require a quantification: porcentaje stays as an
  optional column (existing data is kept) and cantidad/unidad become optional
  but must be informed together.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "012_formulacion_versionada_hu03"
down_revision: Union[str, None] = "011_alergenos_obligatorio_chile"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "versiones_producto_formulacion"
CK_CUANTIFICACION = "ck_version_producto_formulacion_cuantificacion"
CK_CUANTIFICACION_SQL = (
    "porcentaje IS NOT NULL OR (cantidad IS NOT NULL AND unidad IS NOT NULL)"
)
CK_CANTIDAD_UNIDAD = "ck_version_producto_formulacion_cantidad_unidad"
CK_CANTIDAD_UNIDAD_SQL = "(cantidad IS NULL) = (unidad IS NULL)"


def upgrade() -> None:
    op.add_column(
        "versiones_producto",
        sa.Column(
            "usada_en_elaboracion",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.execute(
        """
        UPDATE versiones_producto
        SET usada_en_elaboracion = true
        WHERE EXISTS (
            SELECT 1
            FROM lotes_producto
            WHERE lotes_producto.version_producto_id = versiones_producto.id
        )
        """
    )

    op.drop_constraint(CK_CUANTIFICACION, TABLE, type_="check")
    op.create_check_constraint(CK_CANTIDAD_UNIDAD, TABLE, CK_CANTIDAD_UNIDAD_SQL)


def downgrade() -> None:
    bind = op.get_bind()
    sin_cuantificacion = bind.execute(
        sa.text(f"SELECT count(*) FROM {TABLE} WHERE NOT ({CK_CUANTIFICACION_SQL})")
    ).scalar_one()
    if sin_cuantificacion:
        raise RuntimeError(
            f"No se puede revertir 012_formulacion_versionada_hu03: hay "
            f"{sin_cuantificacion} línea(s) de formulación sin porcentaje ni "
            f"cantidad con unidad, que violarían {CK_CUANTIFICACION}. "
            f"Complete o elimine esas líneas antes de revertir."
        )

    op.drop_constraint(CK_CANTIDAD_UNIDAD, TABLE, type_="check")
    op.create_check_constraint(CK_CUANTIFICACION, TABLE, CK_CUANTIFICACION_SQL)
    op.drop_column("versiones_producto", "usada_en_elaboracion")
