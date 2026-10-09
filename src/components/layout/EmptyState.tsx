import React from "react";

import { Shape } from "@/components/brand";
import { cn } from "@/lib/utils";

type Arrangement = "orbit" | "stack" | "split";

interface EmptyStateProps {
  title: string;
  body?: React.ReactNode;
  /** Buttons that resolve the empty state. */
  action?: React.ReactNode;
  /** page: a whole view is empty. inline: a section or panel is empty. */
  size?: "page" | "inline";
  /** Which shape composition; vary it so empty states don't repeat. */
  arrangement?: Arrangement;
  className?: string;
}

/**
 * An empty state in the editorial voice: a serif line that says what is
 * missing, one sentence on how to fill it, the action, and a composition of
 * the board's shapes. Exactly one shape is orange.
 */
export function EmptyState({ title, body, action, size = "page", arrangement = "orbit", className }: EmptyStateProps) {
  if (size === "inline") {
    return (
      <div className={cn("flex items-start gap-5 rounded-lg border border-dashed border-border p-5", className)}>
        <ShapeCluster arrangement={arrangement} className="h-12 w-12 shrink-0" />
        <div className="min-w-0">
          <p className="font-serif text-lg leading-snug">{title}</p>
          {body && <p className="mt-1 text-[13px] text-muted-foreground">{body}</p>}
          {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("k-grain grid items-center gap-10 px-5 py-14 md:grid-cols-[minmax(0,1fr)_auto] md:px-8", className)}>
      <div className="max-w-xl">
        <h2 className="k-display-sm">{title}</h2>
        {body && <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{body}</p>}
        {action && <div className="mt-7 flex flex-wrap gap-2">{action}</div>}
      </div>
      <ShapeCluster arrangement={arrangement} className="hidden h-40 w-40 md:block" />
    </div>
  );
}

/** Three fixed compositions of the board's shapes, sized by the container. */
export function ShapeCluster({ arrangement, className }: { arrangement: Arrangement; className?: string }) {
  return (
    <div aria-hidden className={cn("relative", className)}>
      {arrangement === "orbit" && (
        <>
          <Shape kind="circle" className="absolute left-0 top-0 w-[62%] text-foreground" />
          <Shape kind="half" turn={3} className="absolute bottom-0 right-0 w-[70%] text-signal" />
        </>
      )}
      {arrangement === "stack" && (
        <>
          <Shape kind="quarter" className="absolute left-0 top-0 w-1/2 text-foreground" />
          <Shape kind="block" className="absolute right-0 top-0 w-[42%] text-foreground/25" />
          <Shape kind="half" className="absolute bottom-0 left-0 w-full text-signal" />
        </>
      )}
      {arrangement === "split" && (
        <>
          <Shape kind="half" className="absolute left-0 top-0 w-full text-foreground" />
          <Shape kind="half" turn={2} className="absolute bottom-0 left-[20%] w-[60%] text-signal" />
        </>
      )}
    </div>
  );
}
