"""Add the allergen review state to commercial supplies for HT06 (HT06-01).

Revision ID: 017_alergenos_revisados_ht06
Revises: 016_elaboracion_inmutable_hu05
Create Date: 2026-10-07

- Adds insumos_comerciales.alergenos_revisados_at (timestamptz, nullable). NULL means the
  allergens were never reviewed ("sin revisar"); a date means they were, even when the supply
  declares none ("revisado, sin alérgenos": a date and no rows in insumos_alergenos).
- Existing data: a supply with at least one row in insumos_alergenos is marked as reviewed with
  the time of this migration (CURRENT_TIMESTAMP, the same value for every row). It is not
  updated_at: that column changes with any edit and would claim a review date nobody made. A
  supply without rows stays NULL. Nothing is deleted or rewritten.

Downgrade drops the column, which loses "reviewed, no allergens": afterwards a supply without
rows cannot be told apart from one never reviewed. So it refuses, with a clear message, while
any supply has alergenos_revisados_at set and no rows in insumos_alergenos. Without such
supplies the column holds nothing that cannot be rebuilt (a supply with rows is "reviewed" by
the upgrade rule), so it reverts. The allergen review date stored inside already-finalized
elaboraciones (informacion_conservada) is never touched.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "017_alergenos_revisados_ht06"
down_revision: Union[str, None] = "016_elaboracion_inmutable_hu05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLE = "insumos_comerciales"
COLUMN = "alergenos_revisados_at"


def upgrade() -> None:
    op.add_column(TABLE, sa.Column(COLUMN, sa.DateTime(timezone=True), nullable=True))
    op.execute(
        f"UPDATE {TABLE} SET {COLUMN} = CURRENT_TIMESTAMP "
        f"WHERE EXISTS (SELECT 1 FROM insumos_alergenos ia WHERE ia.insumo_id = {TABLE}.id)"
    )


def downgrade() -> None:
    perdidos = (
        op.get_bind()
        .execute(
            sa.text(
                f"SELECT i.id FROM {TABLE} i WHERE i.{COLUMN} IS NOT NULL "
                "AND NOT EXISTS (SELECT 1 FROM insumos_alergenos ia WHERE ia.insumo_id = i.id) "
                "ORDER BY i.id"
            )
        )
        .scalars()
        .all()
    )
    if perdidos:
        ids = ", ".join(str(i) for i in perdidos[:10]) + (", ..." if len(perdidos) > 10 else "")
        raise RuntimeError(
            f"No se puede revertir la migración 017: {len(perdidos)} insumo(s) están revisados "
            f"sin alérgenos (id: {ids}) y esa información se perdería al eliminar la columna "
            f"{COLUMN}. Declare algún alérgeno en ellos para poder revertir; no se modificó nada."
        )
    op.drop_column(TABLE, COLUMN)
