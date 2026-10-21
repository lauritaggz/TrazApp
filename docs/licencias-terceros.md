# Licencias de terceros — dependencias LGPL

Este documento registra las dependencias del frontend con licencia **LGPL-2.1+**, su versión y cómo se incorporan a la aplicación. No se muestra un aviso visible en la aplicación (decisión de HU13, T13-01). Es una nota técnica, no una asesoría legal.

Las versiones están **fijadas**: `@undecaf/barcode-detector-polyfill` se instaló con `--save-exact` (sin `^`) y `package-lock.json` fija las dos dependencias LGPL de abajo.

## Dependencias LGPL

| Paquete | Versión | Licencia | Código fuente |
|---|---|---|---|
| `@undecaf/zbar-wasm` | 0.9.16 | LGPL-2.1+ | https://github.com/undecaf/zbar-wasm |
| `jschardet` | 3.1.4 | LGPL-2.1+ | https://github.com/aadsm/jschardet |

Ninguno de los dos se modifica: se usan tal como se publican en npm.

## Cómo se incorporan

La cadena de dependencias es:

```
@undecaf/barcode-detector-polyfill 0.9.23   (MIT, dependencia directa de la aplicación)
└── @undecaf/zbar-wasm 0.9.16               (LGPL-2.1+)
    └── jschardet 3.1.4                     (LGPL-2.1+)
```

### `@undecaf/zbar-wasm` — en un chunk separado, bajo demanda

El lector de códigos de barras (HU13) usa el detector nativo del navegador cuando existe. Solo cuando no existe (por ejemplo Safari para iOS) importa el polyfill con un `import()` diferido. En el build de producción eso produce:

- **Un chunk aparte del código de la aplicación**, descargado bajo demanda, que contiene el polyfill (MIT) y el código JavaScript de `zbar-wasm`. Un navegador con detector nativo, o una página sin escáner, nunca lo descarga.
- **El binario `zbar.wasm` como archivo propio** (`assets/zbar-<hash>.wasm`), servido por la misma aplicación y no por una CDN (ver el alias de Vite en `frontend/vite.alias-zbar.ts`).

El README del polyfill indica que empaquetar `zbar-wasm` en un proyecto no incumple los requisitos de la LGPL. Además, Vite emite un archivo `index-<hash>.js` (la versión de `zbar-wasm` para etiquetas `<script>`) que ninguna parte de la aplicación importa y que, por lo tanto, no se descarga.

### `jschardet` — instalada, pero fuera del build del navegador

`jschardet` la declara `@undecaf/zbar-wasm` como dependencia y por eso se instala en `node_modules`. El código de `zbar-wasm` que llega al navegador no la usa: se comprobó que ningún archivo del build generado la contiene. No viaja a los usuarios.

## Cómo se comprobó

- Árbol de dependencias: `npm ls jschardet` (`jschardet@3.1.4` bajo `@undecaf/zbar-wasm@0.9.16`).
- Build de la aplicación con un punto de entrada que importa el lector: el decodificador queda en un chunk cargado por `import()` desde el archivo que arranca primero; `zbar-<hash>.wasm` es un archivo aparte; `jschardet` no aparece en ningún archivo generado.
- Pruebas automáticas en `frontend/src/escaner/` (`hu13.build.test.ts`, `hu13.sin-cdn.test.ts`): el `.wasm` está en la salida, ningún archivo generado nombra una CDN, y la URL que reemplaza el alias es la que importa el polyfill instalado.

## Al actualizar estas dependencias

1. Cambiar la versión del polyfill de forma deliberada (la versión está fijada) y revisar de nuevo este documento.
2. Si cambia la URL desde la que el polyfill importa `zbar-wasm`, `hu13.sin-cdn.test.ts` y `hu13.build.test.ts` fallan hasta actualizar `frontend/vite.alias-zbar.ts`.
3. Verificar la licencia de las versiones nuevas: una dependencia nueva podría cambiar de licencia.
