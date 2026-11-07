"""Public identifier of a product (HU09, CA5).

The identifier goes inside the printed QR, so it must be opaque (not guessable, not sequential)
and permanent: it is generated once, at the first enabling of the publication, and never again.
"""

import secrets

from app.core.config import get_settings

# 16 random bytes = 128 bits -> 22 URL-safe characters; the column (String(32)) leaves room.
BYTES_ID_PUBLICO = 16
LARGO_COLUMNA_ID_PUBLICO = 32


def generar_id_publico() -> str:
    return secrets.token_urlsafe(BYTES_ID_PUBLICO)


class UrlPublicaNoConfiguradaError(Exception):
    """URL_PUBLICA_APP is not set: the public URL (and so the QR) cannot be built."""


def construir_url_publica(id_publico: str) -> str:
    """The ONE place that builds the permanent public URL: `{URL_PUBLICA_APP}/p/{id_publico}`.

    Used by the QR, the management screens and the public view. The base's trailing slash is
    normalized so it never ends up as `//p/`.
    """
    base = get_settings().url_publica_app.strip().rstrip("/")
    if not base:
        raise UrlPublicaNoConfiguradaError("La URL pública de la aplicación (URL_PUBLICA_APP) no está configurada.")
    return f"{base}/p/{id_publico}"


def url_publica_o_none(id_publico: str | None) -> str | None:
    """For read payloads: None when the product was never published or the base is not configured."""
    if id_publico is None:
        return None
    try:
        return construir_url_publica(id_publico)
    except UrlPublicaNoConfiguradaError:
        return None
