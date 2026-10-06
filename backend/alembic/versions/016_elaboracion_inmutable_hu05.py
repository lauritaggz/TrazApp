"""Make finalized elaboraciones immutable with PostgreSQL triggers for HU05 (T05-05).

Revision ID: 016_elaboracion_inmutable_hu05
Revises: 015_elaboraciones_hu05
Create Date: 2026-10-06

Adds four triggers (and their plpgsql functions); the SQL lives in app/db/triggers_elaboracion.py,
shared with the `after_create` events that give the PostgreSQL test database the same triggers:

- elaboraciones, BEFORE INSERT: fails unless estado is 'borrador' (an elaboración is born open).
- elaboraciones, BEFORE UPDATE OR DELETE: fails if OLD.estado = 'finalizada'.
- elaboraciones, BEFORE UPDATE when it becomes 'finalizada': fails if finalizada_at is null, the
  elaboración has no uses, or any use lacks its supply or its conserved information.
- usos_insumo, BEFORE INSERT OR UPDATE OR DELETE: fails if the elaboración is finalizada.
  Deleting a borrador removes its uses by cascade: its row is already gone, so it is allowed.

The migration only creates functions and triggers (plpgsql is a trusted language and the triggers
belong to the table owner), so it runs with a regular, non-superuser database role, as in production.
It does not touch any row. The triggers apply to every role, including the owner: correcting a
finalized elaboración by hand needs an explicit `ALTER TABLE ... DISABLE TRIGGER`, by design.

Downgrade only drops the triggers and the functions: data is never touched.

Does nothing on databases other than PostgreSQL.

Note: revision id must fit alembic_version.version_num VARCHAR(32).
"""

from typing import Sequence, Union

from alembic import op

from app.db.triggers_elaboracion import DESINSTALAR, INSTALAR

revision: str = "016_elaboracion_inmutable_hu05"
down_revision: Union[str, None] = "015_elaboraciones_hu05"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _es_postgresql() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    if not _es_postgresql():
        return
    for sentencia in INSTALAR:
        op.execute(sentencia)


def downgrade() -> None:
    if not _es_postgresql():
        return
    for sentencia in DESINSTALAR:
        op.execute(sentencia)
