"""HU14 / T14-04: the cost calculation service of a product.

Data is built straight with the models (the endpoints are T14-05). Runs on SQLite and on PostgreSQL.
"""

from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy import event, select
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models import (
    CantidadIngredienteProducto,
    Elaboracion,
    FormulacionVersionProducto,
    Ingrediente,
    InsumoComercial,
    OtroCostoProducto,
    Producto,
    Productor,
    UsoInsumo,
    VersionProducto,
)
from app.services.costos_service import (
    AVISO_ULTIMO_INACTIVO,
    FALTA_CANTIDAD,
    FALTA_CONTENIDO,
    FALTA_INSUMO,
    FALTA_PRECIO,
    FALTA_UNIDADES,
    ORIGEN_ELEGIDO,
    ORIGEN_HABITUAL,
    ORIGEN_ULTIMA_ELABORACION,
    CostosService,
    CostosValidationError,
)
from app.services.producto_service import ProductoNotFoundError

D = Decimal
HOY = datetime(2026, 11, 17, 12, 0, tzinfo=timezone.utc)


class Escenario:
    """A productor with products, ingredients, supplies, formulations and elaboraciones."""

    def __init__(self, session: Session, email: str = "calculo@ejemplo.com") -> None:
        self.s = session
        self.productor = Productor(nombre="Productora", email=email, password_hash="hash")
        session.add(self.productor)
        session.commit()
        self._versiones: dict[int, int] = {}
        self._codigos = 0

    def ingrediente(self, nombre: str) -> Ingrediente:
        ingrediente = Ingrediente(productor_id=self.productor.id, nombre=nombre, activo=True)
        self.s.add(ingrediente)
        self.s.commit()
        return ingrediente

    def producto(self, nombre: str = "Queque", rendimiento: int | None = None, **extra) -> Producto:
        self._codigos += 1
        producto = Producto(
            productor_id=self.productor.id,
            codigo_interno=f"P-{self._codigos}",
            nombre=nombre,
            rendimiento=rendimiento,
            **extra,
        )
        self.s.add(producto)
        self.s.commit()
        return producto

    def formular(self, producto: Producto, *ingredientes: Ingrediente) -> VersionProducto:
        """A new current version with those ingredients, in that order (the previous one stops being current)."""
        for anterior in self.s.scalars(select(VersionProducto).where(VersionProducto.producto_id == producto.id)):
            anterior.vigente = False
        numero = self._versiones.get(producto.id, 0) + 1
        self._versiones[producto.id] = numero
        version = VersionProducto(producto_id=producto.id, numero_version=numero, descripcion=f"v{numero}", vigente=True)
        self.s.add(version)
        self.s.flush()
        for orden, ingrediente in enumerate(ingredientes, start=1):
            self.s.add(
                FormulacionVersionProducto(
                    version_producto_id=version.id,
                    ingrediente_id=ingrediente.id,
                    orden=orden,
                    ingrediente_nombre=ingrediente.nombre,
                )
            )
        self.s.commit()
        return version

    def cantidad(self, producto: Producto, ingrediente: Ingrediente, cantidad: str, unidad: str) -> None:
        self.s.add(
            CantidadIngredienteProducto(
                producto_id=producto.id, ingrediente_id=ingrediente.id, cantidad=D(cantidad), unidad=unidad
            )
        )
        self.s.commit()

    def otro_costo(self, producto: Producto, nombre: str, monto: str, orden: int = 1) -> None:
        self.s.add(OtroCostoProducto(producto_id=producto.id, nombre=nombre, monto=D(monto), orden=orden))
        self.s.commit()

    def insumo(
        self,
        ingrediente: Ingrediente,
        nombre: str,
        *,
        precio: str | None = None,
        contenido: str | None = None,
        unidad: str | None = None,
        habitual: bool = False,
        activo: bool = True,
        fecha: datetime = HOY,
        productor: Productor | None = None,
    ) -> InsumoComercial:
        datos: dict = {}
        if precio is not None:
            datos.update(precio_referencia=D(precio), precio_fuente="manual", precio_fecha=fecha)
        if contenido is not None:
            assert unidad is not None
            datos.update(contenido_cantidad=D(contenido), contenido_unidad=unidad, contenido_fuente="manual")
        insumo = InsumoComercial(
            productor_id=(productor or self.productor).id,
            ingrediente_id=ingrediente.id,
            nombre=nombre,
            marca_origen="Marca",
            habitual=habitual,
            activo=activo,
            **datos,
        )
        self.s.add(insumo)
        self.s.commit()
        return insumo

    def elaboracion(
        self,
        producto: Producto,
        version: VersionProducto,
        usos: dict[Ingrediente, InsumoComercial],
        *,
        dia: int = 1,
        estado: str = "finalizada",
    ) -> Elaboracion:
        self._codigos += 1
        # Like the real flow (and the PostgreSQL triggers demand): born as a borrador, with its uses and the
        # preserved information written BEFORE it becomes finalizada.
        elaboracion = Elaboracion(
            productor_id=self.productor.id,
            producto_id=producto.id,
            version_producto_id=version.id,
            codigo=f"E-{self._codigos}",
            fecha_elaboracion=date(2026, 10, dia),
        )
        self.s.add(elaboracion)
        self.s.flush()
        for ingrediente, insumo in usos.items():
            self.s.add(
                UsoInsumo(
                    elaboracion_id=elaboracion.id,
                    ingrediente_id=ingrediente.id,
                    insumo_id=insumo.id,
                    sin_lote=True,
                    informacion_conservada={"nombre": insumo.nombre} if estado == "finalizada" else None,
                )
            )
        self.s.flush()
        if estado == "finalizada":
            elaboracion.estado = "finalizada"
            elaboracion.finalizada_at = HOY + timedelta(days=dia)
        self.s.commit()
        return elaboracion


