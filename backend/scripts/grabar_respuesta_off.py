"""Records real Open Food Facts answers as test fixtures (HU13). Run it by hand, never from tests.

    python scripts/grabar_respuesta_off.py --dry-run          # lists what would be requested
    python scripts/grabar_respuesta_off.py                    # records the 11 codes of the set (+1 request: the EAN-13 form of the UPC-A)

It sends the identifying User-Agent from the settings, asks for the same fields as the adapter and
waits at least one second between requests. Each answer is stored as
tests/fixtures/off/<code>.json with the HTTP status and the body, exactly as received.
Run it from the `backend` directory.
"""

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.services.recuperacion.open_food_facts import CAMPOS, construir_url  # noqa: E402

# Conjunto de prueba de la HT04 (docs/TrazApp_HU13_contexto_agente.md, sección 7).
CODIGOS = (
    "7802910000971",  # Loncoleche sin lactosa: "leche" en ingredientes, sin alérgeno etiquetado
    "8445291716841",  # Galleta Triton vainilla: ingredientes y alérgenos
    "7808709504767",  # Leche entera: ingredientes, sin alérgenos etiquetados
    "7801505231974",  # Azúcar flor: ingredientes
    "7801505231950",  # Azúcar rubia: sin ingredientes
    "400001143070",  # Atún lomitos en aceite (UPC-A)
    "7790272001005",  # Aceite de girasol: alérgenos etiquetados
    "7802410002239",  # Polvos de hornear: sin ingredientes
    "8413700064197",  # Bicarbonato sódico: importado
    "7803600002053",  # Encontrado, sin nombre
    "7801505000358",  # No encontrado
)
PAUSA_SEGUNDOS = 1.5
MAXIMO_PEDIDOS = 12  # los 11 códigos del conjunto + la forma EAN-13 del UPC-A
DESTINO = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "off"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="only list the requests")
    parser.add_argument("codigos", nargs="*", default=CODIGOS)
    args = parser.parse_args()

    settings = get_settings()
    # A UPC-A is also asked as EAN-13 with a leading 0, as the adapter does when it is not found.
    codigos = [c for codigo in args.codigos for c in ([codigo, "0" + codigo] if len(codigo) == 12 else [codigo])]
    if len(codigos) > MAXIMO_PEDIDOS:
        print(f"Demasiados pedidos: el máximo autorizado es {MAXIMO_PEDIDOS}.")
        return 2

    DESTINO.mkdir(parents=True, exist_ok=True)
    print(f"User-Agent: {settings.off_user_agent}")
    with httpx.Client(
        timeout=httpx.Timeout(settings.off_timeout_seconds),
        headers={"User-Agent": settings.off_user_agent, "Accept": "application/json"},
    ) as cliente:
        for indice, codigo in enumerate(codigos):
            url = construir_url(settings.off_base_url, codigo)
            print(f"[{indice + 1}/{len(codigos)}] GET {url}?fields=…")
            if args.dry_run:
                continue
            if indice:
                time.sleep(PAUSA_SEGUNDOS)
            respuesta = cliente.get(url, params={"fields": ",".join(CAMPOS)})
            try:
                cuerpo = respuesta.json()
            except ValueError:
                cuerpo = respuesta.text
            (DESTINO / f"{codigo}.json").write_text(
                json.dumps(
                    {"http_status": respuesta.status_code, "body": cuerpo},
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                )
                + "\n",
                encoding="utf-8",
            )
            print(f"    -> {respuesta.status_code}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
