import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    // Each database integration worker owns a PostgreSQL WASM instance.
    // Bound concurrency so full-suite runs remain stable beside Metro/Xcode.
    maxWorkers: 4,
    include: ["tests/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/domain/**"] },
  },
});
