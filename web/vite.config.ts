import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

const coefFile = fileURLToPath(new URL("../engine/pe_risk/coefficients/fmf_11_13_v1.json", import.meta.url));
// Same checksum as the Python engine prints: SHA-256 of the file's bytes.
const coefSha = createHash("sha256").update(readFileSync(coefFile)).digest("hex");

// `vite build --mode standalone`: one self-contained HTML file that calculates in the browser,
// with no server, sign-in or database (dist-standalone/index.html).
export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";
  return {
    plugins: [react(), ...(standalone ? [viteSingleFile()] : [])],
    define: { __COEF_SHA256__: JSON.stringify(coefSha), __STANDALONE__: JSON.stringify(standalone) },
    base: standalone ? "./" : "/",
    build: { outDir: standalone ? "dist-standalone" : "dist" },
    server: { proxy: { "/api": "http://127.0.0.1:8000" } },
    test: { include: ["tests/**/*.test.ts"] },
  };
});
