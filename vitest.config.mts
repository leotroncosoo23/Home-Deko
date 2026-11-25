import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests (npm test). Sin red: las respuestas de Getnet y la base se simulan.
 * "server-only" se reemplaza por un módulo vacío (en Next frena que el
 * código del servidor llegue al navegador; en los tests no hay navegador).
 *
 * Windows + Git Bash: si la carpeta se abrió como /c/... (unidad en
 * minúscula), Vitest se carga dos veces y falla con "failed to find the
 * runner". Correrlo desde PowerShell, o en Git Bash entrar con /C/... .
 */
const root = process.cwd();

export default defineConfig({
  root,
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      "server-only": path.join(root, "src/test/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