@pytest.fixture
def e(db_session: Session) -> Escenario:
    return Escenario(db_session)


def _utc(momento: datetime) -> datetime:
    """The same instant without time zone: SQLite gives naive datetimes, PostgreSQL aware ones."""
    if momento.tzinfo is None:
        return momento
    return momento.astimezone(timezone.utc).replace(tzinfo=None)


def _servicio(session: Session) -> CostosService:
    return CostosService(session)


def _linea(calculo, ingrediente: Ingrediente):
    return next(linea for linea in calculo.lineas if linea.ingrediente_id == ingrediente.id)


def _foto(session: Session) -> dict[str, list]:
    """Every row of the tables the calculation must not change."""
    session.expire_all()
    tablas = [
        "productos",
        "versiones_producto",
        "versiones_producto_formulacion",
        "elaboraciones",
        "usos_insumo",
        "insumos_comerciales",
        "producto_ingrediente_cantidades",
        "producto_otros_costos",
    ]
    return {
        nombre: sorted(
            (tuple(fila) for fila in session.execute(select(Base.metadata.tables[nombre]))),
            key=lambda fila: fila[0],
        )
        for nombre in tablas
    }


def _caso_completo(e: Escenario, rendimiento: int | None = 8):
    """Harina 250 g (1 kg a $1.000), leche 200 ml (1 L a $1.100), huevo 3 un (12 un a $3.000) y $30,50 de otros costos."""
    harina, leche, huevo = e.ingrediente("Harina"), e.ingrediente("Leche"), e.ingrediente("Huevo")
    producto = e.producto(rendimiento=rendimiento)
    e.formular(producto, harina, leche, huevo)
    e.cantidad(producto, harina, "250", "g")
    e.cantidad(producto, leche, "200", "ml")
    e.cantidad(producto, huevo, "3", "unidad")
    e.insumo(harina, "Harina 1 kg", precio="1000", contenido="1", unidad="kg", habitual=True)
    e.insumo(leche, "Leche 1 L", precio="1100", contenido="1", unidad="L", habitual=True)
    e.insumo(huevo, "Huevos x12", precio="3000", contenido="12", unidad="unidad", habitual=True)
    e.otro_costo(producto, "Gas", "30.5")
    return producto, harina, leche, huevo


# --- PT14-08 / PT14-11: costo completo, por tanda y por unidad ------------------------------------


def test_un_producto_completo_suma_las_lineas_y_los_otros_costos(db_session: Session, e: Escenario) -> None:
    producto, harina, leche, huevo = _caso_completo(e)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert [linea.ingrediente_nombre for linea in calculo.lineas] == ["Harina", "Leche", "Huevo"]
    assert _linea(calculo, harina).costo == D("250")
    assert _linea(calculo, leche).costo == D("220")
    assert _linea(calculo, huevo).costo == D("750")
    resumen = calculo.resumen
    assert resumen.completo is True
    assert resumen.lineas_incompletas == 0
    assert resumen.total_ingredientes == D("1220")
    assert resumen.total_otros_costos == D("30.5")
    assert resumen.costo_tanda == D("1250.5")
    assert all(isinstance(valor, Decimal) for valor in (resumen.total_ingredientes, resumen.costo_tanda))


