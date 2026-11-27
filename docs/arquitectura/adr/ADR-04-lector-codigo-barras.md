# ADR-04: Lectura del código de barras en el navegador

**Estado:** aceptada (Sprint 2, a partir del prototipo de HT04)

**Contexto:** RF-06 exige escanear el código de barras de un insumo con la cámara del celular, desde una aplicación web, en Chrome para Android y Safari para iOS. La capacidad de lectura depende del navegador (RT-08).

**Alternativas:** solo el detector nativo `BarcodeDetector` del navegador; solo una librería en WebAssembly (ZBar-WASM); detector nativo con ZBar-WASM como alternativa; solo ingreso manual del código.

**Decisión:** usar el detector nativo `BarcodeDetector` cuando el navegador lo ofrece y ZBar-WASM como alternativa, restringido a EAN-13, EAN-8 y UPC-A, con el ingreso manual del código siempre disponible.

**Consecuencias:** el escaneo funcionó en Chrome para Android y, el 03-11-2026, en un iPhone 15 con Safari, lo que cerró RT-08. Se agrega la carga de la librería WebAssembly en los navegadores sin detector nativo.

## Matriz de decisión ponderada

Puntajes de 1 a 5.

| Criterio | Peso | Solo nativo | Solo ZBar-WASM | Nativo + ZBar-WASM | Solo ingreso manual |
|---|---|---|---|---|---|
| Compatibilidad con Chrome para Android y Safari para iOS (RT-08) | 50 % | 2 | 4 | 5 | 5 |
| Interacciones para registrar un insumo | 25 % | 5 | 5 | 5 | 2 |
| Peso y rendimiento en el celular | 25 % | 5 | 3 | 4 | 5 |
| **Puntaje ponderado** | 100 % | 3,50 | 4,00 | **4,75** | 4,25 |

**Justificación de los puntajes**
- *Compatibilidad:* `BarcodeDetector` no está disponible en todos los navegadores, por eso HT04 seleccionó ZBar-WASM como alternativa; la combinación funcionó en Android y en un iPhone 15 con Safari.
- *Interacciones:* escanear evita digitar el código; el ingreso manual exige escribirlo completo.
- *Peso:* ZBar-WASM se descarga solo cuando el navegador no tiene detector nativo.
