"""PostgreSQL triggers that make a finalized elaboración immutable (HU05 / T05-05).

Single source of the SQL: migration 016 runs it with `op.execute`, and `instalar_en_tablas`
registers it as `after_create` events of the tables, so a schema built with `create_all` (the
PostgreSQL test database) has the same triggers as one built by the migrations. Neither path
does anything on other databases (SQLite has no triggers: there the service is the only guard).

Rules (all of them raise `integrity_constraint_violation`, which SQLAlchemy reports as an
IntegrityError whose message starts with one of the markers below):

1. An elaboración with estado 'finalizada' cannot be updated or deleted.
2. An elaboración can only become 'finalizada' if it has finalizada_at, at least one use, and
   every use has its supply and its conserved information.
3. An elaboración can only be INSERTED as 'borrador': it is born open and becomes finalizada
   through rule 2, never directly.
4. The uses (usos_insumo) of a finalized elaboración cannot be inserted, updated or deleted.
   Deleting a borrador removes its uses by cascade: by then the parent row is gone, so the
   check finds no finalized parent.

The service checks the state first and answers 409; the triggers are the last line of defense
against bugs, scripts and manual SQL. The finalization writes the copies BEFORE changing the
state, which is the order rule 2 requires.
"""

from sqlalchemy import DDL, event

# Prefixes of the error messages: the service recognizes them to answer 409.
MARCADOR_FINALIZADA = "elaboracion_finalizada"
MARCADOR_INCOMPLETA = "finalizacion_incompleta"
MARCADOR_NACE_BORRADOR = "elaboracion_nace_borrador"
MARCADORES = (MARCADOR_FINALIZADA, MARCADOR_INCOMPLETA, MARCADOR_NACE_BORRADOR)

FN_INMUTABLE = "fn_elaboraciones_inmutables"
FN_COMPLETA = "fn_elaboraciones_finalizacion_completa"
FN_USOS = "fn_usos_insumo_elaboracion_abierta"
FN_NACE = "fn_elaboraciones_nacen_borrador"

TRG_INMUTABLE = "trg_elaboraciones_inmutables"
TRG_COMPLETA = "trg_elaboraciones_finalizacion_completa"
TRG_USOS = "trg_usos_insumo_elaboracion_abierta"
TRG_NACE = "trg_elaboraciones_nacen_borrador"

CREAR_FUNCIONES = (
    f"""
CREATE OR REPLACE FUNCTION {FN_NACE}() RETURNS trigger AS $$
BEGIN
    IF NEW.estado IS DISTINCT FROM 'borrador' THEN
        RAISE EXCEPTION '{MARCADOR_NACE_BORRADOR}: toda elaboracion debe crearse como borrador'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""",
    f"""
CREATE OR REPLACE FUNCTION {FN_INMUTABLE}() RETURNS trigger AS $$
BEGIN
    IF OLD.estado = 'finalizada' THEN
        RAISE EXCEPTION '{MARCADOR_FINALIZADA}: una elaboracion finalizada no puede modificarse ni eliminarse'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""",
    f"""
CREATE OR REPLACE FUNCTION {FN_COMPLETA}() RETURNS trigger AS $$
BEGIN
    IF NEW.finalizada_at IS NULL THEN
        RAISE EXCEPTION '{MARCADOR_INCOMPLETA}: falta la fecha de finalizacion'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM usos_insumo WHERE elaboracion_id = OLD.id) THEN
        RAISE EXCEPTION '{MARCADOR_INCOMPLETA}: la elaboracion no tiene usos de insumo'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    IF EXISTS (
        SELECT 1 FROM usos_insumo
        WHERE elaboracion_id = OLD.id
          AND (
              insumo_id IS NULL
              OR informacion_conservada IS NULL
              OR informacion_conservada = 'null'::jsonb
          )
    ) THEN
        RAISE EXCEPTION '{MARCADOR_INCOMPLETA}: un uso no tiene insumo o informacion conservada'
            USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""",
    f"""
CREATE OR REPLACE FUNCTION {FN_USOS}() RETURNS trigger AS $$
DECLARE
    v_estado text;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        SELECT estado INTO v_estado FROM elaboraciones WHERE id = OLD.elaboracion_id;
        IF v_estado = 'finalizada' THEN
            RAISE EXCEPTION '{MARCADOR_FINALIZADA}: los usos de una elaboracion finalizada no pueden modificarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        SELECT estado INTO v_estado FROM elaboraciones WHERE id = NEW.elaboracion_id;
        IF v_estado = 'finalizada' THEN
            RAISE EXCEPTION '{MARCADOR_FINALIZADA}: los usos de una elaboracion finalizada no pueden modificarse'
                USING ERRCODE = 'integrity_constraint_violation';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
""",
)

