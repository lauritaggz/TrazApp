"""QR code of a product (T09-03 / HU09): PNG and SVG generated on demand, nothing stored.

The QR encodes ONLY the public URL (never the internal id nor the product code). Black modules
on an opaque white background, error correction M, quiet zone of 4 modules: it is meant for print.
"""

import io
import math
import re
from typing import Literal

import segno

FormatoQr = Literal["png", "svg"]

CORRECCION_ERRORES = "m"
ZONA_SILENCIO = 4
LADO_MINIMO_PNG = 1000

TIPOS_MEDIA: dict[str, str] = {"png": "image/png", "svg": "image/svg+xml"}


def crear_qr(url: str) -> segno.QRCode:
    # boost_error=False: segno would otherwise raise the level above M when the data fits.
    return segno.make(url, error=CORRECCION_ERRORES, micro=False, boost_error=False)


def escala_png(qr: segno.QRCode) -> int:
    """Smallest whole pixels-per-module that gives at least LADO_MINIMO_PNG px per side."""
    modulos = qr.symbol_size(scale=1, border=ZONA_SILENCIO)[0]
    return max(1, math.ceil(LADO_MINIMO_PNG / modulos))


def generar_qr(url: str, formato: FormatoQr) -> bytes:
    qr = crear_qr(url)
    salida = io.BytesIO()
    if formato == "png":
        qr.save(salida, kind="png", scale=escala_png(qr), border=ZONA_SILENCIO, dark="#000000", light="#ffffff")
    else:
        # omitsize: viewBox only, no fixed width/height in pixels.
        qr.save(
            salida,
            kind="svg",
            scale=1,
            border=ZONA_SILENCIO,
            dark="#000000",
            light="#ffffff",
            omitsize=True,
            xmldecl=False,
        )
    return salida.getvalue()


def nombre_archivo_qr(codigo: str | None, producto_id: int, formato: FormatoQr) -> str:
    """`qr-{codigo}.{ext}` with the code reduced to safe characters; the id when nothing is left."""
    limpio = re.sub(r"[^A-Za-z0-9._-]+", "-", codigo or "").strip("-._")
    return f"qr-{limpio or producto_id}.{formato}"
