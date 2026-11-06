# Conjunto de validación de HU07 (T07-09, CA13)

`referencia.csv` tiene la verdad de referencia de 50 productos, leída del **envase** o de una **foto** del envase
(no de Open Food Facts ni de Jumbo: se mide contra ellos).

| Columna | Qué lleva |
|---|---|
| `id` | Identificador único (`p01`, `p02`…). Los que empiezan con `ejemplo` se omiten al medir. |
| `nombre`, `marca` | Como se buscaría por nombre (también se usan si no hay código). |
| `codigo_barras` | EAN-8, UPC-A o EAN-13; vacío si no se conoce (se mide por búsqueda por nombre). |
| `contiene` | Códigos del catálogo separados por `;` (`lacteos;huevos`); vacío si el envase no declara ninguno. |
| `puede_contener` | Códigos separados por `;`, o `no_indica` si el envase no dice "puede contener". |
| `tiene_ingredientes` | `si` o `no`: si el envase trae la lista de ingredientes. |
| `tipo_referencia` | `envase` o `foto`. |
| `fecha` | Fecha en que se leyó la referencia (AAAA-MM-DD). |
| `notas` | Lo que ayude a entender una discrepancia. |

Códigos del catálogo: `gluten`, `crustaceos`, `huevos`, `pescado`, `cacahuetes`, `soja`, `lacteos`, `frutos_cascara`,
`sulfitos`, `apio`, `mostaza`, `sesamo`, `altramuces`, `moluscos`.

Medir (desde `backend/`):

```
python scripts/medir_hu07.py --estimar   # cuántas consultas reales haría como máximo; no usa la red
python scripts/medir_hu07.py             # mide (consultas reales, con pausa de 2 s y caché local)
```
