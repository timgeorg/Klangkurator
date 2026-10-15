// Track map (issue #8) — the library's Table | Map switch (plan phase 7,
// TM-E1). The map is the library's other view, so the switch sits in the
// header of both: the table's and the map's. It is a pair of links, so each
// view is a real destination (the browser's Back works) and the app sidebar's
// Library item stays active on both (TM-M1). The search and filters are the
// shared session state above the routes, so they carry across the switch both
// ways (TM-R11). Below the app's 768 px breakpoint the switch is left out: the
// table is the only way to browse there, and `/map` shows its own notice
// (TM-E4).
import { Link, useLocation } from "react-router-dom";
import { Map as MapIcon, Table2 } from "lucide-react";

import { MAP_PATH, isMapRoute } from "@/lib/mapRoute";
import { cn } from "@/lib/utils";

const VIEWS = [
  { label: "Table", to: "/", icon: Table2, onMap: false },
  { label: "Map", to: MAP_PATH, icon: MapIcon, onMap: true },
] as const;

/**
 * The library's two views as one segmented control — **Table** and **Map** —
 * with the current one in the active-tab treatment. Both are links, so the
 * shared search and filters survive the switch and the browser's Back.
 *
 * `fromTable` (issue #34) adds the flag to the Map link when the switch sits in
 * the table's header, so the map knows it was reached *from the table* and can
 * focus the playing track. The map's own header does not pass it, so arriving
 * there by the sidebar — or going Back — is left alone.
 */
export function LibraryViewSwitch({ fromTable = false }: { fromTable?: boolean }) {
  const { pathname } = useLocation();
  const onMap = isMapRoute(pathname);

  return (
    <nav aria-label="Library view" className="flex items-center gap-1">
      {VIEWS.map((view) => {
        const active = view.onMap === onMap;
        const to = view.onMap && fromTable ? `${view.to}?from=table` : view.to;
        return (
          <Link
            key={view.label}
            to={to}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-chip px-3.5 text-[13px] font-medium transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-signal-soft text-signal-text" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <view.icon className="h-3.5 w-3.5" />
            {view.label}
          </Link>
        );
      })}
    </nav>
  );
}
