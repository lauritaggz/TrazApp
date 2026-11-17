"""Add the cost calculator data for HU14 (T14-02).

Revision ID: 019_costos_producto_hu14
Revises: 018_publicacion_producto_hu09
Create Date: 2026-11-16

- insumos_comerciales: precio_referencia (numeric(12,2) >= 0), precio_fuente ('jumbo' | 'manual'),
  precio_fecha, contenido_cantidad (numeric(12,3) > 0), contenido_unidad (g, kg, ml, L, unidad) and
  contenido_fuente ('jumbo' | 'open_food_facts' | 'manual'). All NULL: price, source and date go
  together, and so do content, unit and source.
- productos.rendimiento (integer > 0, NULL by default).
- producto_ingrediente_cantidades: quantity and unit of each ingredient in one batch, unique per
  (producto, ingrediente) and independent of the formulation version.
- producto_otros_costos: other costs per batch (name, amount >= 0, order).

No backfill: existing supplies stay "sin precio" and no row is rewritten.

Downgrade refuses, with a clear message and without touching anything, while any of this data
exists: it was typed in by the productor and cannot be rebuilt. With none, it only removes what the
upgrade added.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "019_costos_producto_hu14"
down_revision: Union[str, None] = "018_publicacion_producto_hu09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

UNIDADES = "('g', 'kg', 'ml', 'L', 'unidad')"

COLUMNAS_INSUMO = (
    ("precio_referencia", sa.Numeric(12, 2)),
    ("precio_fuente", sa.String(length=20)),
    ("precio_fecha", sa.DateTime(timezone=True)),
    ("contenido_cantidad", sa.Numeric(12, 3)),
    ("contenido_unidad", sa.String(length=20)),
    ("contenido_fuente", sa.String(length=20)),
)
CHECKS_INSUMO = (
    ("ck_insumo_precio_no_negativo", "precio_referencia IS NULL OR precio_referencia >= 0"),
    ("ck_insumo_precio_fuente", "precio_fuente IS NULL OR precio_fuente IN ('jumbo', 'manual')"),
    (
        "ck_insumo_precio_completo",
        "(precio_referencia IS NULL) = (precio_fuente IS NULL) "
        "AND (precio_referencia IS NULL) = (precio_fecha IS NULL)",
    ),
    ("ck_insumo_contenido_positivo", "contenido_cantidad IS NULL OR contenido_cantidad > 0"),
    ("ck_insumo_contenido_unidad", f"contenido_unidad IS NULL OR contenido_unidad IN {UNIDADES}"),
    (
        "ck_insumo_contenido_fuente",
        "contenido_fuente IS NULL OR contenido_fuente IN ('jumbo', 'open_food_facts', 'manual')",
    ),
    (
        "ck_insumo_contenido_completo",
        "(contenido_cantidad IS NULL) = (contenido_unidad IS NULL) "
        "AND (contenido_cantidad IS NULL) = (contenido_fuente IS NULL)",
    ),
)


def upgrade() -> None:
    for nombre, tipo in COLUMNAS_INSUMO:
        op.add_column("insumos_comerciales", sa.Column(nombre, tipo, nullable=True))
    for nombre, condicion in CHECKS_INSUMO:
        op.create_check_constraint(nombre, "insumos_comerciales", condicion)

    op.add_column("productos", sa.Column("rendimiento", sa.Integer(), nullable=True))
    op.create_check_constraint(
        "ck_producto_rendimiento_positivo",
        "productos",
        "rendimiento IS NULL OR rendimiento > 0",
    )

    op.create_table(
        "producto_ingrediente_cantidades",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("ingrediente_id", sa.Integer(), nullable=False),
        sa.Column("cantidad", sa.Numeric(12, 3), nullable=False),
        sa.Column("unidad", sa.String(length=20), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_producto_ingrediente_cantidades"),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["ingrediente_id"], ["ingredientes.id"], ondelete="RESTRICT"),
        sa.UniqueConstraint("producto_id", "ingrediente_id", name="uq_producto_ingrediente_cantidad"),
        sa.CheckConstraint("cantidad > 0", name="ck_producto_ingrediente_cantidad_positiva"),
        sa.CheckConstraint(f"unidad IN {UNIDADES}", name="ck_producto_ingrediente_cantidad_unidad"),
    )

    op.create_table(
        "producto_otros_costos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("producto_id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("monto", sa.Numeric(12, 2), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_producto_otros_costos"),
        sa.ForeignKeyConstraint(["producto_id"], ["productos.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("length(trim(nombre)) > 0", name="ck_producto_otro_costo_nombre"),
        sa.CheckConstraint("monto >= 0", name="ck_producto_otro_costo_monto"),
        sa.CheckConstraint("orden >= 1", name="ck_producto_otro_costo_orden"),
    )
    op.create_index(
        "ix_producto_otros_costos_producto_orden",
        "producto_otros_costos",
        ["producto_id", "orden"],
    )


def downgrade() -> None:
    bind = op.get_bind()

    def contar(sql: str) -> int:
        return bind.execute(sa.text(sql)).scalar_one()

    insumos = contar(
        "SELECT count(*) FROM insumos_comerciales "
        "WHERE precio_referencia IS NOT NULL OR contenido_cantidad IS NOT NULL"
    )
    rendimientos = contar("SELECT count(*) FROM productos WHERE rendimiento IS NOT NULL")
    cantidades = contar("SELECT count(*) FROM producto_ingrediente_cantidades")
    otros = contar("SELECT count(*) FROM producto_otros_costos")
    if insumos or rendimientos or cantidades or otros:
        raise RuntimeError(
            "No se puede revertir la migración 019: hay datos de la calculadora de costos que no se "
            f"pueden reconstruir ({insumos} insumo(s) con precio o contenido, {rendimientos} "
            f"producto(s) con rendimiento, {cantidades} cantidad(es) de ingredientes y {otros} otro(s) "
            "costo(s)). No se modificó nada."
        )
    op.drop_index("ix_producto_otros_costos_producto_orden", table_name="producto_otros_costos")
    op.drop_table("producto_otros_costos")
    op.drop_table("producto_ingrediente_cantidades")
    op.drop_constraint("ck_producto_rendimiento_positivo", "productos", type_="check")
    op.drop_column("productos", "rendimiento")
    for nombre, _ in reversed(CHECKS_INSUMO):
        op.drop_constraint(nombre, "insumos_comerciales", type_="check")
    for nombre, _ in reversed(COLUMNAS_INSUMO):
        op.drop_column("insumos_comerciales", nombre)
