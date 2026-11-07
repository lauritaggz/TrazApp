"""Public identifier of a product (HU09, CA5).

The identifier goes inside the printed QR, so it must be opaque (not guessable, not sequential)
and permanent: it is generated once, at the first enabling of the publication, and never again.
"""

import secrets

# 16 random bytes = 128 bits -> 22 URL-safe characters; the column (String(32)) leaves room.
BYTES_ID_PUBLICO = 16
LARGO_COLUMNA_ID_PUBLICO = 32


def generar_id_publico() -> str:
    return secrets.token_urlsafe(BYTES_ID_PUBLICO)
