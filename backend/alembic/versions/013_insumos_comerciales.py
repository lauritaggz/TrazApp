"""Add commercial supplies (insumos comerciales) for HU04 (T04-01).

Revision ID: 013_insumos_comerciales
Revises: 012_formulacion_versionada_hu03
Create Date: 2026-10-05

- Creates insumos_comerciales: the commercial product actually bought and used as
  supply for a generic ingredient (e.g. "Leche Colun Semidescremada 1 L" -> "Leche").
- "ingredientes_declarados" and "advertencias" are plain text columns (what the
  productor sees and edits); "ficha" (JSONB) is reserved for raw data from an
  external source, with "fuente" and "fecha_recuperacion".
- Plain indexes on productor_id and ingrediente_id (the lookups of every query).
- Two partial unique indexes keep the rules in the database:
  * barcode unique per productor, only when it is not null;
  * a single "habitual" supply per ingredient.
- Ownership of the ingredient by the same productor is validated in the service (T04-03).

The table is new, so downgrade just drops it: no earlier data to protect. Rows stored in
it are lost on downgrade by definition of the revert.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "013_insumos_comerciales"
down_revision: Union[str, None] = "012_formulacion_versionada_hu03"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "insumos_comerciales"
IX_PRODUCTOR = "ix_insumos_comerciales_productor_id"
IX_INGREDIENTE = "ix_insumos_comerciales_ingrediente_id"
IX_CODIGO_BARRAS = "uq_insumos_productor_codigo_barras"
IX_HABITUAL = "uq_insumos_habitual_por_ingrediente"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("productor_id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=255), nullable=False),
        sa.Column("marca_origen", sa.String(length=255), nullable=False),
        sa.Column("presentacion", sa.String(length=255), nullable=True),
        sa.Column("codigo_barras", sa.String(length=64), nullable=True),
        sa.Column("ingredientes_declarados", sa.Text(), nullable=True),
        sa.Column("advertencias", sa.Text(), nullable=True),
        sa.Column("ficha", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "fuente",
            sa.String(length=50),
            server_default="manual",
            nullable=False,
        ),
        sa.Column("fecha_recuperacion", sa.DateTime(timezone=True), nullable=True),
        sa.Column("habitual", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default=sa.true(), nullable=False),
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
            ["productor_id"],
            ["productores.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["ingrediente_id"],
            ["ingredientes.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(IX_PRODUCTOR, TABLE, ["productor_id"])
    op.create_index(IX_INGREDIENTE, TABLE, ["ingrediente_id"])
    op.create_index(
        IX_CODIGO_BARRAS,
        TABLE,
        ["productor_id", "codigo_barras"],
        unique=True,
        postgresql_where=sa.text("codigo_barras IS NOT NULL"),
    )
    op.create_index(
        IX_HABITUAL,
        TABLE,
        ["ingrediente_id"],
        unique=True,
        postgresql_where=sa.text("habitual = true"),
    )


def downgrade() -> None:
    op.drop_index(IX_HABITUAL, table_name=TABLE)
    op.drop_index(IX_CODIGO_BARRAS, table_name=TABLE)
    op.drop_index(IX_INGREDIENTE, table_name=TABLE)
    op.drop_index(IX_PRODUCTOR, table_name=TABLE)
    op.drop_table(TABLE)
