"""Extend productos for T01-10: categories, pricing, image URL.

Revision ID: 006_extend_productos_t01_10
Revises: 005_add_created_at_productos
Create Date: 2026-08-28

Adds Categoria entity, N:M association, and nullable commercial fields on productos.
No seed data for existing products or categories.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "006_extend_productos_t01_10"
down_revision: Union[str, None] = "005_add_created_at_productos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "categorias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="uq_categoria_nombre"),
    )

    op.add_column(
        "productos",
        sa.Column("costo_produccion", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column("precio_venta", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "productos",
        sa.Column("imagen_url", sa.String(length=2048), nullable=True),
    )

    op.create_check_constraint(
        "ck_producto_costo_produccion_no_negativo",
        "productos",
        "costo_produccion IS NULL OR costo_produccion >= 0",
    )
    op.create_check_constraint(
        "ck_producto_precio_venta_no_negativo",
        "productos",
        "precio_venta IS NULL OR precio_venta >= 0",
    )

    op.create_table(
        "productos_categorias",
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("categoria_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["categoria_id"],
            ["categorias.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["producto_id"],
            ["productos.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("producto_id", "categoria_id"),
    )


def downgrade() -> None:
    op.drop_table("productos_categorias")
    op.drop_constraint(
        "ck_producto_precio_venta_no_negativo",
        "productos",
        type_="check",
    )
    op.drop_constraint(
        "ck_producto_costo_produccion_no_negativo",
        "productos",
        type_="check",
    )
    op.drop_column("productos", "imagen_url")
    op.drop_column("productos", "precio_venta")
    op.drop_column("productos", "costo_produccion")
    op.drop_table("categorias")
