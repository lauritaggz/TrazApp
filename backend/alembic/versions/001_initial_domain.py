"""Initial domain schema for RT-01 traceability prototype.

Revision ID: 001_initial_domain
Revises:
Create Date: 2026-08-22
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial_domain"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "productos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "ingredientes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "versiones_producto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("numero_version", sa.Integer(), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("vigente", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("producto_id", "numero_version", name="uq_version_producto_numero"),
    )
    op.create_table(
        "versiones_ingrediente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("numero_version", sa.Integer(), nullable=False),
        sa.Column("composicion_declarada", sa.Text(), nullable=False),
        sa.Column("alergenos_declarados", sa.Text(), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("vigente", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["ingrediente_id"], ["ingredientes.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ingrediente_id", "numero_version", name="uq_version_ingrediente_numero"),
    )
    op.create_table(
        "lotes_ingrediente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo_lote", sa.String(length=100), nullable=False),
        sa.Column("version_ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("fecha_recepcion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["version_ingrediente_id"], ["versiones_ingrediente.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo_lote"),
    )
    op.create_table(
        "lotes_producto",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo_lote", sa.String(length=100), nullable=False),
        sa.Column("version_producto_id", sa.Integer(), nullable=False),
        sa.Column("fecha_elaboracion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["version_producto_id"], ["versiones_producto.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo_lote"),
    )
    op.create_table(
        "usos_lote_ingrediente",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("lote_producto_id", sa.Integer(), nullable=False),
        sa.Column("lote_ingrediente_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["lote_producto_id"], ["lotes_producto.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["lote_ingrediente_id"], ["lotes_ingrediente.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "lote_producto_id",
            "lote_ingrediente_id",
            name="uq_uso_lote_producto_ingrediente",
        ),
    )


def downgrade() -> None:
    op.drop_table("usos_lote_ingrediente")
    op.drop_table("lotes_producto")
    op.drop_table("lotes_ingrediente")
    op.drop_table("versiones_ingrediente")
    op.drop_table("versiones_producto")
    op.drop_table("ingredientes")
    op.drop_table("productos")
