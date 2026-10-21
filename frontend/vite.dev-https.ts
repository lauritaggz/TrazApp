/**
 * Development over HTTPS, to try the barcode scanner from a phone (HU13 / T13-07).
 *
 * A phone only gives a page access to the camera in a secure context, and a page served over HTTPS
 * cannot call a backend served over plain HTTP (mixed content). So `npm run dev:https` serves the
 * app over HTTPS with a throw-away self-signed certificate AND forwards the API calls to the local
 * backend (`/api/...` -> backend `/...`), so the phone only talks to one HTTPS origin.
 *
 * It is a DEVELOPMENT aid and is OFF unless `VITE_DEV_HTTPS=1` (the `dev:https` script sets it).
 * `npm run dev` and `npm run build` do not change: without the variable none of this applies, and
 * even with it the production build ignores it.
 */

/** The API goes through this prefix in this mode: the app is built with `VITE_API_URL=/api`. */
export const PREFIJO_API = "/api";

/** Where the proxy sends the API calls unless `VITE_DEV_API_TARGET` says otherwise. */
export const BACKEND_LOCAL = "http://localhost:8000";

/** True only for the dev server started with `VITE_DEV_HTTPS=1`. */
export function usaHttpsDeDesarrollo(env: Record<string, string | undefined>, command: string): boolean {
  return command === "serve" && env.VITE_DEV_HTTPS === "1";
}

/** `/api/x?y=1` -> `/x?y=1`. */
export function quitarPrefijoApi(ruta: string): string {
  return ruta.replace(/^\/api(?=\/|$)/, "");
}

export function proxyDeLaApi(env: Record<string, string | undefined>) {
  return {
    // A regular expression key (starts with ^): it matches `/api/...` and not `/api-docs`.
    "^/api(/|$)": {
      target: env.VITE_DEV_API_TARGET || BACKEND_LOCAL,
      changeOrigin: true,
      rewrite: quitarPrefijoApi,
    },
  };
}
