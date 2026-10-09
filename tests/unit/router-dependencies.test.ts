import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
const require = createRequire(import.meta.url);
describe("patched router URI compatibility", () => {
  it("keeps the expected CommonJS API for query-string 7", () => {
    const query = require("query-string") as {
      parse: (text: string) => Record<string, string>;
    };
    expect(query.parse("name=Spotify%20Premium")).toMatchObject({
      name: "Spotify Premium",
    });
  });
  it("handles long malformed percent encoding without recursive explosion", () => {
    const decode = createRequire(require.resolve("query-string"))(
      "decode-uri-component",
    ) as (text: string) => string;
    expect(decode("%C3%A5")).toBe("å");
    expect(decode("%FF".repeat(3000))).toHaveLength(9000);
  });
});
