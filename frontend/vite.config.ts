import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type PluginOption } from "vite";
import { aliasZbarWasm } from "./vite.alias-zbar.ts";
import { proxyDeLaApi, usaHttpsDeDesarrollo } from "./vite.dev-https.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async ({ command }) => {
  // Only `npm run dev:https` (VITE_DEV_HTTPS=1) turns this on, and only for the dev server: the
  // certificate plugin is not even loaded otherwise, so `npm run dev` and the build stay as they were.
  const https = usaHttpsDeDesarrollo(process.env, command);
  const plugins: PluginOption[] = [react(), tailwindcss()];
  if (https) plugins.push((await import("@vitejs/plugin-basic-ssl")).default());

  return {
    plugins,
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
      // HTTPS mode (see vite.dev-https.ts): the API goes through this origin, so a phone talks to one.
      ...(https ? { proxy: proxyDeLaApi(process.env) } : {}),
    },
  };
});
