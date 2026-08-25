"""Extend productos for HU01 product ownership and general data.

Revision ID: 004_extend_productos_hu01
Revises: 003_add_nombre_negocio
Create Date: 2026-08-25

New columns are nullable so RT-01 legacy products without a Productor remain valid.
Application logic for HU01 will require the fields on newly created products.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "004_extend_productos_hu01"
down_revision: Union[str, None] = "003_add_nombre_negocio"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("productos", sa.Column("productor_id", sa.Integer(), nullable=True))
    op.add_column(
        "productos",
        sa.Column("codigo_interno", sa.String(length=100), nullable=True),
    )
    op.add_column("productos", sa.Column("descripcion", sa.Text(), nullable=True))
    op.add_column(
        "productos",
        sa.Column("contenido_neto", sa.Numeric(precision=12, scale=3), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column("unidad_medida", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column("presentacion", sa.String(length=255), nullable=True),
    )
    op.create_foreign_key(
        "fk_productos_productor_id_productores",
        "productos",
        "productores",
        ["productor_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_producto_productor_codigo_interno",
        "productos",
        ["productor_id", "codigo_interno"],
    )
    op.create_check_constraint(
        "ck_producto_unidad_medida",
        "productos",
        "unidad_medida IS NULL OR unidad_medida IN ('g', 'kg', 'ml', 'L', 'unidad')",
    )
    op.create_check_constraint(
        "ck_producto_contenido_neto_positivo",
        "productos",
        "contenido_neto IS NULL OR contenido_neto > 0",
    )


def downgrade() -> None:
    op.drop_constraint("ck_producto_contenido_neto_positivo", "productos", type_="check")
    op.drop_constraint("ck_producto_unidad_medida", "productos", type_="check")
    op.drop_constraint("uq_producto_productor_codigo_interno", "productos", type_="unique")
    op.drop_constraint("fk_productos_productor_id_productores", "productos", type_="foreignkey")
    op.drop_column("productos", "presentacion")
    op.drop_column("productos", "unidad_medida")
    op.drop_column("productos", "contenido_neto")
    op.drop_column("productos", "descripcion")
    op.drop_column("productos", "codigo_interno")
    op.drop_column("productos", "productor_id")
