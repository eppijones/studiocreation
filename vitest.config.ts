import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror tsconfig `@/*` → repo root so server libs import the same way as in Next.
    alias: { "@": root },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // A well-formed dummy keeps `neon()` from throwing when a server lib that
    // imports lib/db.ts is loaded. No test issues a real query.
    env: { DATABASE_URL: "postgresql://test:test@localhost:5432/test" },
  },
});
