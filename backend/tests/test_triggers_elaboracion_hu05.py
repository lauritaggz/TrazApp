"""Database triggers that make a finalized elaboración immutable, in plain SQL (T05-05 / HU05).

PostgreSQL only: the schema comes from `create_all`, which installs the same triggers as migration
016 (app/db/triggers_elaboracion.py). Every statement goes straight to the database, bypassing the
service and the ORM, to prove the protection does not depend on the application.
"""

import pytest
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError

from app.db.triggers_elaboracion import MARCADOR_FINALIZADA, MARCADOR_INCOMPLETA, MARCADOR_NACE_BORRADOR
from tests.conftest import USE_POSTGRESQL
from tests.test_migracion_015_elaboraciones import _elaborar, _id, _lotear, _seed, _usar

pytestmark = pytest.mark.skipif(
    not USE_POSTGRESQL,
    reason="Los triggers de elaboraciones son de PostgreSQL.",
)

COPIA = '{"esquema": 1, "insumo": {"nombre": "Leche A"}}'


@pytest.fixture
def bd(db_engine: Engine) -> Engine:
    """Seeded schema: a productor, two products, ingredient Leche, two supplies."""
    _seed(db_engine)
    with db_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO ingredientes (productor_id, nombre, activo) "
                "SELECT id, 'Harina', true FROM productores"
            )
        )
    return db_engine


def _ejecutar(engine: Engine, sql: str, **params) -> None:
    with engine.begin() as conn:
        conn.execute(text(sql), params)


