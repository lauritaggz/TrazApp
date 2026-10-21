from typing import Protocol

from app.services.recuperacion.modelos import ProductoFuente

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
