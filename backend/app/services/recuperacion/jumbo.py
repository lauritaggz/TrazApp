"""Jumbo adapter (HU07 / T07-02, T07-03): search by name and read a product's sheet, without a browser.

Only `/api/catalog` (search) and `/{slug}/p` (sheet, no query string) are used, as `ai.txt` and
`robots.txt` allow. The sheet is read from its structured data (JSON-LD `Product`) and from the
server-rendered HTML, where «Puede contener» lives. That block is parsed with `html.parser`,
anchored on its text and not on CSS classes, which the site changes freely.

Jumbo has no search by barcode, so this adapter implements only `FuenteBusquedaNombre`.
"""

import json
import re
from html.parser import HTMLParser
from typing import Any

import httpx

from app.core.codigo_barras import (
    es_circulacion_restringida,
    normalizar_codigo_barras,
    validar_codigo_barras,
)
from app.core.config import Settings
from app.services.recuperacion.alergenos import normalizar_texto
from app.services.recuperacion.base import (
    MOTIVO_ERROR_SERVIDOR,
    MOTIVO_LIMITE_DE_USO,
    MOTIVO_RESPUESTA_INVALIDA,
    MOTIVO_SIN_CONEXION,
    MOTIVO_TIMEOUT,
    FuenteNoDisponibleError,
)
from app.services.recuperacion.modelos import ProductoFuente, ResultadoBusqueda, url_de_imagen

NOMBRE_FUENTE = "jumbo"
MAX_RESULTADOS = 10

# A result id is the product's slug: it is put in a path, so nothing else may slip in.
_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
_PRESENTACION_EN_NOMBRE = re.compile(
    r"(\d+(?:[.,]\d+)?\s?(?:kg|g|gr|ml|cc|l|lt|un|unid)\.?)(?:\s|$)", re.IGNORECASE
)


def _texto(valor: Any) -> str | None:
    if not isinstance(valor, str):
        return None
    valor = " ".join(valor.split())
    return valor or None


def _presentacion_de_busqueda(item: dict[str, Any], nombre: str) -> str | None:
    if item.get("measurementUnit") == "kg":
        return "Granel"
    coincidencias = _PRESENTACION_EN_NOMBRE.findall(nombre)
    return _texto(coincidencias[-1]) if coincidencias else None


