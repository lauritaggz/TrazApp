"""Seed global allergen catalog for HU02.

Revision ID: 009_seed_alergenos
Revises: 008_extend_ingredientes_hu02
Create Date: 2026-09-02

Inserts the initial allergen catalog (EU reference list). Idempotent via ON CONFLICT.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "009_seed_alergenos"
down_revision: Union[str, None] = "008_extend_ingredientes_hu02"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ALERGENOS_INICIALES = (
    ("gluten", "Gluten"),
    ("crustaceos", "Crustáceos"),
    ("huevos", "Huevos"),
    ("pescado", "Pescado"),
    ("cacahuetes", "Cacahuetes"),
    ("soja", "Soja"),
    ("lacteos", "Lácteos"),
    ("frutos_cascara", "Frutos de cáscara"),
    ("apio", "Apio"),
    ("mostaza", "Mostaza"),
    ("sesamo", "Sésamo"),
    ("sulfitos", "Sulfitos"),
    ("altramuces", "Altramuces"),
    ("moluscos", "Moluscos"),
)


def upgrade() -> None:
    connection = op.get_bind()
    for codigo, nombre in ALERGENOS_INICIALES:
        connection.execute(
            sa.text(
                "INSERT INTO alergenos (codigo, nombre) VALUES (:codigo, :nombre) "
                "ON CONFLICT (codigo) DO NOTHING"
            ),
            {"codigo": codigo, "nombre": nombre},
        )


def downgrade() -> None:
    connection = op.get_bind()
    for codigo, _nombre in ALERGENOS_INICIALES:
        connection.execute(
            sa.text("DELETE FROM alergenos WHERE codigo = :codigo"),
            {"codigo": codigo},
        )
