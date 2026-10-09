import { useCallback, useState } from "react";

/** Theme storage key for next-themes; index.html reads it before first paint. */
export const THEME_STORAGE_KEY = "klangkurator.theme.v1";

/** "editorial": black-and-white covers (default). "original": covers in colour. */
export type CoverStyle = "editorial" | "original";

const COVERS_KEY = "klangkurator.covers.v1";

export function readCoverStyle(): CoverStyle {
  try {
    return localStorage.getItem(COVERS_KEY) === "original" ? "original" : "editorial";
  } catch {
    return "editorial";
  }
}

export function applyCoverStyle(style: CoverStyle): void {
  document.documentElement.dataset.covers = style;
}

export function useCoverStyle(): [CoverStyle, (style: CoverStyle) => void] {
  const [style, setStyle] = useState<CoverStyle>(readCoverStyle);
  const update = useCallback((next: CoverStyle) => {
    setStyle(next);
    applyCoverStyle(next);
    try {
      localStorage.setItem(COVERS_KEY, next);
    } catch {
      /* private mode: the choice lasts for this session */
    }
  }, []);
  return [style, update];
}
