"""Add elaboraciones, supply lots and supply uses for HU05 (T05-01).

Revision ID: 015_elaboraciones_hu05
Revises: 014_insumos_alergenos
Create Date: 2026-10-06

- Adds UNIQUE (id, producto_id) to versiones_producto. It is redundant for uniqueness
  (id is already the primary key) but it is the target of the composite foreign key of
  elaboraciones: an elaboración can only reference a version of its own product. Purely
  additive: it does not touch rows.
- Creates elaboraciones: one production of a product version. Estado is 'borrador' or
  'finalizada' (CHECK), and finalizada_at is set exactly when it is finalizada (CHECK).
  The code is unique per product ignoring case (unique index on producto_id, lower(codigo)).
- Creates lotes_insumo: lots of a commercial supply. The code is unique per supply
  ignoring case. UNIQUE (id, insumo_id) is the target of the composite foreign key of
  usos_insumo, so a use can only point to a lot of its own supply.
- Creates usos_insumo: one row per ingredient of the elaboración. insumo_id is NULL while
  the ingredient is pending. Constraints: one use per (elaboración, ingredient); a lot
  requires a supply (the composite foreign key is not checked when a column is NULL, so a
  CHECK covers it); "sin_lote" excludes a lot. informacion_conservada (JSONB) is filled
  when the elaboración is finalized. Deleting an elaboración removes its uses (CASCADE);
  every other foreign key is RESTRICT.
- The triggers that block changes to finalized elaboraciones are NOT part of this
  migration: they come in 016 (T05-05).

The tables are new, so downgrade drops them, but it refuses to run if they hold any row:
elaboraciones are the traceability record and must never be lost silently. Remove the
rows deliberately (and knowingly) before reverting.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "015_elaboraciones_hu05"
down_revision: Union[str, None] = "014_insumos_alergenos"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ELABORACIONES = "elaboraciones"
LOTES = "lotes_insumo"
USOS = "usos_insumo"
UQ_VERSION_PRODUCTO = "uq_version_producto_id_producto"


def upgrade() -> None:
    op.create_unique_constraint(
        UQ_VERSION_PRODUCTO,
        "versiones_producto",
        ["id", "producto_id"],
    )

    op.create_table(
        ELABORACIONES,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("productor_id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("version_producto_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=100), nullable=False),
        sa.Column("fecha_elaboracion", sa.Date(), nullable=False),
        sa.Column(
            "estado",
            sa.String(length=20),
            server_default="borrador",
            nullable=False,
        ),
        sa.Column("finalizada_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["version_producto_id", "producto_id"],
            ["versiones_producto.id", "versiones_producto.producto_id"],
            name="fk_elaboraciones_version_producto",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "estado IN ('borrador', 'finalizada')",
            name="ck_elaboraciones_estado",
        ),
        sa.CheckConstraint(
            "(estado = 'finalizada') = (finalizada_at IS NOT NULL)",
            name="ck_elaboraciones_finalizada_at",
        ),
        sa.CheckConstraint(
            "length(trim(codigo)) > 0",
            name="ck_elaboraciones_codigo_no_vacio",
        ),
        sa.ForeignKeyConstraint(["productor_id"], ["productores.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_elaboraciones_producto_codigo",
        ELABORACIONES,
        ["producto_id", sa.text("lower(codigo)")],
        unique=True,
    )
    op.create_index(
        "ix_elaboraciones_productor_fecha",
        ELABORACIONES,
        ["productor_id", sa.text("fecha_elaboracion DESC")],
    )
    op.create_index(
        "ix_elaboraciones_version_producto_id",
        ELABORACIONES,
        ["version_producto_id"],
    )

    op.create_table(
        LOTES,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("insumo_id", sa.Integer(), nullable=False),
        sa.Column("codigo", sa.String(length=100), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("id", "insumo_id", name="uq_lotes_insumo_id_insumo"),
        sa.CheckConstraint(
            "length(trim(codigo)) > 0",
            name="ck_lotes_insumo_codigo_no_vacio",
        ),
        sa.ForeignKeyConstraint(["insumo_id"], ["insumos_comerciales.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "uq_lotes_insumo_insumo_codigo",
        LOTES,
        ["insumo_id", sa.text("lower(codigo)")],
        unique=True,
    )

    op.create_table(
        USOS,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("elaboracion_id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("insumo_id", sa.Integer(), nullable=True),
        sa.Column("lote_id", sa.Integer(), nullable=True),
        sa.Column("sin_lote", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column(
            "informacion_conservada",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "elaboracion_id",
            "ingrediente_id",
            name="uq_usos_insumo_elaboracion_ingrediente",
        ),
        sa.ForeignKeyConstraint(
            ["lote_id", "insumo_id"],
            ["lotes_insumo.id", "lotes_insumo.insumo_id"],
            name="fk_usos_insumo_lote_del_insumo",
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "lote_id IS NULL OR insumo_id IS NOT NULL",
            name="ck_usos_insumo_lote_requiere_insumo",
        ),
        sa.CheckConstraint(
            "NOT (sin_lote AND lote_id IS NOT NULL)",
            name="ck_usos_insumo_sin_lote_excluye_lote",
        ),
        sa.ForeignKeyConstraint(["elaboracion_id"], ["elaboraciones.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["ingrediente_id"], ["ingredientes.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["insumo_id"], ["insumos_comerciales.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_usos_insumo_insumo_id", USOS, ["insumo_id"])
    op.create_index("ix_usos_insumo_lote_id", USOS, ["lote_id"])


def downgrade() -> None:
    conn = op.get_bind()
    filas = {
        tabla: conn.execute(sa.text(f"SELECT count(*) FROM {tabla}")).scalar_one()
        for tabla in (ELABORACIONES, LOTES, USOS)
    }
    if any(filas.values()):
        detalle = ", ".join(f"{tabla}: {total}" for tabla, total in filas.items() if total)
        raise RuntimeError(
            "No se puede revertir la migración 015: hay datos de elaboraciones "
            f"({detalle}) y se perderían. Elimínelos de forma deliberada antes de revertir."
        )

    op.drop_index("ix_usos_insumo_lote_id", table_name=USOS)
    op.drop_index("ix_usos_insumo_insumo_id", table_name=USOS)
    op.drop_table(USOS)
    op.drop_index("uq_lotes_insumo_insumo_codigo", table_name=LOTES)
    op.drop_table(LOTES)
    op.drop_index("ix_elaboraciones_version_producto_id", table_name=ELABORACIONES)
    op.drop_index("ix_elaboraciones_productor_fecha", table_name=ELABORACIONES)
    op.drop_index("uq_elaboraciones_producto_codigo", table_name=ELABORACIONES)
    op.drop_table(ELABORACIONES)
    op.drop_constraint(UQ_VERSION_PRODUCTO, "versiones_producto", type_="unique")
