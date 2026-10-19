import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { aliasZbarWasm } from "./vite.alias-zbar.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      // The polyfill imports zbar-wasm from jsDelivr; see vite.alias-zbar.ts.
      ...aliasZbarWasm,
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  server: {
    host: "0.0.0.0",
    port: 5175,
    watch: {
      usePolling: true,
    },
  },
});
