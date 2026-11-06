from collections.abc import Callable
from dataclasses import replace
from datetime import datetime, timezone

from app.core.codigo_barras import normalizar_codigo_barras, validar_codigo_barras
from app.models import Productor
from app.repositories.insumo_repository import InsumoRepository
from app.schemas.consulta_codigo import (
    AlergenoSugeridoRead,
    AlergenosSugeridosRead,
    ConsultaCodigoRead,
    ProductoPropuestoRead,
    ResultadoBusquedaRead,
)
from app.services.insumo_service import DuplicateCodigoBarrasError
from app.services.recuperacion.alergenos import AlergenoDetectado, Deteccion, detectar_alergenos
from app.services.recuperacion.base import FuenteBusquedaNombre, FuenteNoDisponibleError, FuenteProducto
from app.services.recuperacion.combinacion import combinar_alergenos
from app.services.recuperacion.limpieza import limpiar_ingredientes
from app.services.recuperacion.modelos import ProductoFuente, ResultadoBusqueda

Detector = Callable[[tuple[str, ...], tuple[str, ...], str | None], Deteccion]


# The fields of the proposal whose source is reported (`fuentes_campos` also carries allergen inputs).
FUENTE_JUMBO = "jumbo"
CAMPOS_DEL_PRODUCTO = frozenset(
    {"nombre", "marca_origen", "presentacion", "ingredientes_declarados"}
)


class CodigoInvalidoError(ValueError):
    """The barcode is not a valid EAN-8, UPC-A or EAN-13 (422)."""


class BusquedaInvalidaError(ValueError):
    """The text to search, or the id of a result, is not usable (422)."""


class ResultadoNoDisponibleError(LookupError):
    """The result no longer exists in the source (404): the productor can enter it by hand."""


TEXTO_MIN = 2
TEXTO_MAX = 100