CREAR_TRIGGERS_ELABORACIONES = (
    f"""
CREATE TRIGGER {TRG_NACE}
    BEFORE INSERT ON elaboraciones
    FOR EACH ROW EXECUTE FUNCTION {FN_NACE}()
""",
    f"""
CREATE TRIGGER {TRG_INMUTABLE}
    BEFORE UPDATE OR DELETE ON elaboraciones
    FOR EACH ROW EXECUTE FUNCTION {FN_INMUTABLE}()
""",
    f"""
CREATE TRIGGER {TRG_COMPLETA}
    BEFORE UPDATE ON elaboraciones
    FOR EACH ROW
    WHEN (OLD.estado IS DISTINCT FROM 'finalizada' AND NEW.estado = 'finalizada')
    EXECUTE FUNCTION {FN_COMPLETA}()
""",
)

CREAR_TRIGGERS_USOS = (
    f"""
CREATE TRIGGER {TRG_USOS}
    BEFORE INSERT OR UPDATE OR DELETE ON usos_insumo
    FOR EACH ROW EXECUTE FUNCTION {FN_USOS}()
""",
)

ELIMINAR_TRIGGERS = (
    f"DROP TRIGGER IF EXISTS {TRG_NACE} ON elaboraciones",
    f"DROP TRIGGER IF EXISTS {TRG_USOS} ON usos_insumo",
    f"DROP TRIGGER IF EXISTS {TRG_COMPLETA} ON elaboraciones",
    f"DROP TRIGGER IF EXISTS {TRG_INMUTABLE} ON elaboraciones",
)

ELIMINAR_FUNCIONES = (
    f"DROP FUNCTION IF EXISTS {FN_NACE}()",
    f"DROP FUNCTION IF EXISTS {FN_USOS}()",
    f"DROP FUNCTION IF EXISTS {FN_COMPLETA}()",
    f"DROP FUNCTION IF EXISTS {FN_INMUTABLE}()",
)

# Everything migration 016 creates, in dependency order.
INSTALAR = (*CREAR_FUNCIONES, *CREAR_TRIGGERS_ELABORACIONES, *CREAR_TRIGGERS_USOS)
# Everything it removes, triggers first.
DESINSTALAR = (*ELIMINAR_TRIGGERS, *ELIMINAR_FUNCIONES)


def instalar_en_tablas(elaboraciones, usos_insumo) -> None:
    """Install the triggers when `create_all` builds the tables (PostgreSQL only).

    The functions and the triggers of `elaboraciones` come with that table; the trigger of
    `usos_insumo` needs its table, which is created after (it depends on elaboraciones). The
    functions are dropped with the last table: dropping the tables already drops the triggers.
    """
    for sql in (*CREAR_FUNCIONES, *CREAR_TRIGGERS_ELABORACIONES):
        event.listen(elaboraciones, "after_create", DDL(sql).execute_if(dialect="postgresql"))
    for sql in CREAR_TRIGGERS_USOS:
        event.listen(usos_insumo, "after_create", DDL(sql).execute_if(dialect="postgresql"))
    for sql in ELIMINAR_FUNCIONES:
        event.listen(elaboraciones, "after_drop", DDL(sql).execute_if(dialect="postgresql"))
