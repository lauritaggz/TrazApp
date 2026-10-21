from collections.abc import Callable
from datetime import datetime, timezone

from app.core.codigo_barras import normalizar_codigo_barras, validar_codigo_barras
from app.models import Productor
from app.repositories.insumo_repository import InsumoRepository
from app.schemas.consulta_codigo import (
    AlergenoSugeridoRead,
    AlergenosSugeridosRead,
    ConsultaCodigoRead,
    ProductoPropuestoRead,
)
from app.services.insumo_service import DuplicateCodigoBarrasError
from app.services.recuperacion.alergenos import AlergenoDetectado, Deteccion, detectar_alergenos
from app.services.recuperacion.base import FuenteProducto
from app.services.recuperacion.limpieza import limpiar_ingredientes

Detector = Callable[[tuple[str, ...], tuple[str, ...], str | None], Deteccion]


class CodigoInvalidoError(ValueError):
    """The barcode is not a valid EAN-8, UPC-A or EAN-13 (422)."""


class RecuperacionService:
    """Looks a barcode up in a source and proposes a supply. It only reads: nothing is saved."""

    def __init__(
        self,
        repository: InsumoRepository,
        fuente: FuenteProducto,
        detector: Detector = detectar_alergenos,
    ) -> None:
        self.repository = repository
        self.fuente = fuente
        self.detector = detector

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

        deteccion = self.detector(
            producto.etiquetas_alergenos,
            producto.etiquetas_trazas,
            producto.ingredientes,
        )
        return ConsultaCodigoRead(
            codigo_barras=codigo,
            encontrado=True,
            fuente=self.fuente.nombre,
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
        )

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
                )
                for item in items
                if item.codigo in catalogo
            ]

        return AlergenosSugeridosRead(
            contiene=sugeridos(deteccion.contiene),
            trazas=sugeridos(deteccion.trazas),
            sin_reconocer=sin_reconocer,
        )
