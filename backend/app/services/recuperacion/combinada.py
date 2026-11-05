"""Combined source (HU07 / T07-04): Open Food Facts by barcode, completed with Jumbo by name.

Open Food Facts answers the barcode. With its name and brand, Jumbo is searched, and its sheet is
merged ONLY when the sheet's own barcode is the same one. A match by name is never enough.

One deadline covers the whole lookup, Open Food Facts included: each call gets the time that is left.
If Jumbo fails or the time runs out, the answer is Open Food Facts' alone, marked as such so the
productor is told (CA10). No retries.
"""

import time
from collections.abc import Callable
from dataclasses import replace

from app.core.codigo_barras import formas_equivalentes
from app.services.recuperacion.base import (
    MOTIVO_TIMEOUT,
    FuenteBusquedaNombre,
    FuenteNoDisponibleError,
    FuenteProducto,
)
from app.services.recuperacion.modelos import ProductoFuente

NOMBRE_FUENTE = "combinada"
FUENTE_OFF = "open_food_facts"
FUENTE_JUMBO = "jumbo"
MAX_CANDIDATOS = 3
PRESUPUESTO_POR_DEFECTO = 10.0


class FuenteCombinada:
    """Implements `FuenteProducto`, so the service keeps receiving one source (CA12)."""

    # What the service reports when the barcode is not found: Open Food Facts is who answered it.
    nombre = FUENTE_OFF

    def __init__(
        self,
        off: FuenteProducto,
        jumbo: FuenteBusquedaNombre,
        presupuesto: float = PRESUPUESTO_POR_DEFECTO,
        reloj: Callable[[], float] = time.monotonic,
    ) -> None:
        # `off.buscar` also accepts `timeout` (the adapter of Open Food Facts does).
        self.off = off
        self.jumbo = jumbo
        self.presupuesto = presupuesto
        self._reloj = reloj

    def buscar(self, codigo_barras: str) -> ProductoFuente | None:
        limite = self._reloj() + self.presupuesto
        base = self.off.buscar(codigo_barras, timeout=self._restante(limite))  # type: ignore[call-arg]
        if base is None:
            return None  # T07-08 offers the search by name
        try:
            ficha_jumbo = self._buscar_en_jumbo(base, codigo_barras, limite)
        except FuenteNoDisponibleError:
            return self._solo_off(base, sin_respuesta=(FUENTE_JUMBO,))
        if ficha_jumbo is None:
            return self._solo_off(base)
        return self._combinar(base, ficha_jumbo)

    def _restante(self, limite: float) -> float:
        return limite - self._reloj()

    def _buscar_en_jumbo(
        self, base: ProductoFuente, codigo_barras: str, limite: float
    ) -> ProductoFuente | None:
        """The first Jumbo sheet (of up to 3 candidates) whose barcode is this one, if any."""
        texto = " ".join(parte for parte in (base.nombre, base.marca) if parte)
        if not texto.strip():
            return None
        restante = self._restante(limite)
        if restante <= 0:
            raise FuenteNoDisponibleError(MOTIVO_TIMEOUT)
        candidatos = self.jumbo.buscar_por_nombre(texto, timeout=restante)[:MAX_CANDIDATOS]
        equivalentes = formas_equivalentes(codigo_barras)
        for candidato in candidatos:
            restante = self._restante(limite)
            if restante <= 0:
                raise FuenteNoDisponibleError(MOTIVO_TIMEOUT)
            ficha = self.jumbo.obtener(candidato, timeout=restante)
            # An empty barcode (bulk item, PLU, malformed gtin) never matches.
            if ficha is not None and ficha.codigo_barras and ficha.codigo_barras in equivalentes:
                return ficha
        return None

    @staticmethod
    def _solo_off(
        base: ProductoFuente, sin_respuesta: tuple[str, ...] = ()
    ) -> ProductoFuente:
        campos = {
            campo: FUENTE_OFF
            for campo, valor in (
                ("nombre", base.nombre),
                ("marca_origen", base.marca),
                ("presentacion", base.presentacion),
                ("ingredientes_declarados", base.ingredientes),
            )
            if valor
        }
        return replace(
            base,
            fuente=FUENTE_OFF,
            fuentes_campos=_con_alergenos(campos, base, trazas_texto=False),
            fuentes_sin_respuesta=sin_respuesta,
        )

    @staticmethod
    def _combinar(base: ProductoFuente, jumbo: ProductoFuente) -> ProductoFuente:
        """Field rules: ingredients from Jumbo, else OFF; name, brand and presentation from OFF, else Jumbo."""
        campos: dict[str, str] = {}

        def elegir(campo: str, preferida: tuple[str, str | None], respaldo: tuple[str, str | None]):
            for fuente, valor in (preferida, respaldo):
                if valor:
                    campos[campo] = fuente
                    return valor
            return None

        nombre = elegir("nombre", (FUENTE_OFF, base.nombre), (FUENTE_JUMBO, jumbo.nombre))
        marca = elegir("marca_origen", (FUENTE_OFF, base.marca), (FUENTE_JUMBO, jumbo.marca))
        presentacion = elegir(
            "presentacion", (FUENTE_OFF, base.presentacion), (FUENTE_JUMBO, jumbo.presentacion)
        )
        ingredientes = elegir(
            "ingredientes_declarados",
            (FUENTE_JUMBO, jumbo.ingredientes),
            (FUENTE_OFF, base.ingredientes),
        )
        ficha = dict(base.ficha)
        ficha[FUENTE_JUMBO] = jumbo.ficha
        trazas_texto = jumbo.trazas_texto
        return ProductoFuente(
            codigo_barras=base.codigo_barras,
            nombre=nombre,
            marca=marca,
            presentacion=presentacion,
            ingredientes=ingredientes,
            etiquetas_alergenos=base.etiquetas_alergenos,
            etiquetas_trazas=base.etiquetas_trazas,
            trazas_texto=trazas_texto,
            url=base.url,
            fuente=NOMBRE_FUENTE,
            fuentes_campos=_con_alergenos(campos, base, trazas_texto=bool(trazas_texto)),
            ficha=ficha,
        )


def _con_alergenos(campos: dict[str, str], base: ProductoFuente, trazas_texto: bool) -> dict[str, str]:
    """Who supplied the allergen inputs: OFF's labels and (if any) Jumbo's free-text traces."""
    campos = dict(campos)
    if base.etiquetas_alergenos or base.etiquetas_trazas:
        campos["etiquetas_alergenos"] = FUENTE_OFF
    if trazas_texto:
        campos["trazas_texto"] = FUENTE_JUMBO
    return campos
