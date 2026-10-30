import { useCallback, useEffect, useState } from "react";

import { readSetting, saveSettings, useSettingsTick } from "@/lib/settings";

/** "editorial": black-and-white covers (default). "original": covers in colour. */
export type CoverStyle = "editorial" | "original";

/**
 * The cover style, from `settings.json` alone (issue #51). Before the load it
 * answers the default, and the SettingsGate applies the file's answer once the
 * document is there.
 */
export function readCoverStyle(): CoverStyle {
  const stored = readSetting<string | undefined>("covers", undefined);
  return stored === "original" || stored === "editorial" ? stored : "editorial";
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
  }, []);
  return [style, update];
}