def test_con_rendimiento_8_el_costo_por_unidad_es_la_tanda_entre_8(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e, rendimiento=8)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert calculo.rendimiento == 8
    assert calculo.resumen.costo_tanda == D("1250.5")
    assert calculo.resumen.costo_unidad == D("156.3125")


def test_sin_rendimiento_solo_hay_costo_por_tanda(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e, rendimiento=None)

    resumen = _servicio(db_session).calcular(e.productor.id, producto.id).resumen

    assert resumen.completo is True
    assert resumen.costo_tanda == D("1250.5")
    assert resumen.costo_unidad is None


def test_la_division_por_el_rendimiento_no_pierde_decimales(db_session: Session, e: Escenario) -> None:
    ingrediente = e.ingrediente("Azúcar")
    producto = e.producto(rendimiento=3)
    e.formular(producto, ingrediente)
    e.cantidad(producto, ingrediente, "1", "unidad")
    e.insumo(ingrediente, "Azúcar", precio="100", contenido="1", unidad="unidad", habitual=True)

    resumen = _servicio(db_session).calcular(e.productor.id, producto.id).resumen

    assert resumen.costo_tanda == D("100")
    assert resumen.costo_unidad == D("33.3333")


# --- PT14-09 / PT14-12: faltantes ---------------------------------------------------------------


def test_receta_en_ml_con_insumo_en_kg_es_unidades_incompatibles_y_sin_total(
    db_session: Session, e: Escenario
) -> None:
    leche = e.ingrediente("Leche")
    producto = e.producto(rendimiento=4)
    e.formular(producto, leche)
    e.cantidad(producto, leche, "200", "ml")
    e.insumo(leche, "Leche en polvo 1 kg", precio="5000", contenido="1", unidad="kg", habitual=True)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    linea = _linea(calculo, leche)
    assert linea.faltantes == [FALTA_UNIDADES]
    assert linea.costo is None
    assert calculo.resumen.completo is False
    assert calculo.resumen.lineas_incompletas == 1
    assert calculo.resumen.total_ingredientes is None
    assert calculo.resumen.costo_tanda is None
    assert calculo.resumen.costo_unidad is None


def test_cada_faltante_se_indica_en_su_linea_y_no_hay_total(db_session: Session, e: Escenario) -> None:
    harina, leche, huevo, sal = (e.ingrediente(n) for n in ("Harina", "Leche", "Huevo", "Sal"))
    producto = e.producto(rendimiento=8)
    e.formular(producto, harina, leche, huevo, sal)
    # Harina: complete. Leche: no quantity. Huevo: supply with no price. Sal: no supply at all.
    for ingrediente, cantidad, unidad in ((harina, "250", "g"), (huevo, "3", "unidad"), (sal, "5", "g")):
        e.cantidad(producto, ingrediente, cantidad, unidad)
    e.insumo(harina, "Harina", precio="1000", contenido="1", unidad="kg", habitual=True)
    e.insumo(leche, "Leche", precio="1100", contenido="1", unidad="L", habitual=True)
    e.insumo(huevo, "Huevos", contenido="12", unidad="unidad", habitual=True)
    e.otro_costo(producto, "Gas", "100")

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert _linea(calculo, harina).faltantes == []
    assert _linea(calculo, harina).costo == D("250")
    assert _linea(calculo, leche).faltantes == [FALTA_CANTIDAD]
    assert _linea(calculo, huevo).faltantes == [FALTA_PRECIO]
    assert _linea(calculo, sal).faltantes == [FALTA_INSUMO]
    resumen = calculo.resumen
    assert resumen.lineas_incompletas == 3
    assert resumen.total_ingredientes is None
    assert resumen.costo_tanda is None
    assert resumen.costo_unidad is None
    # The other costs are always there.
    assert resumen.total_otros_costos == D("100")


def test_una_linea_puede_tener_varios_faltantes_a_la_vez(db_session: Session, e: Escenario) -> None:
    sin_nada, sin_precio_ni_contenido = e.ingrediente("Sal"), e.ingrediente("Azúcar")
    producto = e.producto()
    e.formular(producto, sin_nada, sin_precio_ni_contenido)
    e.cantidad(producto, sin_precio_ni_contenido, "5", "g")
    e.insumo(sin_precio_ni_contenido, "Azúcar", habitual=True)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert _linea(calculo, sin_nada).faltantes == [FALTA_CANTIDAD, FALTA_INSUMO]
    assert _linea(calculo, sin_precio_ni_contenido).faltantes == [FALTA_PRECIO, FALTA_CONTENIDO]


