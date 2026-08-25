"""Add nombre_negocio to productores for basic profile (T12-08).

Revision ID: 003_add_nombre_negocio
Revises: 002_add_productores
Create Date: 2026-08-24

The column is nullable so existing producers created in HU12 remain valid
without inventing a business name. New registrations require the field.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "003_add_nombre_negocio"
down_revision: Union[str, None] = "002_add_productores"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "productores",
        sa.Column("nombre_negocio", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("productores", "nombre_negocio")
