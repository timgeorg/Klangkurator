// Track map (issue #8) — one collapsible section of the map rail (plan phase
// 3: the scaffolding; phase 4a fills it with Similarity, Filters, Layers and
// Clusters). The header stays reachable when the section is closed, so every
// section is still keyboard-navigable while collapsed (TM-R10).
import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface RailSectionProps {
  title: string;
  /** A mono count beside the title, when the section counts something. */
  count?: number;
  /** Whether the section starts open; a later phase reads it from saved UI state. */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * A map rail section: a header that collapses its body. The header is a
 * button, so it is named, Tab-reachable and shows focus; its chevron turns
 * with the open state (motion is state, and it is off under reduced motion
 * through the token durations).
 */
export function RailSection({ title, count, defaultOpen = true, children }: RailSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="flex shrink-0 items-center gap-2">
          {count !== undefined && <span className="k-num text-xs text-muted-foreground">{count}</span>}
          <ChevronDown
            aria-hidden
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-fast ease-out",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