def test_con_faltantes_nunca_hay_total_parcial_pero_si_los_otros_costos(db_session: Session, e: Escenario) -> None:
    harina, leche = e.ingrediente("Harina"), e.ingrediente("Leche")
    producto = e.producto(rendimiento=2)
    e.formular(producto, harina, leche)
    e.cantidad(producto, harina, "250", "g")
    e.insumo(harina, "Harina", precio="1000", contenido="1", unidad="kg", habitual=True)
    e.otro_costo(producto, "Gas", "10", orden=1)
    e.otro_costo(producto, "Caja", "5.25", orden=2)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert _linea(calculo, harina).costo == D("250")
    assert calculo.resumen.total_ingredientes is None
    assert calculo.resumen.costo_tanda is None
    assert calculo.resumen.costo_unidad is None
    assert calculo.resumen.total_otros_costos == D("15.25")
    assert [(otro.nombre, otro.monto) for otro in calculo.otros_costos] == [("Gas", D("10")), ("Caja", D("5.25"))]


def test_un_precio_cero_es_un_costo_valido_no_un_faltante(db_session: Session, e: Escenario) -> None:
    agua = e.ingrediente("Agua")
    producto = e.producto()
    e.formular(producto, agua)
    e.cantidad(producto, agua, "500", "ml")
    e.insumo(agua, "Agua de la llave", precio="0", contenido="1", unidad="L", habitual=True)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert _linea(calculo, agua).faltantes == []
    assert calculo.resumen.costo_tanda == D("0")


def test_sin_formulacion_no_hay_lineas_ni_totales_pero_si_otros_costos(db_session: Session, e: Escenario) -> None:
    producto = e.producto(rendimiento=4)
    e.otro_costo(producto, "Gas", "10")

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert calculo.tiene_formulacion is False
    assert calculo.lineas == []
    assert calculo.resumen.completo is False
    assert calculo.resumen.costo_tanda is None
    assert calculo.resumen.costo_unidad is None
    assert calculo.resumen.total_otros_costos == D("10")


# --- PT14-02: la versión vigente -----------------------------------------------------------------


def test_un_ingrediente_nuevo_en_otra_version_aparece_y_uno_de_la_anterior_no(
    db_session: Session, e: Escenario
) -> None:
    harina, leche, huevo = e.ingrediente("Harina"), e.ingrediente("Leche"), e.ingrediente("Huevo")
    producto = e.producto()
    e.formular(producto, harina, leche)
    e.cantidad(producto, leche, "200", "ml")
    servicio = _servicio(db_session)
    assert [linea.ingrediente_id for linea in servicio.calcular(e.productor.id, producto.id).lineas] == [
        harina.id,
        leche.id,
    ]

    e.formular(producto, harina, huevo)  # a new current version: leche leaves, huevo enters

    calculo = servicio.calcular(e.productor.id, producto.id)
    assert [linea.ingrediente_id for linea in calculo.lineas] == [harina.id, huevo.id]
    # The saved quantity of the ingredient that left is kept in the table but ignored.
    assert db_session.scalar(
        select(CantidadIngredienteProducto.cantidad).where(CantidadIngredienteProducto.ingrediente_id == leche.id)
    ) == D("200")


def test_las_lineas_siguen_el_orden_de_la_formulacion(db_session: Session, e: Escenario) -> None:
    a, b, c = e.ingrediente("A"), e.ingrediente("B"), e.ingrediente("C")
    producto = e.producto()
    e.formular(producto, c, a, b)

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    assert [linea.ingrediente_nombre for linea in calculo.lineas] == ["C", "A", "B"]


# --- PT14-03: preselección ----------------------------------------------------------------------


def _harina_con_tres_insumos(e: Escenario):
    harina = e.ingrediente("Harina")
    producto = e.producto()
    version = e.formular(producto, harina)
    e.cantidad(producto, harina, "250", "g")
    habitual = e.insumo(harina, "Harina habitual", precio="1000", contenido="1", unidad="kg", habitual=True)
    usada = e.insumo(harina, "Harina integral", precio="2000", contenido="1", unidad="kg")
    return harina, producto, version, habitual, usada


