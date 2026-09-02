"""Extend ingredientes for HU02: ownership, type, composition, allergens.

Revision ID: 008_extend_ingredientes_hu02
Revises: 007_seed_categorias_producto
Create Date: 2026-09-02

New columns on ingredientes are nullable so RT-01 legacy rows without a Productor
remain valid. Application logic for HU02 will require them on newly managed rows.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "008_extend_ingredientes_hu02"
down_revision: Union[str, None] = "007_seed_categorias_producto"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "alergenos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=50), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo", name="uq_alergeno_codigo"),
        sa.UniqueConstraint("nombre", name="uq_alergeno_nombre"),
    )

    op.add_column(
        "ingredientes",
        sa.Column("productor_id", sa.Integer(), nullable=True),
    )
    op.add_column(
        "ingredientes",
        sa.Column("codigo_interno", sa.String(length=100), nullable=True),
    )
    op.add_column("ingredientes", sa.Column("descripcion", sa.Text(), nullable=True))
    op.add_column(
        "ingredientes",
        sa.Column("tipo", sa.String(length=20), nullable=True),
    )
    op.add_column(
        "ingredientes",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    op.create_foreign_key(
        "fk_ingredientes_productor_id_productores",
        "ingredientes",
        "productores",
        ["productor_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.create_unique_constraint(
        "uq_ingrediente_productor_codigo_interno",
        "ingredientes",
        ["productor_id", "codigo_interno"],
    )
    op.create_check_constraint(
        "ck_ingrediente_tipo",
        "ingredientes",
        "tipo IS NULL OR tipo IN ('simple', 'compuesto')",
    )

    op.create_table(
        "ingredientes_alergenos",
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("alergeno_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["alergeno_id"],
            ["alergenos.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["ingrediente_id"],
            ["ingredientes.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("ingrediente_id", "alergeno_id"),
    )

    op.create_table(
        "ingredientes_composicion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_compuesto_id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_componente_id", sa.Integer(), nullable=False),
        sa.Column("porcentaje", sa.Numeric(precision=6, scale=3), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["ingrediente_compuesto_id"],
            ["ingredientes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["ingrediente_componente_id"],
            ["ingredientes.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "ingrediente_compuesto_id",
            "ingrediente_componente_id",
            name="uq_ingrediente_composicion_par",
        ),
        sa.CheckConstraint(
            "ingrediente_compuesto_id <> ingrediente_componente_id",
            name="ck_ingrediente_composicion_sin_autoreferencia",
        ),
        sa.CheckConstraint(
            "porcentaje > 0 AND porcentaje <= 100",
            name="ck_ingrediente_composicion_porcentaje",
        ),
    )


def downgrade() -> None:
    op.drop_table("ingredientes_composicion")
    op.drop_table("ingredientes_alergenos")
    op.drop_constraint("ck_ingrediente_tipo", "ingredientes", type_="check")
    op.drop_constraint(
        "uq_ingrediente_productor_codigo_interno",
        "ingredientes",
        type_="unique",
    )
    op.drop_constraint(
        "fk_ingredientes_productor_id_productores",
        "ingredientes",
        type_="foreignkey",
    )
    op.drop_column("ingredientes", "created_at")
    op.drop_column("ingredientes", "tipo")
    op.drop_column("ingredientes", "descripcion")
    op.drop_column("ingredientes", "codigo_interno")
    op.drop_column("ingredientes", "productor_id")
    op.drop_table("alergenos")
