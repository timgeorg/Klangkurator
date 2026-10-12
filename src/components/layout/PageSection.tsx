import React from "react";

import { cn } from "@/lib/utils";

interface PageSectionProps {
  title: React.ReactNode;
  /** One or two sentences on what the section controls. */
  description?: React.ReactNode;
  /** Buttons next to the title, e.g. "Add tag". */
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}

/**
 * A titled block of a settings-style page. On wide screens the title and
 * description sit in a left column and the controls on the right, like the
 * margin notes of a printed page; narrow screens stack them. Sections are
 * separated by hairlines, never boxed.
 */
export function PageSection({ title, description, actions, children, id, className }: PageSectionProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("grid gap-x-12 gap-y-5 border-t border-border py-8 first:border-t-0 lg:grid-cols-[15rem_minmax(0,1fr)]", className)}
    >
      <div className="min-w-0">
        <h2 id={headingId} className="k-heading">
          {title}
        </h2>
        {description && <p className="mt-1.5 max-w-[46ch] text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
        {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
