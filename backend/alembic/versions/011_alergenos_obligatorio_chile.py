"""Adapt allergen catalog to Chilean regulation (HT03).

Revision ID: 011_alergenos_obligatorio_chile
Revises: 010_formulacion_version_t02_08
Create Date: 2026-09-27

Adds alergenos.obligatorio_chile and flags the allergens that must be declared
under Minsal Resolución Exenta N.º 427. Renames only the display `nombre` to
Chilean terminology; `id` and `codigo` are left untouched so existing
ingredientes_alergenos rows and frontend references keep working.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "011_alergenos_obligatorio_chile"
down_revision: Union[str, None] = "010_formulacion_version_t02_08"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

OBLIGATORIOS_CHILE = (
    "gluten",
    "crustaceos",
    "huevos",
    "pescado",
    "cacahuetes",
    "soja",
    "lacteos",
    "frutos_cascara",
    "sulfitos",
)

# codigo -> (nombre original de 009, nombre chileno)
RENOMBRES = (
    ("cacahuetes", "Cacahuetes", "Maní"),
    ("soja", "Soja", "Soya"),
    ("lacteos", "Lácteos", "Leche"),
    ("frutos_cascara", "Frutos de cáscara", "Nueces"),
    ("huevos", "Huevos", "Huevo"),
)


def upgrade() -> None:
    op.add_column(
        "alergenos",
        sa.Column(
            "obligatorio_chile",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE alergenos SET obligatorio_chile = true WHERE codigo IN :codigos"
        ).bindparams(sa.bindparam("codigos", expanding=True)),
        {"codigos": list(OBLIGATORIOS_CHILE)},
    )
    for codigo, _original, chileno in RENOMBRES:
        connection.execute(
            sa.text("UPDATE alergenos SET nombre = :nombre WHERE codigo = :codigo"),
            {"nombre": chileno, "codigo": codigo},
        )


def downgrade() -> None:
    connection = op.get_bind()
    for codigo, original, _chileno in RENOMBRES:
        connection.execute(
            sa.text("UPDATE alergenos SET nombre = :nombre WHERE codigo = :codigo"),
            {"nombre": original, "codigo": codigo},
        )

    op.drop_column("alergenos", "obligatorio_chile")
