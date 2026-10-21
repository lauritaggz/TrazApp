/**
 * Keeps the barcode reader (HU13) from loading code and its .wasm from a public CDN.
 *
 * `@undecaf/barcode-detector-polyfill` (used in browsers without a native BarcodeDetector, such as
 * Safari on iOS) does NOT accept a location for its decoder: its entry point, `dist/main.js`, imports
 * `@undecaf/zbar-wasm` from a hard-coded jsDelivr URL. Left alone, the browser would fetch the
 * decoder, and then `zbar.wasm`, from jsdelivr.net every time the scanner is used.
 *
 * The documented way out is to configure the bundler: this alias replaces that URL with the package
 * installed from npm. Vite then bundles `@undecaf/zbar-wasm` and, because that module locates its
 * binary with `new URL("zbar.wasm", import.meta.url)`, emits `zbar.wasm` as an asset of the app
 * (`dist/assets/zbar-<hash>.wasm`) and serves it from the same origin.
 *
 * The URL below is the one inside the EXACT version we install (`--save-exact`, no `^`):
 *   @undecaf/barcode-detector-polyfill 0.9.23  ->  @undecaf/zbar-wasm 0.9.16
 * A different polyfill version may change that URL, and then this alias would silently stop
 * matching. Two tests fail if that happens (src/escaner/hu13.sin-cdn.test.ts): one compares this URL
 * with the installed polyfill, the other builds the app and looks for "jsdelivr" in the output.
 *
 * It is used by vite.config.ts (dev and build) and by vitest.config.ts (tests).
 */
export const URL_ZBAR_WASM_EN_CDN =
  "https://cdn.jsdelivr.net/npm/@undecaf/zbar-wasm@0.9.16/dist/main.js";

export const aliasZbarWasm = [
  { find: URL_ZBAR_WASM_EN_CDN, replacement: "@undecaf/zbar-wasm" },
];
