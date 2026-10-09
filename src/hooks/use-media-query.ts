import { useEffect, useState } from "react";

/** Live result of a CSS media query (false until mounted in non-browser contexts). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Same breakpoint as the shell grid (.k-shell) and Tailwind's xl. */
export const WIDE_QUERY = "(min-width: 1280px)";
