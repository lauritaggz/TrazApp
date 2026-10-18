from typing import Any

import httpx

from app.core.config import Settings
from app.services.recuperacion.base import (
    MOTIVO_ERROR_SERVIDOR,
    MOTIVO_LIMITE_DE_USO,
    MOTIVO_RESPUESTA_INVALIDA,
    MOTIVO_SIN_CONEXION,
    MOTIVO_TIMEOUT,
    FuenteNoDisponibleError,
)
from app.services.recuperacion.modelos import ProductoFuente

NOMBRE_FUENTE = "open_food_facts"

# Requested from the source and kept, as received, in the supply's `ficha`.
CAMPOS = (
    "code",
    "product_name",
    "product_name_es",
    "brands",
    "quantity",
    "ingredients_text",
    "ingredients_text_es",
    "allergens_tags",
    "traces_tags",
    "countries_tags",
    "last_modified_t",
)


def construir_url(base_url: str, codigo: str) -> str:
    return f"{base_url.rstrip('/')}/api/v2/product/{codigo}.json"


def _texto(valor: Any) -> str | None:
    if not isinstance(valor, str):
        return None
    valor = valor.strip()
    return valor or None


def _etiquetas(valor: Any) -> tuple[str, ...]:
    if not isinstance(valor, list):
        return ()
    return tuple(item.strip() for item in valor if isinstance(item, str) and item.strip())


def _primera_marca(valor: Any) -> str | None:
    texto = _texto(valor)
    if texto is None:
        return None
    return _texto(texto.split(",")[0])


class OpenFoodFactsFuente:
    """Open Food Facts adapter. Identifies itself with a User-Agent and never waits unboundedly."""

    nombre = NOMBRE_FUENTE

    def __init__(
        self,
        settings: Settings,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.base_url = settings.off_base_url
        self.user_agent = settings.off_user_agent
        self.timeout = settings.off_timeout_seconds
        self._transport = transport

    def buscar(self, codigo_barras: str) -> ProductoFuente | None:
        producto = self._buscar_forma(codigo_barras, codigo_barras)
        # Open Food Facts usually stores a UPC-A as an EAN-13 with a leading 0: if the code as it
        # was read is unknown, ask once more with that form. Errors are not retried.
        if producto is None and len(codigo_barras) == 12:
            producto = self._buscar_forma(codigo_barras, "0" + codigo_barras)
        return producto

    def _buscar_forma(self, codigo_barras: str, forma: str) -> ProductoFuente | None:
        """Ask for `forma`; the product is reported under the code as the productor read it."""
        respuesta = self._pedir(forma)
        if respuesta.status_code == 404:
            return None
        if respuesta.status_code == 429:
            raise FuenteNoDisponibleError(MOTIVO_LIMITE_DE_USO)
        if respuesta.status_code >= 500:
            raise FuenteNoDisponibleError(MOTIVO_ERROR_SERVIDOR)
        if respuesta.status_code != 200:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)
        try:
            cuerpo = respuesta.json()
        except ValueError as exc:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA) from exc
        return self._interpretar(codigo_barras, forma, cuerpo)

    def _pedir(self, codigo_barras: str) -> httpx.Response:
        try:
            with httpx.Client(
                timeout=httpx.Timeout(self.timeout),
                headers={"User-Agent": self.user_agent, "Accept": "application/json"},
                transport=self._transport,
            ) as cliente:
                return cliente.get(
                    construir_url(self.base_url, codigo_barras),
                    params={"fields": ",".join(CAMPOS)},
                )
        except httpx.TimeoutException as exc:
            raise FuenteNoDisponibleError(MOTIVO_TIMEOUT) from exc
        except httpx.HTTPError as exc:
            raise FuenteNoDisponibleError(MOTIVO_SIN_CONEXION) from exc

    def _interpretar(self, codigo_barras: str, forma: str, cuerpo: Any) -> ProductoFuente | None:
        if not isinstance(cuerpo, dict) or "status" not in cuerpo:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)
        if cuerpo["status"] != 1:
            return None
        producto = cuerpo.get("product")
        if not isinstance(producto, dict):
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)

        url = f"{self.base_url.rstrip('/')}/product/{forma}"
        ficha = {campo: producto[campo] for campo in CAMPOS if campo in producto}
        ficha["url"] = url
        return ProductoFuente(
            codigo_barras=codigo_barras,
            nombre=_texto(producto.get("product_name_es")) or _texto(producto.get("product_name")),
            marca=_primera_marca(producto.get("brands")),
            presentacion=_texto(producto.get("quantity")),
            ingredientes=_texto(producto.get("ingredients_text_es"))
            or _texto(producto.get("ingredients_text")),
            etiquetas_alergenos=_etiquetas(producto.get("allergens_tags")),
            etiquetas_trazas=_etiquetas(producto.get("traces_tags")),
            url=url,
            ficha=ficha,
        )