def test_preselecciona_el_insumo_de_la_ultima_finalizada_aunque_no_sea_el_habitual(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    e.elaboracion(producto, version, {harina: usada})

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id)

    linea = _linea(calculo, harina)
    assert linea.insumo_id == usada.id
    assert linea.origen_insumo == ORIGEN_ULTIMA_ELABORACION
    assert linea.aviso_insumo is None
    assert linea.costo == D("500")  # 250 g of a $2.000 kilo


def test_sin_elaboraciones_preselecciona_el_habitual(db_session: Session, e: Escenario) -> None:
    harina, producto, _, habitual, _ = _harina_con_tres_insumos(e)

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id == habitual.id
    assert linea.origen_insumo == ORIGEN_HABITUAL
    assert linea.costo == D("250")


def test_sin_habitual_ni_elaboraciones_no_hay_insumo(db_session: Session, e: Escenario) -> None:
    harina = e.ingrediente("Harina")
    producto = e.producto()
    e.formular(producto, harina)
    e.cantidad(producto, harina, "250", "g")
    e.insumo(harina, "Harina sin marcar", precio="1000", contenido="1", unidad="kg")

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id is None
    assert linea.origen_insumo is None
    assert linea.aviso_insumo is None
    assert linea.faltantes == [FALTA_INSUMO]


def test_un_insumo_inactivo_de_la_ultima_cae_al_habitual_y_lo_avisa(db_session: Session, e: Escenario) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    e.elaboracion(producto, version, {harina: usada})
    usada.activo = False
    db_session.commit()

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id == habitual.id
    assert linea.origen_insumo == ORIGEN_HABITUAL
    assert linea.aviso_insumo == AVISO_ULTIMO_INACTIVO
    assert usada.id not in [i.id for i in linea.insumos_disponibles]


