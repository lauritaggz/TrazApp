"""Add the publication state of products and the hidden elaboraciones for HU09 (T09-01).

Revision ID: 018_publicacion_producto_hu09
Revises: 017_alergenos_revisados_ht06
Create Date: 2026-11-06

- productos.publicado (boolean, NOT NULL, default false), productos.id_publico (varchar(32),
  unique, NULL until the first publication) and productos.publicado_en (timestamptz, date of the
  LAST enabling; kept when the publication is disabled).
- CHECK: a published product always has its id_publico.
- elaboraciones_ocultas: one row per finalized elaboración hidden from the public consultation
  (PK = FK to elaboraciones, ON DELETE CASCADE). Hiding never writes the elaboración, so the
  immutability triggers of migration 016 are not touched.
- PostgreSQL only: a NEW trigger rejects hiding an elaboración that is not finalizada.

No backfill: every existing product stays unpublished and without id_publico. No row is
rewritten.

Downgrade refuses, with a clear message and without touching anything, while any product has an
id_publico (a printed QR would stop resolving for good, CA5) or any elaboración is hidden
(it would become visible again). With neither, it only removes what the upgrade added.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from app.db.triggers_elaboracion import DESINSTALAR_OCULTAS, INSTALAR_OCULTAS

revision: str = "018_publicacion_producto_hu09"
down_revision: Union[str, None] = "017_alergenos_revisados_ht06"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _es_postgresql() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    op.add_column(
        "productos",
        sa.Column("publicado", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("productos", sa.Column("id_publico", sa.String(length=32), nullable=True))
    op.add_column(
        "productos",
        sa.Column("publicado_en", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_unique_constraint("uq_producto_id_publico", "productos", ["id_publico"])
    op.create_check_constraint(
        "ck_producto_publicado_requiere_id_publico",
        "productos",
        "NOT publicado OR id_publico IS NOT NULL",
    )
    op.create_table(
        "elaboraciones_ocultas",
        sa.Column("elaboracion_id", sa.Integer(), nullable=False),
        sa.Column(
            "oculta_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("elaboracion_id", name="pk_elaboraciones_ocultas"),
        sa.ForeignKeyConstraint(
            ["elaboracion_id"],
            ["elaboraciones.id"],
            name="fk_elaboraciones_ocultas_elaboracion",
            ondelete="CASCADE",
        ),
    )
    if _es_postgresql():
        for sentencia in INSTALAR_OCULTAS:
            op.execute(sentencia)


def downgrade() -> None:
    bind = op.get_bind()
    con_id = bind.execute(sa.text("SELECT count(*) FROM productos WHERE id_publico IS NOT NULL")).scalar_one()
    ocultas = bind.execute(sa.text("SELECT count(*) FROM elaboraciones_ocultas")).scalar_one()
    if con_id or ocultas:
        raise RuntimeError(
            f"No se puede revertir la migración 018: {con_id} producto(s) tienen identificador "
            f"público (sus códigos QR impresos dejarían de funcionar) y {ocultas} elaboración(es) "
            "están ocultas (volverían a mostrarse). No se modificó nada."
        )
    if _es_postgresql():
        for sentencia in DESINSTALAR_OCULTAS:
            op.execute(sentencia)
    op.drop_table("elaboraciones_ocultas")
    op.drop_constraint("ck_producto_publicado_requiere_id_publico", "productos", type_="check")
    op.drop_constraint("uq_producto_id_publico", "productos", type_="unique")
    op.drop_column("productos", "publicado_en")
    op.drop_column("productos", "id_publico")
    op.drop_column("productos", "publicado")
