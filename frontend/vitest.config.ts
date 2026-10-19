import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { aliasZbarWasm } from "./vite.alias-zbar.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // The polyfill imports zbar-wasm from jsDelivr; see vite.alias-zbar.ts.
      ...aliasZbarWasm,
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    testTimeout: 15000,
    server: {
      deps: {
        // Vitest loads node_modules packages with Node itself, which cannot import the jsDelivr URL
        // inside the polyfill. Inlining it makes Vite process it, so the alias applies (see
        // vite.alias-zbar.ts).
        inline: ["@undecaf/barcode-detector-polyfill"],
      },
    },
  },
});
