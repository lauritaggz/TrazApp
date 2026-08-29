"""Seed global product categories for T01-11.

Revision ID: 007_seed_categorias_producto
Revises: 006_extend_productos_t01_10
Create Date: 2026-08-28

Inserts the initial commercial category catalog. Idempotent via ON CONFLICT.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_seed_categorias_producto"
down_revision: Union[str, None] = "006_extend_productos_t01_10"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CATEGORIAS_INICIALES = (
    "Pastelería",
    "Panadería",
    "Dulce",
    "Salado",
    "Bebidas",
    "Otros",
)


def upgrade() -> None:
    connection = op.get_bind()
    for nombre in CATEGORIAS_INICIALES:
        connection.execute(
            sa.text(
                "INSERT INTO categorias (nombre) VALUES (:nombre) "
                "ON CONFLICT (nombre) DO NOTHING"
            ),
            {"nombre": nombre},
        )


def downgrade() -> None:
    connection = op.get_bind()
    for nombre in CATEGORIAS_INICIALES:
        connection.execute(
            sa.text("DELETE FROM categorias WHERE nombre = :nombre"),
            {"nombre": nombre},
        )
