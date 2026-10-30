/**
 * The theme, held in `settings.json` and nowhere else.
 *
 * This replaces `next-themes`: that library reads and writes `localStorage` on
 * its own, which left the theme the one preference a copied data folder could
 * not reproduce. The file is the only store now, so the app looks the same on a
 * machine that never opened it before.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { getSettings, readSetting, saveSettings, useSettingsTick } from "@/lib/settings";

/** What the user picked: a fixed theme, or "system" to follow the computer. */
export type ThemeChoice = "light" | "dark" | "system";

const DARK_QUERY = "(prefers-color-scheme: dark)";

/** "light" or "dark" — never "system". */
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  /** The stored choice, so the settings segmented control can show it. */
  theme: ThemeChoice;
  /** The theme actually painted right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeChoice) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** The stored choice; "dark" until the file answers. */
function storedTheme(): ThemeChoice {
  const stored = readSetting<string | undefined>("theme", undefined);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia(DARK_QUERY).matches;
}

function resolve(choice: ThemeChoice, systemDark: boolean): ResolvedTheme {
  return choice === "system" ? (systemDark ? "dark" : "light") : choice;
}

/** Paint a resolved theme on the document and keep `color-scheme` in step. */
export function applyTheme(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

/**
 * The theme provider. It must sit inside `<SettingsGate>`, so the file has been
 * read by the time this initialises.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const tick = useSettingsTick();
  const [theme, setThemeState] = useState<ThemeChoice>(storedTheme);
  const [systemDark, setSystemDark] = useState(prefersDark);

  // Follow the computer while "system" is selected, and stop when unmounted.
  useEffect(() => {
    const query = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    query.addEventListener("change", onChange);
    setSystemDark(query.matches);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Another surface (the Settings page, the gate's load) may have changed it.
  useEffect(() => {
    setThemeState(storedTheme());
  }, [tick]);

  const resolvedTheme = resolve(theme, systemDark);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = useCallback((next: ThemeChoice) => {
    setThemeState(next);
    applyTheme(resolve(next, prefersDark()));
    saveSettings({ theme: next });
  }, []);

  // `getSettings` is read so a caller's first render already sees the file.
  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, resolvedTheme, setTheme, getSettings().theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The theme of the nearest provider; the default while none is mounted. */
export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      theme: "dark",
      resolvedTheme: "dark",
      setTheme: () => {},
    }
  );
}
