"""Add the anonymous usefulness evaluations for HU11 (T11-01).

Revision ID: 020_evaluacion_utilidad_hu11
Revises: 019_costos_producto_hu14
Create Date: 2026-11-19

- evaluaciones_utilidad: id, producto_id (FK RESTRICT), elaboracion_id (FK RESTRICT), util (boolean),
  nonce_hash (varchar(64), UNIQUE: one answer per consultation token) and fecha (date, no time).
  No IP, user agent, session, productor or full token: the answer is anonymous (CA6).
- CHECK: nonce_hash is exactly 64 characters (a SHA-256 in hex), so a nonce or token cannot be stored.
- Index on (producto_id, elaboracion_id) for the productor's results.

No backfill: nothing existing is rewritten.

Downgrade refuses, with a clear message and without touching anything, while any evaluation exists:
the answers cannot be rebuilt. With none, it only removes what the upgrade added.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "020_evaluacion_utilidad_hu11"
down_revision: Union[str, None] = "019_costos_producto_hu14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evaluaciones_utilidad",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("elaboracion_id", sa.Integer(), nullable=False),
        sa.Column("util", sa.Boolean(), nullable=False),
        sa.Column("nonce_hash", sa.String(length=64), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_evaluaciones_utilidad"),
        sa.ForeignKeyConstraint(
            ["producto_id"], ["productos.id"], name="fk_evaluaciones_utilidad_producto", ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["elaboracion_id"],
            ["elaboraciones.id"],
            name="fk_evaluaciones_utilidad_elaboracion",
            ondelete="RESTRICT",
        ),
        sa.UniqueConstraint("nonce_hash", name="uq_evaluaciones_utilidad_nonce_hash"),
        sa.CheckConstraint("length(nonce_hash) = 64", name="ck_evaluaciones_utilidad_nonce_hash"),
    )
    op.create_index(
        "ix_evaluaciones_utilidad_producto_elaboracion",
        "evaluaciones_utilidad",
        ["producto_id", "elaboracion_id"],
    )


def downgrade() -> None:
    cantidad = op.get_bind().execute(sa.text("SELECT count(*) FROM evaluaciones_utilidad")).scalar_one()
    if cantidad:
        raise RuntimeError(
            f"No se puede revertir la migración 020: hay {cantidad} evaluación(es) anónimas que no se "
            "pueden reconstruir. No se modificó nada."
        )
    op.drop_index("ix_evaluaciones_utilidad_producto_elaboracion", table_name="evaluaciones_utilidad")
    op.drop_table("evaluaciones_utilidad")
