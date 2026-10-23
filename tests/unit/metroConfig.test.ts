import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const config = require("../../metro.config.js");
const blocked = (file: string) =>
  config.resolver.blockList.some((pattern: RegExp) => pattern.test(file));
const root = resolve(import.meta.dirname, "../..");

describe("Metro private file exclusions", () => {
  it.each(["/", "\\"])(
    "excludes private files with %s separators",
    (separator) => {
      const file = (name: string) =>
        `${root}/${name}`.replaceAll("/", separator);
      for (const name of [
        ".env.pro-sandbox.local",
        ".env.server",
        ".env.example",
        "build/pro-keys/billing.env",
        "build/pro-keys/server.env",
        "supabase/functions/_shared/proBilling.ts",
      ]) {
        expect(blocked(file(name)), name).toBe(true);
      }
      for (const name of [
        ".env",
        ".env.local",
        ".env.development",
        ".env.development.local",
        ".env.production",
        ".env.production.local",
        "src/domain/pro.ts",
        "node_modules/@tanstack/query-core/build/modern/index.js",
        "node_modules/@supabase/supabase-js/dist/index.js",
      ]) {
        expect(blocked(file(name)), name).toBe(false);
      }
    },
  );
  it("retains Expo's generated-file exclusions and SQLite assets", () => {
    const defaults = require("expo/metro-config").getDefaultConfig(root);
    const patterns = config.resolver.blockList.map(String);
    for (const pattern of [defaults.resolver.blockList].flat())
      expect(patterns).toContain(String(pattern));
    expect(config.resolver.assetExts).toContain("wasm");
  });
});
