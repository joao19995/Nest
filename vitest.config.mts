import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Mesmo alias que o tsconfig ("@/*" -> raiz do projeto), para os testes resolverem imports da app.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
