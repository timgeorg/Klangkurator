import React from "react";
import { Link } from "react-router-dom";

import { Wordmark } from "@/components/brand";
import { NowPlaying } from "@/components/dj/NowPlaying";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { usePlayer } from "@/lib/PlayerContext";

import { DJSidebar } from "./DJSidebar";

interface DJLayoutProps {
  children: React.ReactNode;
}

/**
 * App shell: the ink rail on the left, the routed page in the middle, the
 * preview player either as a right-hand panel (wide screens) or a bottom bar.
 * Pages own their scrolling inside <main>.
 */
export function DJLayout({ children }: DJLayoutProps) {
  const { current, dock } = usePlayer();

  return (
    <SidebarProvider defaultOpen={typeof window === "undefined" || window.innerWidth >= 1024}>
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <DJSidebar />
      <div className="k-shell" data-player={current ? dock : "off"}>
        <header className="k-shell-top flex h-14 items-center gap-2 border-b border-sidebar-border bg-sidebar px-2 text-sidebar-foreground md:hidden">
          <SidebarTrigger className="h-10 w-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          <Link to="/" className="rounded-md px-1 text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
            <Wordmark />
          </Link>
        </header>
        <main id="main" tabIndex={-1} className="k-shell-main k-ground focus:outline-none">
          {children}
        </main>
        <NowPlaying />
      </div>
    </SidebarProvider>
  );
}
