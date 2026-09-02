"""Add versioned product formulation table (T02-08).

Revision ID: 010_version_producto_formulacion_t02_08
Revises: 009_seed_alergenos
Create Date: 2026-09-02

Adds versiones_producto_formulacion for declared ingredient lines per
VersionProducto. Existing RT-01 rows are unchanged; formulation is optional.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "010_version_producto_formulacion_t02_08"
down_revision: Union[str, None] = "009_seed_alergenos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "versiones_producto_formulacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version_producto_id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("porcentaje", sa.Numeric(precision=6, scale=3), nullable=True),
        sa.Column("cantidad", sa.Numeric(precision=12, scale=3), nullable=True),
        sa.Column("unidad", sa.String(length=20), nullable=True),
        sa.Column("orden", sa.Integer(), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.Column("ingrediente_nombre", sa.String(length=255), nullable=False),
        sa.Column("ingrediente_codigo_interno", sa.String(length=100), nullable=True),
        sa.Column("ingrediente_tipo", sa.String(length=20), nullable=True),
        sa.ForeignKeyConstraint(
            ["version_producto_id"],
            ["versiones_producto.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ingrediente_id"],
            ["ingredientes.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "version_producto_id",
            "ingrediente_id",
            name="uq_version_producto_formulacion_ingrediente",
        ),
        sa.CheckConstraint(
            "porcentaje IS NULL OR (porcentaje > 0 AND porcentaje <= 100)",
            name="ck_version_producto_formulacion_porcentaje",
        ),
        sa.CheckConstraint(
            "cantidad IS NULL OR cantidad > 0",
            name="ck_version_producto_formulacion_cantidad",
        ),
        sa.CheckConstraint(
            "unidad IS NULL OR unidad IN ('g', 'kg', 'ml', 'L', 'unidad')",
            name="ck_version_producto_formulacion_unidad",
        ),
        sa.CheckConstraint(
            "porcentaje IS NOT NULL OR (cantidad IS NOT NULL AND unidad IS NOT NULL)",
            name="ck_version_producto_formulacion_cuantificacion",
        ),
        sa.CheckConstraint(
            "orden IS NULL OR orden >= 1",
            name="ck_version_producto_formulacion_orden",
        ),
        sa.CheckConstraint(
            "ingrediente_tipo IS NULL OR ingrediente_tipo IN ('simple', 'compuesto')",
            name="ck_version_producto_formulacion_tipo",
        ),
    )


def downgrade() -> None:
    op.drop_table("versiones_producto_formulacion")
