"""Escribe en el resumen de la ejecución de GitHub Actions el conteo de pruebas.

Uso: python resumen_pruebas.py "<título>" <archivo-junit.xml>

Lee un informe JUnit XML (lo generan pytest y vitest) y agrega una tabla al
archivo que indica GITHUB_STEP_SUMMARY; si la variable no existe (por ejemplo,
al probarlo en local), imprime en pantalla.
"""

import os
import sys
import xml.etree.ElementTree as ET


def contar(ruta: str) -> dict[str, int]:
    total = {"aprobadas": 0, "omitidas": 0, "fallidas": 0}
    for caso in ET.parse(ruta).getroot().iter("testcase"):
        if caso.find("failure") is not None or caso.find("error") is not None:
            total["fallidas"] += 1
        elif caso.find("skipped") is not None:
            total["omitidas"] += 1
        else:
            total["aprobadas"] += 1
    return total


def main() -> int:
    titulo, ruta = sys.argv[1], sys.argv[2]
    if not os.path.exists(ruta):
        texto = f"### {titulo}\n\nNo se generó el informe de pruebas (`{ruta}`): el trabajo falló antes de ejecutarlas.\n"
    else:
        c = contar(ruta)
        total = sum(c.values())
        texto = (
            f"### {titulo}\n\n"
            "| Aprobadas | Omitidas | Fallidas | Total |\n"
            "|:---:|:---:|:---:|:---:|\n"
            f"| {c['aprobadas']} | {c['omitidas']} | {c['fallidas']} | {total} |\n"
        )
    destino = os.environ.get("GITHUB_STEP_SUMMARY")
    if destino:
        with open(destino, "a", encoding="utf-8") as f:
            f.write(texto + "\n")
    else:
        print(texto)
    return 0


if __name__ == "__main__":
    sys.exit(main())
