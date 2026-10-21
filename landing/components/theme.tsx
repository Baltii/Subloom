"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "system" | "light" | "dark";
const storageKey = "subloom-landing-theme";
const isTheme = (value: string | null): value is Theme => value === "light" || value === "dark" || value === "system";


export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const preference = window.matchMedia("(prefers-color-scheme: dark)");
    let current: Theme = "system";
    try {
      const saved = localStorage.getItem(storageKey);
      if (isTheme(saved)) current = saved;
    } catch { /* Follow the system when storage is unavailable. */ }
    const apply = () => {
      const resolved = current === "system" ? (preference.matches ? "dark" : "light") : current;
      document.documentElement.dataset.theme = resolved;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
        meta.content = resolved === "dark" ? "#101A16" : "#F4F5ED";
      });
    };
    const update = (event: Event) => {
      const next = (event as CustomEvent<Theme>).detail;
      if (isTheme(next)) current = next;
      setTheme(current);
      apply();
    };
    const storage = (event: StorageEvent) => {
      if (event.key !== storageKey && event.key !== null) return;
      current = isTheme(event.newValue) ? event.newValue : "system";
      setTheme(current);
      apply();
    };
    setTheme(current);
    apply();
    preference.addEventListener("change", apply);
    window.addEventListener("subloom-theme", update);
    window.addEventListener("storage", storage);
    return () => {
      preference.removeEventListener("change", apply);
      window.removeEventListener("subloom-theme", update);
      window.removeEventListener("storage", storage);
    };
  }, []);

  return <label className="theme-control" title={`Color theme: ${theme === "system" ? "System" : theme === "dark" ? "Dark" : "Light"}`}>
    <span className="theme-symbol" aria-hidden="true">{theme === "system" ? <Monitor size={18}/> : theme === "dark" ? <Moon size={18}/> : <Sun size={18}/>}</span>
    <select aria-label="Color theme" value={theme} onChange={event => {
      const next = event.target.value as Theme;
      try { localStorage.setItem(storageKey, next); } catch { /* Apply for this visit. */ }
      window.dispatchEvent(new CustomEvent("subloom-theme", { detail: next }));
    }}>
      <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
    </select>
  </label>;
}