def _escalar(engine: Engine, sql: str, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar_one()


def _rechaza(engine: Engine, sql: str, marcador: str, **params) -> None:
    with pytest.raises(IntegrityError) as error:
        _ejecutar(engine, sql, **params)
    assert marcador in str(error.value.orig)
    assert error.value.orig.pgcode == "23000"


def _insertar_uso(
    engine: Engine,
    elaboracion: int,
    ingrediente: str = "Leche",
    insumo: str | None = "Leche A",
    *,
    con_copia: bool = False,
) -> int:
    with engine.begin() as conn:
        return conn.execute(
            text(
                "INSERT INTO usos_insumo (elaboracion_id, ingrediente_id, insumo_id, sin_lote, informacion_conservada) "
                "VALUES (:e, (SELECT id FROM ingredientes WHERE nombre = :i), "
                "(SELECT id FROM insumos_comerciales WHERE nombre = :s), true, "
                "CASE WHEN :c THEN CAST(:copia AS jsonb) ELSE NULL END) RETURNING id"
            ),
            {"e": elaboracion, "i": ingrediente, "s": insumo, "c": con_copia, "copia": COPIA},
        ).scalar_one()


def _finalizar(engine: Engine, elaboracion: int) -> None:
    _ejecutar(
        engine,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        e=elaboracion,
    )


def _finalizada(engine: Engine, codigo: str = "E-001") -> int:
    """A finalized elaboración with two complete uses (Leche and Harina)."""
    elaboracion = _elaborar(engine, codigo)
    _insertar_uso(engine, elaboracion, "Leche", "Leche A", con_copia=True)
    _insertar_uso(engine, elaboracion, "Harina", "Leche B", con_copia=True)
    _finalizar(engine, elaboracion)
    return elaboracion


def _fila(engine: Engine, elaboracion: int) -> tuple:
    with engine.connect() as conn:
        return tuple(
            conn.execute(
                text("SELECT codigo, estado, finalizada_at, fecha_elaboracion FROM elaboraciones WHERE id = :e"),
                {"e": elaboracion},
            ).one()
        )


def _usos(engine: Engine, elaboracion: int) -> list[tuple]:
    with engine.connect() as conn:
        return [
            tuple(fila)
            for fila in conn.execute(
                text(
                    "SELECT id, ingrediente_id, insumo_id, lote_id, sin_lote, informacion_conservada "
                    "FROM usos_insumo WHERE elaboracion_id = :e ORDER BY id"
                ),
                {"e": elaboracion},
            )
        ]


# --- instalación -------------------------------------------------------------------------


def test_create_all_instala_las_funciones_y_los_triggers(bd: Engine) -> None:
    with bd.connect() as conn:
        triggers = {
            fila[0]: (fila[1], fila[2])
            for fila in conn.execute(
                text(
                    "SELECT tgname, tgrelid::regclass::text, tgenabled FROM pg_trigger "
                    "WHERE NOT tgisinternal AND tgname LIKE 'trg\\_%'"
                )
            )
        }
        funciones = {
            fila[0]
            for fila in conn.execute(text("SELECT proname FROM pg_proc WHERE proname LIKE 'fn\\_%'"))
        }

    assert triggers == {
        "trg_elaboraciones_nacen_borrador": ("elaboraciones", "O"),
        "trg_elaboraciones_inmutables": ("elaboraciones", "O"),
        "trg_elaboraciones_finalizacion_completa": ("elaboraciones", "O"),
        "trg_usos_insumo_elaboracion_abierta": ("usos_insumo", "O"),
    }
    assert funciones == {
        "fn_elaboraciones_nacen_borrador",
        "fn_elaboraciones_inmutables",
        "fn_elaboraciones_finalizacion_completa",
        "fn_usos_insumo_elaboracion_abierta",
    }


# --- toda elaboración nace como borrador -------------------------------------------------

INSERT_ELABORACION = (
    "INSERT INTO elaboraciones (productor_id, producto_id, version_producto_id, codigo, fecha_elaboracion, {columnas}) "
    "SELECT p.productor_id, p.id, v.id, :codigo, DATE '2026-10-06', {valores} "
    "FROM productos p JOIN versiones_producto v ON v.producto_id = p.id WHERE p.nombre = 'Queque'"
)


def test_un_insert_con_estado_finalizada_falla(bd: Engine) -> None:
    sentencia = INSERT_ELABORACION.format(columnas="estado, finalizada_at", valores="'finalizada', now()")

    _rechaza(bd, sentencia, MARCADOR_NACE_BORRADOR, codigo="E-001")

    assert _escalar(bd, "SELECT count(*) FROM elaboraciones") == 0


def test_un_insert_con_estado_finalizada_y_sin_fecha_tambien_lo_dice_el_trigger(bd: Engine) -> None:
    sentencia = INSERT_ELABORACION.format(columnas="estado", valores="'finalizada'")

    _rechaza(bd, sentencia, MARCADOR_NACE_BORRADOR, codigo="E-001")


def test_un_insert_con_un_estado_desconocido_tambien_falla(bd: Engine) -> None:
    sentencia = INSERT_ELABORACION.format(columnas="estado", valores="'cancelada'")

    with pytest.raises(IntegrityError):
        _ejecutar(bd, sentencia, codigo="E-001")


def test_un_insert_como_borrador_funciona_con_estado_explicito(bd: Engine) -> None:
    _ejecutar(bd, INSERT_ELABORACION.format(columnas="estado", valores="'borrador'"), codigo="E-001")

    assert _escalar(bd, "SELECT estado FROM elaboraciones WHERE codigo = 'E-001'") == "borrador"


def test_un_insert_sin_estado_toma_el_valor_por_defecto_y_funciona(bd: Engine) -> None:
    sentencia = (
        "INSERT INTO elaboraciones (productor_id, producto_id, version_producto_id, codigo, fecha_elaboracion) "
        "SELECT p.productor_id, p.id, v.id, :codigo, DATE '2026-10-06' "
        "FROM productos p JOIN versiones_producto v ON v.producto_id = p.id WHERE p.nombre = 'Queque'"
    )

    _ejecutar(bd, sentencia, codigo="E-001")

    assert _escalar(bd, "SELECT estado FROM elaboraciones WHERE codigo = 'E-001'") == "borrador"


def test_un_insert_masivo_con_una_fila_finalizada_falla_completo(bd: Engine) -> None:
    sentencia = (
        "INSERT INTO elaboraciones (productor_id, producto_id, version_producto_id, codigo, fecha_elaboracion, estado, finalizada_at) "
        "SELECT p.productor_id, p.id, v.id, c.codigo, DATE '2026-10-06', c.estado, c.finalizada_at "
        "FROM productos p JOIN versiones_producto v ON v.producto_id = p.id, "
        "(VALUES ('E-001', 'borrador', NULL::timestamptz), ('E-002', 'finalizada', now())) AS c(codigo, estado, finalizada_at) "
        "WHERE p.nombre = 'Queque'"
    )

    _rechaza(bd, sentencia, MARCADOR_NACE_BORRADOR)

    assert _escalar(bd, "SELECT count(*) FROM elaboraciones") == 0


# --- elaboraciones finalizadas -----------------------------------------------------------


@pytest.mark.parametrize(
    "sentencia",
    [
        "UPDATE elaboraciones SET codigo = 'OTRO' WHERE id = :e",
        "UPDATE elaboraciones SET fecha_elaboracion = DATE '2020-01-01' WHERE id = :e",
        "UPDATE elaboraciones SET estado = 'borrador', finalizada_at = NULL WHERE id = :e",
        "UPDATE elaboraciones SET finalizada_at = now() WHERE id = :e",
        "UPDATE elaboraciones SET version_producto_id = version_producto_id WHERE id = :e",
    ],
)
def test_un_update_sobre_una_elaboracion_finalizada_falla(bd: Engine, sentencia: str) -> None:
    elaboracion = _finalizada(bd)
    antes = _fila(bd, elaboracion)

    _rechaza(bd, sentencia, MARCADOR_FINALIZADA, e=elaboracion)

    assert _fila(bd, elaboracion) == antes


def test_un_delete_sobre_una_elaboracion_finalizada_falla_y_conserva_sus_usos(bd: Engine) -> None:
    elaboracion = _finalizada(bd)
    usos = _usos(bd, elaboracion)

    _rechaza(bd, "DELETE FROM elaboraciones WHERE id = :e", MARCADOR_FINALIZADA, e=elaboracion)

    assert _fila(bd, elaboracion)[1] == "finalizada"
    assert _usos(bd, elaboracion) == usos


def test_un_delete_masivo_que_incluye_una_finalizada_falla_completo(bd: Engine) -> None:
    borrador = _elaborar(bd, "E-002")
    finalizada = _finalizada(bd, "E-001")

    _rechaza(bd, "DELETE FROM elaboraciones", MARCADOR_FINALIZADA)

    assert _fila(bd, borrador)[1] == "borrador"
    assert _fila(bd, finalizada)[1] == "finalizada"


# --- usos de una elaboración finalizada --------------------------------------------------


@pytest.mark.parametrize(
    "sentencia",
    [
        "UPDATE usos_insumo SET sin_lote = false WHERE elaboracion_id = :e",
        "UPDATE usos_insumo SET insumo_id = NULL WHERE elaboracion_id = :e",
        "UPDATE usos_insumo SET informacion_conservada = CAST('{\"esquema\": 2}' AS jsonb) WHERE elaboracion_id = :e",
        "UPDATE usos_insumo SET informacion_conservada = NULL WHERE elaboracion_id = :e",
    ],
)
def test_un_update_sobre_los_usos_de_una_finalizada_falla(bd: Engine, sentencia: str) -> None:
    elaboracion = _finalizada(bd)
    usos = _usos(bd, elaboracion)

    _rechaza(bd, sentencia, MARCADOR_FINALIZADA, e=elaboracion)

    assert _usos(bd, elaboracion) == usos


def test_un_insert_de_un_uso_en_una_finalizada_falla(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _finalizar(bd, elaboracion)
    usos = _usos(bd, elaboracion)

    with pytest.raises(IntegrityError) as error:
        _insertar_uso(bd, elaboracion, "Harina", "Leche B", con_copia=True)

    assert MARCADOR_FINALIZADA in str(error.value.orig)
    assert _usos(bd, elaboracion) == usos


def test_un_delete_de_un_uso_de_una_finalizada_falla(bd: Engine) -> None:
    elaboracion = _finalizada(bd)
    usos = _usos(bd, elaboracion)

    _rechaza(bd, "DELETE FROM usos_insumo WHERE id = :u", MARCADOR_FINALIZADA, u=usos[0][0])
    _rechaza(bd, "DELETE FROM usos_insumo WHERE elaboracion_id = :e", MARCADOR_FINALIZADA, e=elaboracion)

    assert _usos(bd, elaboracion) == usos


def test_un_uso_no_se_puede_mover_a_o_desde_una_finalizada(bd: Engine) -> None:
    borrador = _elaborar(bd, "E-002")
    uso_borrador = _insertar_uso(bd, borrador, "Leche", "Leche A")
    finalizada = _finalizada(bd, "E-001")

    _rechaza(bd, "UPDATE usos_insumo SET elaboracion_id = :f WHERE id = :u", MARCADOR_FINALIZADA, f=finalizada, u=uso_borrador)
    uso_de_la_finalizada = _usos(bd, finalizada)[0][0]
    _rechaza(bd, "UPDATE usos_insumo SET elaboracion_id = :b WHERE id = :u", MARCADOR_FINALIZADA, b=borrador, u=uso_de_la_finalizada)


# --- pasar a finalizada ------------------------------------------------------------------


def test_pasar_a_finalizada_sin_copias_falla_y_la_elaboracion_sigue_en_borrador(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=False)

    _rechaza(
        bd,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        MARCADOR_INCOMPLETA,
        e=elaboracion,
    )

    assert _fila(bd, elaboracion)[1:3] == ("borrador", None)


def test_pasar_a_finalizada_con_una_sola_copia_de_dos_falla(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _insertar_uso(bd, elaboracion, "Harina", "Leche B", con_copia=False)

    _rechaza(
        bd,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        MARCADOR_INCOMPLETA,
        e=elaboracion,
    )


def test_una_copia_json_null_cuenta_como_ausente(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _ejecutar(bd, "UPDATE usos_insumo SET informacion_conservada = CAST('null' AS jsonb) WHERE elaboracion_id = :e", e=elaboracion)

    _rechaza(
        bd,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        MARCADOR_INCOMPLETA,
        e=elaboracion,
    )


def test_pasar_a_finalizada_con_un_uso_sin_insumo_falla(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _insertar_uso(bd, elaboracion, "Harina", None, con_copia=True)

    _rechaza(
        bd,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        MARCADOR_INCOMPLETA,
        e=elaboracion,
    )


def test_pasar_a_finalizada_sin_ningun_uso_falla(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")

    _rechaza(
        bd,
        "UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e",
        MARCADOR_INCOMPLETA,
        e=elaboracion,
    )


def test_pasar_a_finalizada_sin_finalizada_at_falla_con_el_mensaje_del_trigger(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)

    _rechaza(bd, "UPDATE elaboraciones SET estado = 'finalizada' WHERE id = :e", MARCADOR_INCOMPLETA, e=elaboracion)

    assert _fila(bd, elaboracion)[1:3] == ("borrador", None)


def test_pasar_a_finalizada_con_todo_completo_funciona(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _insertar_uso(bd, elaboracion, "Harina", "Leche B", con_copia=True)

    _finalizar(bd, elaboracion)

    assert _fila(bd, elaboracion)[1] == "finalizada"


def test_las_copias_y_el_estado_en_una_misma_transaccion_funcionan_y_al_reves_no(bd: Engine) -> None:
    """The order the service uses: copies first, state last, in one transaction."""
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=False)
    with bd.begin() as conn:
        conn.execute(
            text("UPDATE usos_insumo SET informacion_conservada = CAST(:c AS jsonb) WHERE elaboracion_id = :e"),
            {"c": COPIA, "e": elaboracion},
        )
        conn.execute(
            text("UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e"),
            {"e": elaboracion},
        )
    assert _fila(bd, elaboracion)[1] == "finalizada"

    otra = _elaborar(bd, "E-002")
    _insertar_uso(bd, otra, "Leche", "Leche A", con_copia=False)
    with pytest.raises(IntegrityError):
        with bd.begin() as conn:
            conn.execute(
                text("UPDATE elaboraciones SET estado = 'finalizada', finalizada_at = now() WHERE id = :e"),
                {"e": otra},
            )
            conn.execute(
                text("UPDATE usos_insumo SET informacion_conservada = CAST(:c AS jsonb) WHERE elaboracion_id = :e"),
                {"c": COPIA, "e": otra},
            )
    assert _fila(bd, otra)[1] == "borrador"


# --- los borradores siguen siendo editables ----------------------------------------------


def test_un_borrador_se_puede_modificar_y_sus_usos_cambiar(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    uso = _insertar_uso(bd, elaboracion, "Leche", "Leche A")
    lote = _lotear(bd, "Leche A")

    _ejecutar(bd, "UPDATE elaboraciones SET codigo = 'E-009', fecha_elaboracion = DATE '2026-10-01' WHERE id = :e", e=elaboracion)
    _ejecutar(bd, "UPDATE usos_insumo SET sin_lote = false, lote_id = :l WHERE id = :u", l=lote, u=uso)
    _insertar_uso(bd, elaboracion, "Harina", "Leche B")
    _ejecutar(bd, "DELETE FROM usos_insumo WHERE id = :u", u=uso)

    assert _fila(bd, elaboracion)[0] == "E-009"
    assert len(_usos(bd, elaboracion)) == 1


def test_un_borrador_se_puede_eliminar_con_sus_usos(bd: Engine) -> None:
    elaboracion = _elaborar(bd, "E-001")
    _insertar_uso(bd, elaboracion, "Leche", "Leche A", con_copia=True)
    _insertar_uso(bd, elaboracion, "Harina", "Leche B", con_copia=True)

    _ejecutar(bd, "DELETE FROM elaboraciones WHERE id = :e", e=elaboracion)

    assert _escalar(bd, "SELECT count(*) FROM elaboraciones") == 0
    assert _escalar(bd, "SELECT count(*) FROM usos_insumo") == 0


def test_los_usos_de_un_borrador_no_se_ven_afectados_por_otra_finalizada(bd: Engine) -> None:
    _finalizada(bd, "E-001")
    borrador = _elaborar(bd, "E-002")
    uso = _insertar_uso(bd, borrador, "Leche", "Leche A")

    _ejecutar(bd, "UPDATE usos_insumo SET sin_lote = false WHERE id = :u", u=uso)
    _ejecutar(bd, "DELETE FROM usos_insumo WHERE id = :u", u=uso)
    _ejecutar(bd, "DELETE FROM elaboraciones WHERE id = :e", e=borrador)


def test_lo_que_se_deshabilita_a_proposito_permite_corregir_una_finalizada(bd: Engine) -> None:
    """The protection is not absolute by accident: correcting data needs an explicit DISABLE TRIGGER."""
    elaboracion = _finalizada(bd)

    with bd.begin() as conn:
        conn.execute(text("ALTER TABLE elaboraciones DISABLE TRIGGER trg_elaboraciones_inmutables"))
        try:
            conn.execute(text("UPDATE elaboraciones SET codigo = 'CORREGIDO' WHERE id = :e"), {"e": elaboracion})
        finally:
            conn.execute(text("ALTER TABLE elaboraciones ENABLE TRIGGER trg_elaboraciones_inmutables"))

    assert _fila(bd, elaboracion)[0] == "CORREGIDO"
    _rechaza(bd, "UPDATE elaboraciones SET codigo = 'OTRO' WHERE id = :e", MARCADOR_FINALIZADA, e=elaboracion)
