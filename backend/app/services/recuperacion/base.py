from typing import Protocol

from app.services.recuperacion.modelos import ProductoFuente, ResultadoBusqueda

MOTIVO_TIMEOUT = "timeout"
MOTIVO_SIN_CONEXION = "sin_conexion"
MOTIVO_LIMITE_DE_USO = "limite_de_uso"
MOTIVO_ERROR_SERVIDOR = "error_servidor"
MOTIVO_RESPUESTA_INVALIDA = "respuesta_invalida"

MENSAJES_FUENTE_NO_DISPONIBLE = {
    MOTIVO_TIMEOUT: "La fuente de información tardó demasiado en responder.",
    MOTIVO_SIN_CONEXION: "No pudimos conectarnos con la fuente de información.",
    MOTIVO_LIMITE_DE_USO: (
        "La fuente de información recibió demasiadas consultas. Inténtalo en unos minutos."
    ),
    MOTIVO_ERROR_SERVIDOR: "La fuente de información no está disponible en este momento.",
    MOTIVO_RESPUESTA_INVALIDA: (
        "La fuente de información entregó una respuesta que no pudimos interpretar."
    ),
}


class FuenteNoDisponibleError(Exception):
    """The source could not answer: timeout, no connection, rate limit, server error or a bad reply."""

    def __init__(self, motivo: str) -> None:
        self.motivo = motivo
        super().__init__(
            MENSAJES_FUENTE_NO_DISPONIBLE.get(
                motivo, MENSAJES_FUENTE_NO_DISPONIBLE[MOTIVO_ERROR_SERVIDOR]
            )
        )


class FuenteProducto(Protocol):
    """A source of product information searched by barcode."""

    nombre: str

    def buscar(self, codigo_barras: str) -> ProductoFuente | None:
        """The product, or None when the source does not know it.

        Raises FuenteNoDisponibleError when the source cannot answer.
        """
        ...


class FuenteBusquedaNombre(Protocol):
    """A source that can be searched by name or brand and then asked for one result's sheet.

    Separate from `FuenteProducto` (search by barcode), which does not change.
    `timeout` is the time left, in seconds, that the caller grants to this step.
    """

    nombre: str

    def buscar_por_nombre(self, texto: str, timeout: float | None = None) -> list[ResultadoBusqueda]:
        """The matches, or an empty list. Raises FuenteNoDisponibleError when it cannot answer."""
        ...

    def obtener(
        self, resultado: ResultadoBusqueda, timeout: float | None = None
    ) -> ProductoFuente | None:
        """The sheet of a result, or None when the source no longer has that product.

        Raises FuenteNoDisponibleError when the source cannot answer.
        """
        ...
