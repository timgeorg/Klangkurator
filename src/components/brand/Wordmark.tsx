import { cn } from "@/lib/utils";

import { Mark } from "./Mark";

interface WordmarkProps {
  className?: string;
  /** Hide the name and show only the mark (collapsed rail). */
  markOnly?: boolean;
}

/** Asterisk + "Klangkurator", the lockup from the moodboard. Size it with font-size. */
export function Wordmark({ className, markOnly = false }: WordmarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-[0.32em] text-[1.0625rem]", className)}>
      <Mark className="h-[1.05em] w-[1.05em]" title={markOnly ? "Klangkurator" : undefined} />
      {!markOnly && <span className="k-wordmark">Klangkurator</span>}
    </span>
  );
}
