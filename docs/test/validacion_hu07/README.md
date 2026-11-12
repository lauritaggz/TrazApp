# Conjunto de validación de HU07 (T07-09, CA13)

`referencia.csv` tiene la verdad de referencia de 37 productos, leída del **envase** o de una **foto** del envase
(no de Open Food Facts ni de Jumbo: se mide contra ellos).

| Columna | Qué lleva |
|---|---|
| `id` | Identificador único (`p01`, `p02`…). Los que empiezan con `ejemplo` se omiten al medir. |
| `nombre`, `marca` | Como se buscaría por nombre (también se usan si no hay código). |
| `codigo_barras` | EAN-8, UPC-A o EAN-13; vacío si no se conoce (se mide por búsqueda por nombre). |
| `contiene` | Nombres del catálogo separados por `;` (`Leche;Huevo`); vacío si el envase no declara ninguno. |
| `puede_contener` | Nombres separados por `;`, o `no_indica` si el envase no dice "puede contener". |
| `tiene_ingredientes` | `si` o `no`: si el envase trae la lista de ingredientes. |
| `tipo_referencia` | `envase` o `foto`. |
| `fecha` | Fecha en que se leyó la referencia (AAAA-MM-DD). |
| `notas` | Lo que ayude a entender una discrepancia. |

Nombres del catálogo (se aceptan también sus códigos, sin importar mayúsculas ni acentos): Gluten, Crustáceos, Huevo, Pescado, Maní, Soya, Leche, Nueces, Sulfitos, Apio, Mostaza, Sésamo, Altramuces, Moluscos.

Medir (desde `backend/`):

```
python scripts/medir_hu07.py --validar     # solo revisa el formato y los nombres de alérgenos
python scripts/medir_hu07.py --estimar     # cuántas consultas reales haría como máximo; no usa la red
python scripts/medir_hu07.py --limite 5    # prueba corta con los primeros 5 productos
python scripts/medir_hu07.py               # mide todo (pausa de 2 s, sin reintentos, caché local)
```

Escribe `resultados.md` (métricas y tabla de discrepancias) y `resultados.csv` en esta carpeta.
