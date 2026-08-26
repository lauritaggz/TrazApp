"""Add created_at to productos for HU01 listing sort.

Revision ID: 005_add_created_at_productos
Revises: 004_extend_productos_hu01
Create Date: 2026-08-25

Nullable for RT-01 legacy products without a creation timestamp.
New HU01 products receive server_default now() automatically.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_add_created_at_productos"
down_revision: Union[str, None] = "004_extend_productos_hu01"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "productos",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.text("now()"),
        ),
    )


def downgrade() -> None:
    op.drop_column("productos", "created_at")