class _LectorFicha(HTMLParser):
    """Collects what the sheet's HTML offers: JSON-LD blocks, the ingredients block and the traces."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.json_ld: list[str] = []
        self.ingredientes: str | None = None
        self.puede_contener: list[str] | None = None
        self._en_json_ld = False
        self._json_actual: list[str] = []
        self._en_h4 = False
        self._h4: list[str] = []
        self._esperando_ingredientes = False
        self._en_p = False
        self._p: list[str] = []
        self._p_es_ingredientes = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "script" and dict(attrs).get("type") == "application/ld+json":
            self._en_json_ld = True
            self._json_actual = []
        elif tag == "h4":
            self._en_h4, self._h4 = True, []
        elif tag == "p":
            self._en_p, self._p = True, []
            self._p_es_ingredientes = self._esperando_ingredientes
            self._esperando_ingredientes = False

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._en_json_ld:
            self._en_json_ld = False
            self.json_ld.append("".join(self._json_actual))
        elif tag == "h4" and self._en_h4:
            self._en_h4 = False
            # The ingredients are the paragraph right after the «Ingredientes» heading.
            self._esperando_ingredientes = normalizar_texto("".join(self._h4)) == "ingredientes"
        elif tag == "p" and self._en_p:
            self._en_p = False
            self._cerrar_parrafo()

    def handle_data(self, data: str) -> None:
        if self._en_json_ld:
            self._json_actual.append(data)
        elif self._en_h4:
            self._h4.append(data)
        elif self._en_p:
            self._p.append(data)

    def _cerrar_parrafo(self) -> None:
        texto = " ".join(" ".join(self._p).split())
        if self._p_es_ingredientes and self.ingredientes is None:
            self.ingredientes = texto.rstrip(" .") or None
        sin_ancla = re.sub(r"^puede contener\s*", "", texto, flags=re.IGNORECASE)
        if sin_ancla != texto:
            # «Puede contener / Trazas / soya, nueces»: drop the label, keep the items.
            resto = re.sub(r"^trazas?\s*:?\s*", "", sin_ancla, flags=re.IGNORECASE)
            items = [item for item in (_texto(i) for i in resto.rstrip(" .").split(",")) if item]
            self.puede_contener = (self.puede_contener or []) + items


def _producto_ld(bloques: list[str]) -> dict[str, Any]:
    for bloque in bloques:
        try:
            datos = json.loads(bloque)
        except ValueError:
            continue
        for candidato in datos if isinstance(datos, list) else [datos]:
            if isinstance(candidato, dict) and candidato.get("@type") == "Product":
                return candidato
    raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)


def _propiedades(producto: dict[str, Any], nombre: str) -> list[str]:
    propiedades = producto.get("additionalProperty")
    if not isinstance(propiedades, list):
        return []
    valores = (
        _texto(p.get("value")) for p in propiedades if isinstance(p, dict) and p.get("name") == nombre
    )
    return [v for v in valores if v]


def _ingredientes_del_faq(producto: dict[str, Any]) -> str | None:
    sujeto = producto.get("subjectOf")
    preguntas = sujeto.get("mainEntity") if isinstance(sujeto, dict) else None
    for pregunta in preguntas if isinstance(preguntas, list) else []:
        if not isinstance(pregunta, dict):
            continue
        if "ingredientes" in normalizar_texto(str(pregunta.get("name", ""))):
            respuesta = pregunta.get("acceptedAnswer")
            return _texto(respuesta.get("text")) if isinstance(respuesta, dict) else None
    return None


def _marca(producto: dict[str, Any]) -> str | None:
    marca = producto.get("brand")
    return _texto(marca.get("name") if isinstance(marca, dict) else marca)


def _gtin_combinable(gtin: str | None, nombre: str | None) -> str:
    """The sheet's gtin as a barcode, or "" when it cannot identify a packaged product.

    Main criterion: GS1 restricted-circulation prefixes (see `es_circulacion_restringida`). Bulk items
    carry a store PLU that can pass the EAN-8 check digit by chance, but it starts with 2. The word
    «granel» in the name is only a fallback for a bulk item with an ordinary-looking number.
    """
    if gtin is None:
        return ""
    normalizado = normalizar_codigo_barras(gtin)
    if normalizado is None:
        return ""
    try:
        codigo = validar_codigo_barras(normalizado)
    except ValueError:
        return ""
    if es_circulacion_restringida(codigo):
        return ""
    if "granel" in normalizar_texto(nombre or "").split():
        return ""
    return codigo


class JumboFuente:
    """Search by name and sheet reading. No retries and no cache: every call asks Jumbo."""

    nombre = NOMBRE_FUENTE

    def __init__(self, settings: Settings, transport: httpx.BaseTransport | None = None) -> None:
        self.base_url = settings.jumbo_base_url.rstrip("/")
        self.user_agent = settings.jumbo_user_agent
        self.timeout = settings.jumbo_timeout_seconds
        self._transport = transport

    def buscar_por_nombre(self, texto: str, timeout: float | None = None) -> list[ResultadoBusqueda]:
        texto = " ".join((texto or "").split())
        if not texto:
            return []
        respuesta = self._pedir(
            "POST",
            f"{self.base_url}/api/catalog",
            timeout,
            json={"fullText": texto},
            accept="application/json",
        )
        try:
            cuerpo = respuesta.json()
        except ValueError as exc:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA) from exc
        productos = cuerpo.get("products") if isinstance(cuerpo, dict) else None
        if not isinstance(productos, list):
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)

        resultados = []
        for producto in productos:
            resultado = self._resultado(producto)
            if resultado is not None:
                resultados.append(resultado)
            if len(resultados) == MAX_RESULTADOS:
                break
        return resultados

    def _resultado(self, producto: Any) -> ResultadoBusqueda | None:
        if not isinstance(producto, dict):
            return None
        slug = producto.get("slug")
        items = producto.get("items")
        item = items[0] if isinstance(items, list) and items and isinstance(items[0], dict) else None
        nombre = _texto(item.get("name")) if item else None
        if not isinstance(slug, str) or not _SLUG.match(slug) or nombre is None:
            return None
        return ResultadoBusqueda(
            id=slug,
            nombre=nombre,
            # Only for listing the hit: the sheet's own brand is what ends up in the product.
            marca=_texto(producto.get("brand")),
            presentacion=_presentacion_de_busqueda(item, nombre),
            url=f"{self.base_url}/{slug}/p",
            imagen_url=url_de_imagen(item.get("images")),
        )

    def obtener(
        self, resultado: ResultadoBusqueda, timeout: float | None = None
    ) -> ProductoFuente | None:
        if not _SLUG.match(resultado.id):
            raise ValueError("El identificador del resultado no es válido.")
        url = f"{self.base_url}/{resultado.id}/p"
        respuesta = self._pedir("GET", url, timeout, accept="text/html", nulo_si_404=True)
        if respuesta is None:
            return None

        lector = _LectorFicha()
        try:
            lector.feed(respuesta.text)
            lector.close()
        except Exception as exc:  # html.parser is lenient, but never let a bad page escape raw
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA) from exc
        producto = _producto_ld(lector.json_ld)

        nombre = _texto(producto.get("name"))
        if nombre is None:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)
        gtin = _texto(producto.get("gtin"))
        codigo = _gtin_combinable(gtin, nombre)
        presentaciones = _propiedades(producto, "Contenido Neto")
        ingredientes = _ingredientes_del_faq(producto) or lector.ingredientes
        puede_contener = lector.puede_contener or []

        ficha: dict[str, Any] = {
            "url": url,
            "slug": resultado.id,
            "gtin": gtin,
            "combinable": bool(codigo),
            # Informative only: «Libre de…» never removes an allergen (CA16).
            "condiciones_alimentarias": _propiedades(producto, "alimentaryConditions"),
            "puede_contener": puede_contener,
        }
        imagen = url_de_imagen(producto.get("image"))
        return ProductoFuente(
            codigo_barras=codigo,
            nombre=nombre,
            marca=_marca(producto),
            presentacion=presentaciones[0] if presentaciones else None,
            ingredientes=ingredientes,
            trazas_texto=tuple(puede_contener),
            url=url,
            fuente=NOMBRE_FUENTE,
            ficha=ficha,
            imagen_url=imagen,
            imagen_fuente=NOMBRE_FUENTE if imagen else None,
        )

    def _pedir(
        self,
        metodo: str,
        url: str,
        timeout: float | None,
        accept: str,
        json: Any = None,
        nulo_si_404: bool = False,
    ) -> httpx.Response | None:
        try:
            with httpx.Client(
                timeout=httpx.Timeout(self.timeout if timeout is None else timeout),
                headers={"User-Agent": self.user_agent, "Accept": accept},
                follow_redirects=True,
                transport=self._transport,
            ) as cliente:
                respuesta = cliente.request(metodo, url, json=json)
        except httpx.TimeoutException as exc:
            raise FuenteNoDisponibleError(MOTIVO_TIMEOUT) from exc
        except httpx.HTTPError as exc:
            raise FuenteNoDisponibleError(MOTIVO_SIN_CONEXION) from exc
        if respuesta.status_code == 429:
            raise FuenteNoDisponibleError(MOTIVO_LIMITE_DE_USO)
        if respuesta.status_code >= 500:
            raise FuenteNoDisponibleError(MOTIVO_ERROR_SERVIDOR)
        if respuesta.status_code == 404 and nulo_si_404:
            return None  # the product is not in the catalog (any more)
        # Any other non-200 is not a usable answer.
        if respuesta.status_code != 200:
            raise FuenteNoDisponibleError(MOTIVO_RESPUESTA_INVALIDA)
        return respuesta
