import React from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  /** Short factual count or context, set in mono next to the title (e.g. "92 tracks"). */
  meta?: React.ReactNode;
  /** Buttons and inputs on the right. */
  actions?: React.ReactNode;
  /** A row under the title: tabs, filters. */
  children?: React.ReactNode;
  className?: string;
}

/** The top of every page: bold grotesk title, mono meta, actions, optional tab row. */
export function PageHeader({ title, meta, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn("border-b border-border px-5 pt-5 md:px-8 md:pt-7", children ? "pb-3" : "pb-5", className)}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h1 className="k-title truncate">{title}</h1>
          {meta && <span className="k-num shrink-0 text-[13px] text-muted-foreground">{meta}</span>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

interface SectionHeaderProps {
  title: React.ReactNode;
  count?: number;
  actions?: React.ReactNode;
  className?: string;
  as?: "h2" | "h3";
}

/** In-page section heading with an optional mono count. */
export function SectionHeader({ title, count, actions, className, as: Tag = "h2" }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      <div className="flex items-baseline gap-2.5">
        <Tag className="k-heading">{title}</Tag>
        {count !== undefined && <span className="k-num text-xs text-muted-foreground">{count}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
