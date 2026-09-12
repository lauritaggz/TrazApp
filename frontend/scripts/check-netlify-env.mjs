/**
 * On Netlify, fail the build if VITE_API_URL is missing.
 * Locally, Vite still reads frontend/.env — this script stays silent unless NETLIFY=true.
 */
const onNetlify = process.env.NETLIFY === "true";
const apiUrl = process.env.VITE_API_URL?.trim();

if (onNetlify && !apiUrl) {
  console.error(
    [
      "",
      "[TrazApp] VITE_API_URL is not set.",
      "Netlify → Site configuration → Environment variables",
      "Example: VITE_API_URL=https://api.tudominio.cl",
      "(no trailing slash)",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

if (onNetlify && apiUrl && /localhost|127\.0\.0\.1/i.test(apiUrl)) {
  console.warn(
    `[TrazApp] Warning: VITE_API_URL points to localhost in Netlify (${apiUrl}).`,
  );
}

if (apiUrl) {
  console.log(`[TrazApp] Building with VITE_API_URL=${apiUrl}`);
}