class RecuperacionService:
    """Looks a barcode up in a source and proposes a supply. It only reads: nothing is saved."""

    def __init__(
        self,
        repository: InsumoRepository,
        fuente: FuenteProducto,
        detector: Detector = detectar_alergenos,
        busqueda_nombre: FuenteBusquedaNombre | None = None,
    ) -> None:
        self.repository = repository
        self.fuente = fuente
        self.detector = detector
        self.busqueda_nombre = busqueda_nombre

    def consultar(self, productor: Productor, codigo: str) -> ConsultaCodigoRead:
        productor_id = productor.id
        codigo = self._validar(codigo)

        existente = self.repository.find_by_codigo_barras(productor_id, codigo)
        if existente is not None:
            raise DuplicateCodigoBarrasError(existente)

        producto = self.fuente.buscar(codigo)
        fecha = datetime.now(timezone.utc)
        if producto is None:
            return ConsultaCodigoRead(
                codigo_barras=codigo,
                encontrado=False,
                fuente=self.fuente.nombre,
                fecha_recuperacion=fecha,
            )

        return self._propuesta(codigo, producto, fecha)

    def _propuesta(self, codigo: str, producto: ProductoFuente, fecha: datetime) -> ConsultaCodigoRead:
        """The proposal for the supply form: the product, its allergens and where each came from."""
        if producto.fuentes_campos:
            # A sheet put together from several sources: union of what each one says (HU07).
            deteccion = combinar_alergenos(self.detector, producto)
        else:
            deteccion = self.detector(
                producto.etiquetas_alergenos,
                producto.etiquetas_trazas,
                producto.ingredientes,
            )
        return ConsultaCodigoRead(
            codigo_barras=codigo,
            encontrado=True,
            fuente=producto.fuente or self.fuente.nombre,
            fecha_recuperacion=fecha,
            producto=ProductoPropuestoRead(
                nombre=producto.nombre,
                marca_origen=producto.marca,
                presentacion=producto.presentacion,
                # Only the proposal is cleaned; the detection above and the `ficha` use the original.
                ingredientes_declarados=limpiar_ingredientes(producto.ingredientes),
            ),
            alergenos=self._alergenos(deteccion),
            ficha=producto.ficha,
            fuentes_campos={
                campo: fuente
                for campo, fuente in producto.fuentes_campos.items()
                if campo in CAMPOS_DEL_PRODUCTO
            }
            or None,
            fuentes_sin_respuesta=list(producto.fuentes_sin_respuesta) or None,
        )

    def buscar_por_nombre(self, texto: str) -> list[ResultadoBusquedaRead]:
        """The hits of a search by name or brand. Read-only; no hits is an empty list, not an error."""
        limpio = " ".join((texto or "").split())
        if len(limpio) < TEXTO_MIN:
            raise BusquedaInvalidaError(f"Escribe al menos {TEXTO_MIN} letras para buscar.")
        if len(limpio) > TEXTO_MAX:
            raise BusquedaInvalidaError(f"El texto de búsqueda no puede pasar de {TEXTO_MAX} caracteres.")
        resultados = self._fuente_nombre().buscar_por_nombre(limpio)
        return [
            ResultadoBusquedaRead(
                id=r.id, nombre=r.nombre, marca=r.marca, presentacion=r.presentacion, url=r.url
            )
            for r in resultados
        ]

    def consultar_por_nombre(self, productor: Productor, resultado_id: str) -> ConsultaCodigoRead:
        """The proposal for one hit of the search by name. It only reads: nothing is saved.

        A valid barcode in the sheet gets the same duplicate check as the lookup by barcode (409). A
        sheet without a valid barcode (bulk goods with a PLU, restricted-circulation numbers) has no
        duplicate detection and answers with an empty `codigo_barras`.
        """
        productor_id = productor.id
        try:
            producto = self._fuente_nombre().obtener(ResultadoBusqueda(id=resultado_id, nombre="", marca=None, presentacion=None))
        except ValueError as exc:
            raise BusquedaInvalidaError("El producto elegido no es válido.") from exc
        if producto is None:
            raise ResultadoNoDisponibleError(
                "Este producto ya no está disponible en Jumbo. Puedes ingresar los datos manualmente."
            )

        codigo = producto.codigo_barras
        if codigo:
            existente = self.repository.find_by_codigo_barras(productor_id, codigo)
            if existente is not None:
                raise DuplicateCodigoBarrasError(existente)

        campos = {
            campo: FUENTE_JUMBO
            for campo, valor in (
                ("nombre", producto.nombre),
                ("marca_origen", producto.marca),
                ("presentacion", producto.presentacion),
                ("ingredientes_declarados", producto.ingredientes),
            )
            if valor
        }
        if producto.trazas_texto:
            campos["trazas_texto"] = FUENTE_JUMBO
        producto = replace(producto, fuente=FUENTE_JUMBO, fuentes_campos=campos)
        return self._propuesta(codigo, producto, datetime.now(timezone.utc))

    def _fuente_nombre(self) -> FuenteBusquedaNombre:
        if self.busqueda_nombre is None:
            raise FuenteNoDisponibleError("sin_fuente")
        return self.busqueda_nombre

    @staticmethod
    def _validar(codigo: str) -> str:
        normalizado = normalizar_codigo_barras(codigo)
        if normalizado is None:
            raise CodigoInvalidoError("Ingresa un código de barras.")
        try:
            return validar_codigo_barras(normalizado)
        except ValueError as exc:
            raise CodigoInvalidoError(str(exc)) from exc

    def _alergenos(self, deteccion: Deteccion) -> AlergenosSugeridosRead:
        codigos = sorted({a.codigo for a in (*deteccion.contiene, *deteccion.trazas)})
        catalogo = self.repository.get_alergenos_por_codigo(codigos)
        # A code that is not in the catalog cannot be suggested: it goes to manual assignment.
        sin_reconocer = list(deteccion.sin_reconocer)
        for detectado in (*deteccion.contiene, *deteccion.trazas):
            if detectado.codigo not in catalogo and detectado.codigo not in sin_reconocer:
                sin_reconocer.append(detectado.codigo)

        def sugeridos(items: tuple[AlergenoDetectado, ...]) -> list[AlergenoSugeridoRead]:
            return [
                AlergenoSugeridoRead(
                    alergeno_id=catalogo[item.codigo].id,
                    codigo=item.codigo,
                    nombre=catalogo[item.codigo].nombre,
                    origen=item.origen,
                    fuentes=list(item.fuentes) or None,
                )
                for item in items
                if item.codigo in catalogo
            ]

        return AlergenosSugeridosRead(
            contiene=sugeridos(deteccion.contiene),
            trazas=sugeridos(deteccion.trazas),
            sin_reconocer=sin_reconocer,
        )
