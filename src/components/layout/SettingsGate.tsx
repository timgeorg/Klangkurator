import { useEffect, useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { applyCoverStyle, readCoverStyle, THEME_STORAGE_KEY } from "@/lib/appearance";
import { getSettings, loadSettings } from "@/lib/settings";

/**
 * Put next-themes on the theme the file holds.
 *
 * ThemeProvider reads `localStorage` only, so on a machine that never had this
 * browser the app would start in the default theme while `settings.json` says
 * otherwise. The browser copy stays for the first paint; the file wins here.
 */
function applyStoredTheme(): void {
  const theme = getSettings().theme;
  if (theme !== "light" && theme !== "dark" && theme !== "system") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  if (theme !== "system") root.classList.add(theme);
  root.style.colorScheme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode: the class is already right for this session */
  }
}

/**
 * Hold the app until the settings and genres documents have loaded (issue #51).
 *
 * Both are small local reads, so the wait is a frame or two; the skeleton is
 * there for the case where the backend is slow, and it keeps the first paint
 * from showing default columns or the wrong theme and then jumping.
 */
export function SettingsGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings()
      .then(() => {
        if (!alive) return;
        // `main.tsx` applied the cover style before this load, when only the
        // browser copy could answer. Apply the file's answer now that it is
        // here, or a copy of the folder shows the wrong covers until the
        // Settings page is opened (review of #51).
        applyCoverStyle(readCoverStyle());
        applyStoredTheme();
        setReady(true);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (ready) return <>{children}</>;
  if (failed) {
    // The app is usable without its preferences; saying so beats a dead screen.
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-md text-[13px] text-muted-foreground">
          Klangkurator could not read its settings. Is the app running (<code className="k-num">./run.sh status</code>)?
        </p>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Loading your settings" className="min-h-screen space-y-4 p-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
