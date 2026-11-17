"""Cost calculator of a product (HU14 / T14-04). It only reads: it never writes anything.

The lines come from the CURRENT version of the formulation. Each one takes its quantity from
`producto_ingrediente_cantidades` and its supply from, in this order: what the last finalized
elaboración of the product used (the HU05 criterion, which is not the "Predeterminada" of HU06/HU10),
the active habitual supply of the ingredient, or none. A chosen alternative is only for this
calculation: nothing is saved.
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core import costos_calculo
from app.repositories.costos_repository import (
    CantidadGuardada,
    CostosRepository,
    InsumoDeCosto,
    OtroCostoGuardado,
)
from app.repositories.elaboracion_repository import ElaboracionRepository
from app.services.producto_service import ProductoNotFoundError

# Where the supply of a line comes from.
ORIGEN_ULTIMA_ELABORACION = "ultima_elaboracion"
ORIGEN_HABITUAL = "habitual"
ORIGEN_ELEGIDO = "elegido"

# The supply of the last elaboración could not be used (it is inactive or it now belongs to another ingredient).
AVISO_ULTIMO_INACTIVO = "ultimo_inactivo"

FALTA_CANTIDAD = "sin_cantidad"
FALTA_INSUMO = "sin_insumo"
FALTA_PRECIO = "insumo_sin_precio"
FALTA_CONTENIDO = "insumo_sin_contenido"
FALTA_UNIDADES = "unidades_incompatibles"


class CostosValidationError(Exception):
    """A chosen alternative is not valid (the endpoint answers 422)."""


@dataclass(frozen=True)
class InsumoDisponible:
    id: int
    nombre: str
    marca_origen: str
    habitual: bool
    precio_referencia: Decimal | None
    contenido_cantidad: Decimal | None
    contenido_unidad: str | None


@dataclass(frozen=True)
class LineaCosto:
    ingrediente_id: int
    ingrediente_nombre: str
    cantidad: Decimal | None
    unidad: str | None
    insumo_id: int | None
    insumo_nombre: str | None
    origen_insumo: str | None
    aviso_insumo: str | None
    precio_referencia: Decimal | None
    precio_fecha: datetime | None
    contenido_cantidad: Decimal | None
    contenido_unidad: str | None
    faltantes: list[str]
    costo: Decimal | None
    insumos_disponibles: list[InsumoDisponible] = field(default_factory=list)


@dataclass(frozen=True)
class ResumenCosto:
    completo: bool
    lineas_incompletas: int
    total_ingredientes: Decimal | None
    total_otros_costos: Decimal
    costo_tanda: Decimal | None
    costo_unidad: Decimal | None
    precio_mas_antiguo: datetime | None


@dataclass(frozen=True)
class CalculoCostos:
    producto_id: int
    tiene_formulacion: bool
    rendimiento: int | None
    lineas: list[LineaCosto]
    otros_costos: list[OtroCostoGuardado]
    resumen: ResumenCosto


class CostosService:
    def __init__(self, db: Session) -> None:
        self.repository = CostosRepository(db)
        self.elaboraciones = ElaboracionRepository(db)

    def calcular(
        self,
        productor_id: int,
        producto_id: int,
        alternativas: dict[int, int] | None = None,
    ) -> CalculoCostos:
        """The calculation of an owned product. `alternativas` maps ingrediente_id -> insumo_id.

        Queries: at most 8 whatever the number of lines (product, current version, lines, quantities,
        other costs, last elaboración, its uses, supplies); 7 when the product has no finalized
        elaboración and 3 when it has no formulation.
        """
        alternativas = alternativas or {}
        repo = self.repository
        producto = repo.get_producto(producto_id, productor_id)
        if producto is None:
            raise ProductoNotFoundError("Producto no encontrado")
        rendimiento = producto.rendimiento

        version_id = repo.get_version_vigente_id(producto_id)
        formulacion = repo.lineas_formulacion(version_id) if version_id is not None else []
        otros = repo.otros_costos(producto_id)
        total_otros = costos_calculo.sumar([otro.monto for otro in otros])

        if not formulacion:
            if alternativas:
                raise CostosValidationError("El producto no tiene ingredientes en la formulación vigente")
            return CalculoCostos(
                producto_id=producto_id,
                tiene_formulacion=False,
                rendimiento=rendimiento,
                lineas=[],
                otros_costos=otros,
                resumen=ResumenCosto(False, 0, None, total_otros, None, None, None),
            )

        ingrediente_ids = [linea.ingrediente_id for linea in formulacion]
        cantidades = repo.cantidades(producto_id)
        anteriores = self.elaboraciones.usos_de_la_ultima_finalizada(productor_id, producto_id)
        pedidos = {
            uso.insumo_id for uso in anteriores.values() if uso.insumo_id is not None
        } | set(alternativas.values())
        insumos = {
            insumo.id: insumo
            for insumo in repo.insumos_para_costos(productor_id, ingrediente_ids, sorted(pedidos))
        }
        self._validar_alternativas(alternativas, ingrediente_ids, insumos)

        disponibles: dict[int, list[InsumoDeCosto]] = {ingrediente_id: [] for ingrediente_id in ingrediente_ids}
        for insumo in insumos.values():
            if insumo.activo and insumo.ingrediente_id in disponibles:
                disponibles[insumo.ingrediente_id].append(insumo)

        lineas = [
            self._linea(
                linea.ingrediente_id,
                linea.ingrediente_nombre,
                cantidades.get(linea.ingrediente_id),
                insumos,
                disponibles[linea.ingrediente_id],
                anteriores.get(linea.ingrediente_id),
                alternativas.get(linea.ingrediente_id),
            )
            for linea in formulacion
        ]
        return CalculoCostos(
            producto_id=producto_id,
            tiene_formulacion=True,
            rendimiento=rendimiento,
            lineas=lineas,
            otros_costos=otros,
            resumen=self._resumen(lineas, total_otros, rendimiento),
        )

    def costo_calculado_por_unidad(self, productor_id: int, producto_id: int) -> Decimal | None:
        """Cost per unit for the product detail (D6): the preselection with no alternatives.

        None when the calculation is not complete or the product has no rendimiento.
        """
        return self.calcular(productor_id, producto_id).resumen.costo_unidad

    @staticmethod
    def _validar_alternativas(
        alternativas: dict[int, int],
        ingrediente_ids: list[int],
        insumos: dict[int, InsumoDeCosto],
    ) -> None:
        for ingrediente_id, insumo_id in alternativas.items():
            if ingrediente_id not in ingrediente_ids:
                raise CostosValidationError(
                    f"El ingrediente {ingrediente_id} no está en la formulación vigente del producto"
                )
            insumo = insumos.get(insumo_id)
            # A supply of another productor is not even loaded: it looks exactly like one that does not exist.
            if insumo is None:
                raise CostosValidationError(f"El insumo {insumo_id} no existe")
            if insumo.ingrediente_id != ingrediente_id:
                raise CostosValidationError(f"El insumo {insumo_id} no es del ingrediente {ingrediente_id}")
            if not insumo.activo:
                raise CostosValidationError(f"El insumo {insumo_id} está inactivo")

    @staticmethod
    def _preseleccion(
        ingrediente_id: int,
        insumos: dict[int, InsumoDeCosto],
        disponibles: list[InsumoDeCosto],
        anterior: object | None,
        alternativa: int | None,
    ) -> tuple[InsumoDeCosto | None, str | None, str | None]:
        """(supply, origin, notice) of a line."""
        aviso = None
        anterior_id = getattr(anterior, "insumo_id", None)
        if anterior_id is not None:
            candidato = insumos.get(anterior_id)
            if candidato is None or not candidato.activo or candidato.ingrediente_id != ingrediente_id:
                aviso = AVISO_ULTIMO_INACTIVO
        if alternativa is not None:
            return insumos[alternativa], ORIGEN_ELEGIDO, aviso
        if anterior_id is not None and aviso is None:
            return insumos[anterior_id], ORIGEN_ULTIMA_ELABORACION, None
        for insumo in disponibles:
            if insumo.habitual:
                return insumo, ORIGEN_HABITUAL, aviso
        return None, None, aviso

    def _linea(
        self,
        ingrediente_id: int,
        ingrediente_nombre: str,
        guardada: CantidadGuardada | None,
        insumos: dict[int, InsumoDeCosto],
        disponibles: list[InsumoDeCosto],
        anterior: object | None,
        alternativa: int | None,
    ) -> LineaCosto:
        insumo, origen, aviso = self._preseleccion(ingrediente_id, insumos, disponibles, anterior, alternativa)

        faltantes: list[str] = []
        if guardada is None:
            faltantes.append(FALTA_CANTIDAD)
        if insumo is None:
            faltantes.append(FALTA_INSUMO)
        else:
            if insumo.precio_referencia is None:
                faltantes.append(FALTA_PRECIO)
            if insumo.contenido_cantidad is None or insumo.contenido_unidad is None:
                faltantes.append(FALTA_CONTENIDO)
            elif guardada is not None and not costos_calculo.son_compatibles(
                guardada.unidad, insumo.contenido_unidad
            ):
                faltantes.append(FALTA_UNIDADES)

        costo = None
        if not faltantes:
            assert guardada is not None and insumo is not None
            assert insumo.precio_referencia is not None
            assert insumo.contenido_cantidad is not None and insumo.contenido_unidad is not None
            costo = costos_calculo.costo_linea(
                guardada.cantidad,
                guardada.unidad,
                insumo.precio_referencia,
                insumo.contenido_cantidad,
                insumo.contenido_unidad,
            )

        return LineaCosto(
            ingrediente_id=ingrediente_id,
            ingrediente_nombre=ingrediente_nombre,
            cantidad=guardada.cantidad if guardada else None,
            unidad=guardada.unidad if guardada else None,
            insumo_id=insumo.id if insumo else None,
            insumo_nombre=insumo.nombre if insumo else None,
            origen_insumo=origen,
            aviso_insumo=aviso,
            precio_referencia=insumo.precio_referencia if insumo else None,
            precio_fecha=insumo.precio_fecha if insumo else None,
            contenido_cantidad=insumo.contenido_cantidad if insumo else None,
            contenido_unidad=insumo.contenido_unidad if insumo else None,
            faltantes=faltantes,
            costo=costo,
            insumos_disponibles=[
                InsumoDisponible(
                    id=i.id,
                    nombre=i.nombre,
                    marca_origen=i.marca_origen,
                    habitual=i.habitual,
                    precio_referencia=i.precio_referencia,
                    contenido_cantidad=i.contenido_cantidad,
                    contenido_unidad=i.contenido_unidad,
                )
                for i in sorted(disponibles, key=lambda i: (i.nombre.lower(), i.id))
            ],
        )

    @staticmethod
    def _resumen(lineas: list[LineaCosto], total_otros: Decimal, rendimiento: int | None) -> ResumenCosto:
        incompletas = sum(1 for linea in lineas if linea.faltantes)
        completo = incompletas == 0
        total_ingredientes = (
            costos_calculo.sumar([linea.costo for linea in lineas if linea.costo is not None]) if completo else None
        )
        costo_tanda = (
            costos_calculo.sumar([total_ingredientes, total_otros]) if total_ingredientes is not None else None
        )
        costo_unidad = (
            costos_calculo.dividir(costo_tanda, rendimiento)
            if costo_tanda is not None and rendimiento
            else None
        )
        # Only the supplies of lines that have a cost count for the oldest price.
        fechas = [linea.precio_fecha for linea in lineas if linea.costo is not None and linea.precio_fecha]
        return ResumenCosto(
            completo=completo,
            lineas_incompletas=incompletas,
            total_ingredientes=total_ingredientes,
            total_otros_costos=total_otros,
            costo_tanda=costo_tanda,
            costo_unidad=costo_unidad,
            precio_mas_antiguo=min(fechas) if fechas else None,
        )
