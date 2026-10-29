import { useCallback, useEffect, useState } from "react";

import { readSetting, saveSettings, useSettingsTick } from "@/lib/settings";

/** Theme storage key for next-themes; index.html reads it before first paint. */
export const THEME_STORAGE_KEY = "klangkurator.theme.v1";

/** "editorial": black-and-white covers (default). "original": covers in colour. */
export type CoverStyle = "editorial" | "original";

/**
 * The cover style. `settings.json` is the source of truth (issue #51); the
 * browser copy exists only so the very first paint does not flash.
 */
export function readCoverStyle(): CoverStyle {
  const stored = readSetting<string | undefined>("covers", undefined);
  if (stored === "original" || stored === "editorial") return stored;
  try {
    return localStorage.getItem("klangkurator.covers.v1") === "original" ? "original" : "editorial";
  } catch {
    return "editorial";
  }
}

export function applyCoverStyle(style: CoverStyle): void {
  document.documentElement.dataset.covers = style;
}

export function useCoverStyle(): [CoverStyle, (style: CoverStyle) => void] {
  const tick = useSettingsTick();
  const [style, setStyle] = useState<CoverStyle>(readCoverStyle);

  // Another tab or the gate's load may have changed it.
  useEffect(() => {
    setStyle(readCoverStyle());
  }, [tick]);

  const update = useCallback((next: CoverStyle) => {
    setStyle(next);
    applyCoverStyle(next);
    saveSettings({ covers: next });
    try {
      localStorage.setItem("klangkurator.covers.v1", next);
    } catch {
      /* private mode: settings.json still holds it */
    }
  }, []);
  return [style, update];
}
