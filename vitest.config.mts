import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    // Exercise the retained paid rules regardless of the local/build mode.
    // Free-mode tests explicitly override this flag.
    env: { EXPO_PUBLIC_PRO_PLAN_ENABLED: "true" },
    // Each database integration worker owns a PostgreSQL WASM instance.
    // Bound concurrency so full-suite runs remain stable beside Metro/Xcode.
    maxWorkers: 4,
    include: ["tests/**/*.test.ts"],
    coverage: { provider: "v8", include: ["src/domain/**"] },
  },
});
