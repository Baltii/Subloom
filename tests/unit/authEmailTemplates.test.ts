import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const paths = [
  new URL("../../supabase/templates/auth-otp.html", import.meta.url),
  new URL("../../supabase/templates/auth-security.html", import.meta.url),
];
const templates = paths.map((path) => readFileSync(path, "utf8"));

describe("Supabase Auth email templates", () => {
  it("uses Supabase SiteURL for every link and hosted image", () => {
    for (const html of templates) {
      expect(html).toContain("{{ .SiteURL }}");
      expect(html).not.toMatch(/https:\/\/app\.subloom\.tn/);
      expect(html).not.toContain("{{ .RedirectTo }}");

      for (const siteUrl of [
        "https://app.subloom.tn",
        "https://preview.example.test",
      ]) {
        const rendered = html.replaceAll("{{ .SiteURL }}", siteUrl);
        const attributes = [...rendered.matchAll(/(?:href|src)="([^"]+)"/g)]
          .map((match) => match[1]);
        expect(attributes.length).toBeGreaterThan(2);
        for (const value of attributes) {
          expect(value.startsWith(siteUrl + "/")).toBe(true);
        }
      }
    }
  });

  it("retains the OTP verification code without switching to a magic-link flow", () => {
    expect(templates[0]).toContain("{{ .Token }}");
    expect(templates[0]).not.toContain("{{ .ConfirmationURL }}");
    expect(templates[0].replaceAll("{{ .SiteURL }}", "https://app.subloom.tn"))
      .toContain("https://app.subloom.tn/open?path=%2F");
    expect(templates[1].replaceAll("{{ .SiteURL }}", "https://app.subloom.tn"))
      .toContain("https://app.subloom.tn/open?path=%2Fsettings");
  });
});
