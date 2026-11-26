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
| Compatibilidad con Chrome para Android y Safari para iOS (RT-08) | | | | | |
| Interacciones para registrar un insumo | | | | | |
| Peso y rendimiento en el celular | | | | | |
| **Puntaje ponderado** | 100 % | | | | |
