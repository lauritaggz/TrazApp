"""Add allergens declared by commercial supplies for HU04 (T04-02).

Revision ID: 014_insumos_alergenos
Revises: 013_insumos_comerciales
Create Date: 2026-10-05

- Creates insumos_alergenos, following ingredientes_alergenos (HU02): composite primary
  key (insumo_id, alergeno_id), foreign key to the supply with ON DELETE CASCADE and to
  the allergen catalog with ON DELETE RESTRICT.
- The composite key allows an allergen once per supply, so it can never be declared as
  "contiene" and "trazas" at the same time.
- "tipo" is required and limited to 'contiene' or 'trazas' by a CHECK constraint.

The table is new, so downgrade just drops it: no earlier data to protect. Rows stored in
it are lost on downgrade by definition of the revert.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "014_insumos_alergenos"
down_revision: Union[str, None] = "013_insumos_comerciales"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "insumos_alergenos"
CK_TIPO = "ck_insumos_alergenos_tipo"


def upgrade() -> None:
    op.create_table(
        TABLE,
        sa.Column("insumo_id", sa.Integer(), nullable=False),
        sa.Column("alergeno_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.CheckConstraint("tipo IN ('contiene', 'trazas')", name=CK_TIPO),
        sa.ForeignKeyConstraint(
            ["alergeno_id"],
            ["alergenos.id"],
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["insumo_id"],
            ["insumos_comerciales.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("insumo_id", "alergeno_id"),
    )


def downgrade() -> None:
    op.drop_table(TABLE)