def test_un_insumo_de_la_ultima_que_hoy_es_de_otro_ingrediente_cae_al_habitual_y_lo_avisa(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    azucar = e.ingrediente("Azúcar")
    e.elaboracion(producto, version, {harina: usada})
    usada.ingrediente_id = azucar.id
    db_session.commit()

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id == habitual.id
    assert linea.aviso_insumo == AVISO_ULTIMO_INACTIVO


def test_un_insumo_inactivo_de_la_ultima_sin_habitual_deja_la_linea_sin_insumo_con_aviso(
    db_session: Session, e: Escenario
) -> None:
    harina = e.ingrediente("Harina")
    producto = e.producto()
    version = e.formular(producto, harina)
    e.cantidad(producto, harina, "250", "g")
    usada = e.insumo(harina, "Harina", precio="1000", contenido="1", unidad="kg", activo=False)
    e.elaboracion(producto, version, {harina: usada})

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id is None
    assert linea.aviso_insumo == AVISO_ULTIMO_INACTIVO
    assert linea.faltantes == [FALTA_INSUMO]


def test_la_ultima_es_por_fecha_de_elaboracion_y_no_cuentan_borradores_ni_otros_productos(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    otra = e.insumo(harina, "Harina otra", precio="3000", contenido="1", unidad="kg")
    e.elaboracion(producto, version, {harina: otra}, dia=2)  # older
    e.elaboracion(producto, version, {harina: usada}, dia=9)  # the last finalized
    e.elaboracion(producto, version, {harina: otra}, dia=20, estado="borrador")  # a borrador never counts
    otro_producto = e.producto("Otro queque")
    version_otro = e.formular(otro_producto, harina)
    e.elaboracion(otro_producto, version_otro, {harina: otra}, dia=25)  # another product never counts

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id == usada.id
    assert linea.origen_insumo == ORIGEN_ULTIMA_ELABORACION


def test_los_insumos_disponibles_son_los_activos_del_ingrediente_del_productor(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, _, habitual, usada = _harina_con_tres_insumos(e)
    e.insumo(harina, "Harina vieja", precio="1", contenido="1", unidad="kg", activo=False)
    otro = Escenario(db_session, "otro@ejemplo.com")
    e.insumo(harina, "Intruso", precio="1", contenido="1", unidad="kg", productor=otro.productor)

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert [i.nombre for i in linea.insumos_disponibles] == ["Harina habitual", "Harina integral"]
    assert [i.habitual for i in linea.insumos_disponibles] == [True, False]
    assert linea.insumos_disponibles[0].precio_referencia == D("1000")


# --- PT14-04: alternativas ----------------------------------------------------------------------


def test_la_alternativa_recalcula_y_no_se_guarda(db_session: Session, e: Escenario) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    e.elaboracion(producto, version, {harina: habitual})
    servicio = _servicio(db_session)
    antes = _foto(db_session)

    con_alternativa = servicio.calcular(e.productor.id, producto.id, {harina.id: usada.id})
    despues = _foto(db_session)
    sin_alternativa = servicio.calcular(e.productor.id, producto.id)

    linea = _linea(con_alternativa, harina)
    assert linea.insumo_id == usada.id
    assert linea.origen_insumo == ORIGEN_ELEGIDO
    assert linea.costo == D("500")
    assert con_alternativa.resumen.costo_tanda == D("500")
    assert despues == antes
    assert _linea(sin_alternativa, harina).insumo_id == habitual.id
    assert _linea(sin_alternativa, harina).origen_insumo == ORIGEN_ULTIMA_ELABORACION
    assert sin_alternativa.resumen.costo_tanda == D("250")


def test_una_alternativa_sin_precio_deja_la_linea_incompleta(db_session: Session, e: Escenario) -> None:
    harina, producto, _, _, _ = _harina_con_tres_insumos(e)
    sin_precio = e.insumo(harina, "Harina sin precio", contenido="1", unidad="kg")

    calculo = _servicio(db_session).calcular(e.productor.id, producto.id, {harina.id: sin_precio.id})

    assert _linea(calculo, harina).faltantes == [FALTA_PRECIO]
    assert calculo.resumen.costo_tanda is None


def test_una_alternativa_inactiva_es_un_error_de_validacion(db_session: Session, e: Escenario) -> None:
    harina, producto, *_ = _harina_con_tres_insumos(e)
    inactiva = e.insumo(harina, "Harina vieja", precio="1", contenido="1", unidad="kg", activo=False)

    with pytest.raises(CostosValidationError, match="inactivo"):
        _servicio(db_session).calcular(e.productor.id, producto.id, {harina.id: inactiva.id})


def test_una_alternativa_de_otro_ingrediente_es_un_error_de_validacion(db_session: Session, e: Escenario) -> None:
    harina, producto, *_ = _harina_con_tres_insumos(e)
    azucar = e.ingrediente("Azúcar")
    de_azucar = e.insumo(azucar, "Azúcar", precio="1", contenido="1", unidad="kg")

    with pytest.raises(CostosValidationError, match="no es del ingrediente"):
        _servicio(db_session).calcular(e.productor.id, producto.id, {harina.id: de_azucar.id})


def test_una_alternativa_de_otro_productor_o_inexistente_es_un_error_de_validacion(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, *_ = _harina_con_tres_insumos(e)
    otro = Escenario(db_session, "otro@ejemplo.com")
    ajeno = e.insumo(harina, "Ajeno", precio="1", contenido="1", unidad="kg", productor=otro.productor)

    for insumo_id in (ajeno.id, 99999):
        with pytest.raises(CostosValidationError, match="no existe"):
            _servicio(db_session).calcular(e.productor.id, producto.id, {harina.id: insumo_id})


def test_una_alternativa_para_un_ingrediente_fuera_de_la_formulacion_es_un_error(
    db_session: Session, e: Escenario
) -> None:
    harina, producto, *_ = _harina_con_tres_insumos(e)
    azucar = e.ingrediente("Azúcar")
    de_azucar = e.insumo(azucar, "Azúcar", precio="1", contenido="1", unidad="kg")

    with pytest.raises(CostosValidationError, match="formulación vigente"):
        _servicio(db_session).calcular(e.productor.id, producto.id, {azucar.id: de_azucar.id})


# --- PT14-14: nunca escribe ---------------------------------------------------------------------


def test_calcular_no_cambia_nada_de_la_base(db_session: Session, e: Escenario) -> None:
    producto, harina, leche, huevo = _caso_completo(e)
    version = e.formular(producto, harina, leche, huevo)
    usada = e.insumo(harina, "Harina integral", precio="2000", contenido="1", unidad="kg")
    e.elaboracion(producto, version, {harina: usada})
    antes = _foto(db_session)
    servicio = _servicio(db_session)

    servicio.calcular(e.productor.id, producto.id)
    servicio.calcular(e.productor.id, producto.id, {harina.id: usada.id})
    servicio.costo_calculado_por_unidad(e.productor.id, producto.id)

    assert _foto(db_session) == antes
    # What an elaboración preserved is exactly what it preserved.
    assert db_session.scalar(select(UsoInsumo.informacion_conservada)) == {"nombre": "Harina integral"}


def test_calcular_no_emite_ninguna_sentencia_de_escritura(db_session: Session, e: Escenario) -> None:
    producto, harina, *_ = _caso_completo(e)
    with _registrar(db_session) as sentencias:
        _servicio(db_session).calcular(e.productor.id, producto.id)

    assert sentencias
    assert [s for s in sentencias if not s.lstrip().upper().startswith("SELECT")] == []
    assert not db_session.new
    assert not db_session.dirty
    assert not db_session.deleted


def test_el_precio_mas_antiguo_es_el_de_los_insumos_usados_en_lineas_con_costo(
    db_session: Session, e: Escenario
) -> None:
    harina, leche, huevo = e.ingrediente("Harina"), e.ingrediente("Leche"), e.ingrediente("Huevo")
    producto = e.producto()
    e.formular(producto, harina, leche, huevo)
    e.cantidad(producto, harina, "250", "g")
    e.cantidad(producto, leche, "200", "ml")
    e.cantidad(producto, huevo, "3", "unidad")
    reciente = HOY
    medio = HOY - timedelta(days=10)
    muy_antiguo = HOY - timedelta(days=400)
    e.insumo(harina, "Harina", precio="1000", contenido="1", unidad="kg", habitual=True, fecha=medio)
    e.insumo(leche, "Leche", precio="1100", contenido="1", unidad="L", habitual=True, fecha=reciente)
    # An unused supply with an older price must not count.
    e.insumo(harina, "Harina vieja", precio="900", contenido="1", unidad="kg", fecha=muy_antiguo)
    # The egg line misses its content, so it has no cost: its (older) price date does not count either.
    e.insumo(huevo, "Huevos", precio="3000", habitual=True, fecha=muy_antiguo)

    resumen = _servicio(db_session).calcular(e.productor.id, producto.id).resumen

    assert resumen.completo is False
    assert resumen.precio_mas_antiguo is not None
    assert _utc(resumen.precio_mas_antiguo) == _utc(medio)


def test_el_precio_mas_antiguo_cambia_con_el_insumo_elegido(db_session: Session, e: Escenario) -> None:
    harina, producto, _, habitual, usada = _harina_con_tres_insumos(e)
    habitual.precio_fecha = HOY - timedelta(days=3)
    usada.precio_fecha = HOY - timedelta(days=30)
    db_session.commit()
    servicio = _servicio(db_session)

    base = servicio.calcular(e.productor.id, producto.id).resumen.precio_mas_antiguo
    elegido = servicio.calcular(e.productor.id, producto.id, {harina.id: usada.id}).resumen.precio_mas_antiguo

    assert base is not None and elegido is not None
    assert _utc(base) == _utc(HOY - timedelta(days=3))
    assert _utc(elegido) == _utc(HOY - timedelta(days=30))


# --- el costo calculado del detalle (D6) -----------------------------------------------------------


def test_el_costo_calculado_es_el_costo_por_unidad_cuando_esta_completo(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e, rendimiento=8)

    assert _servicio(db_session).costo_calculado_por_unidad(e.productor.id, producto.id) == D("156.3125")


def test_el_costo_calculado_es_none_si_falta_un_dato(db_session: Session, e: Escenario) -> None:
    producto, harina, *_ = _caso_completo(e, rendimiento=8)
    insumo = db_session.scalar(select(InsumoComercial).where(InsumoComercial.ingrediente_id == harina.id))
    insumo.precio_referencia = None
    insumo.precio_fuente = None
    insumo.precio_fecha = None
    db_session.commit()

    assert _servicio(db_session).costo_calculado_por_unidad(e.productor.id, producto.id) is None


def test_el_costo_calculado_es_none_sin_rendimiento(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e, rendimiento=None)

    assert _servicio(db_session).costo_calculado_por_unidad(e.productor.id, producto.id) is None


def test_el_costo_calculado_es_none_sin_formulacion(db_session: Session, e: Escenario) -> None:
    producto = e.producto(rendimiento=4)

    assert _servicio(db_session).costo_calculado_por_unidad(e.productor.id, producto.id) is None


def test_el_costo_calculado_usa_la_preseleccion(db_session: Session, e: Escenario) -> None:
    harina, producto, version, habitual, usada = _harina_con_tres_insumos(e)
    producto.rendimiento = 5
    db_session.commit()
    e.elaboracion(producto, version, {harina: usada})

    assert _servicio(db_session).costo_calculado_por_unidad(e.productor.id, producto.id) == D("100")


# --- aislamiento ---------------------------------------------------------------------------------


def test_un_producto_de_otro_productor_o_inexistente_es_no_encontrado(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e)
    otro = Escenario(db_session, "otro@ejemplo.com")

    with pytest.raises(ProductoNotFoundError):
        _servicio(db_session).calcular(otro.productor.id, producto.id)
    with pytest.raises(ProductoNotFoundError):
        _servicio(db_session).calcular(e.productor.id, 99999)
    with pytest.raises(ProductoNotFoundError):
        _servicio(db_session).costo_calculado_por_unidad(otro.productor.id, producto.id)


def test_un_producto_dado_de_baja_es_no_encontrado(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e)
    producto.activo = False
    db_session.commit()

    with pytest.raises(ProductoNotFoundError):
        _servicio(db_session).calcular(e.productor.id, producto.id)


def test_los_insumos_y_cantidades_de_otro_productor_no_entran_al_calculo(db_session: Session, e: Escenario) -> None:
    harina = e.ingrediente("Harina")
    producto = e.producto()
    e.formular(producto, harina)
    e.cantidad(producto, harina, "250", "g")
    otro = Escenario(db_session, "otro@ejemplo.com")
    e.insumo(harina, "Habitual ajeno", precio="1", contenido="1", unidad="kg", habitual=True, productor=otro.productor)

    linea = _linea(_servicio(db_session).calcular(e.productor.id, producto.id), harina)

    assert linea.insumo_id is None
    assert linea.faltantes == [FALTA_INSUMO]


# --- consultas ----------------------------------------------------------------------------------


@contextmanager
def _registrar(session: Session):
    """The statements the session's engine runs while the block lasts."""
    sentencias: list[str] = []

    def alguardar(conn, cursor, statement, parameters, context, executemany):
        sentencias.append(statement)

    motor = session.get_bind()
    event.listen(motor, "before_cursor_execute", alguardar)
    try:
        yield sentencias
    finally:
        event.remove(motor, "before_cursor_execute", alguardar)


def _escenario_con_n_lineas(session: Session, n: int, email: str) -> tuple[Escenario, Producto]:
    e = Escenario(session, email)
    producto = e.producto(rendimiento=4)
    ingredientes = [e.ingrediente(f"Ingrediente {i}") for i in range(n)]
    version = e.formular(producto, *ingredientes)
    usos = {}
    for ingrediente in ingredientes:
        e.cantidad(producto, ingrediente, "100", "g")
        habitual = e.insumo(ingrediente, f"H {ingrediente.nombre}", precio="1000", contenido="1", unidad="kg", habitual=True)
        usado = e.insumo(ingrediente, f"U {ingrediente.nombre}", precio="2000", contenido="1", unidad="kg")
        usos[ingrediente] = usado
    e.elaboracion(producto, version, usos)
    e.otro_costo(producto, "Gas", "10")
    return e, producto


def _consultas_de(session: Session, e: Escenario, producto: Producto, **kwargs) -> int:
    ids = (e.productor.id, producto.id)
    session.expire_all()
    with _registrar(session) as sentencias:
        _servicio(session).calcular(*ids, **kwargs)
    return len(sentencias)


def test_el_numero_de_consultas_es_el_mismo_con_2_y_con_8_lineas(db_session: Session) -> None:
    e2, producto2 = _escenario_con_n_lineas(db_session, 2, "dos@ejemplo.com")
    e8, producto8 = _escenario_con_n_lineas(db_session, 8, "ocho@ejemplo.com")

    con_2 = _consultas_de(db_session, e2, producto2)
    con_8 = _consultas_de(db_session, e8, producto8)

    assert con_2 == con_8 == 8


def test_el_numero_de_consultas_tampoco_depende_de_las_alternativas(db_session: Session) -> None:
    e8, producto8 = _escenario_con_n_lineas(db_session, 8, "ocho@ejemplo.com")
    alternativas = {
        ingrediente_id: insumo_id
        for ingrediente_id, insumo_id in db_session.execute(
            select(InsumoComercial.ingrediente_id, InsumoComercial.id).where(InsumoComercial.habitual.is_(True))
        )
    }

    assert _consultas_de(db_session, e8, producto8, alternativas=alternativas) == 8


def test_consultas_sin_elaboracion_finalizada_y_sin_formulacion(db_session: Session, e: Escenario) -> None:
    producto, *_ = _caso_completo(e)
    vacio = e.producto("Sin formular")

    assert _consultas_de(db_session, e, producto) == 7  # no elaboración: its uses are not read
    assert _consultas_de(db_session, e, vacio) == 3
