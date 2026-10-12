import { Link, useLocation } from "react-router-dom";
import { useTheme } from "next-themes";
import { FolderInput, Layers, Library, Moon, Settings, Sun } from "lucide-react";

import { Wordmark } from "@/components/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const navigation = [
  { title: "Library", url: "/", icon: Library, match: (p: string) => p === "/" || p.startsWith("/song/") },
  { title: "Sets", url: "/sets", icon: Layers, match: (p: string) => p.startsWith("/sets") },
  { title: "Import", url: "/load-files", icon: FolderInput, match: (p: string) => p.startsWith("/load-files") },
  { title: "Settings", url: "/settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

/** The ink rail: wordmark, the four real destinations, theme and collapse controls. */
export function DJSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const collapsed = state === "collapsed" && !isMobile;
  const isInk = resolvedTheme !== "light";

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <div aria-hidden className="k-grain-layer k-grain-layer--ink" />
      <SidebarHeader className="relative h-16 justify-center px-4 group-data-[collapsible=icon]:px-0">
        <Link
          to="/"
          onClick={closeOnMobile}
          className={cn(
            "flex items-center rounded-md text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            collapsed ? "justify-center" : "px-1",
          )}
        >
          <Wordmark markOnly={collapsed} className={collapsed ? "text-[1.375rem]" : "text-[1.1875rem]"} />
        </Link>
      </SidebarHeader>

      <SidebarContent className="relative px-3 pt-4 group-data-[collapsible=icon]:px-0">
        <nav aria-label="Main">
          <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
            {navigation.map((item) => {
              const active = item.match(pathname);
              return (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    isActive={active}
                    tooltip={item.title}
                    className="data-[active=true]:[&>svg]:text-signal"
                  >
                    <Link to={item.url} aria-current={active ? "page" : undefined} onClick={closeOnMobile}>
                      {active && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-5 w-2.5 -translate-y-1/2 rounded-r-full bg-signal"
                        />
                      )}
                      <item.icon strokeWidth={1.75} />
                      <span className="group-data-[collapsible=icon]:sr-only">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </nav>
      </SidebarContent>

      <SidebarFooter className="relative flex-row items-center justify-between gap-1 border-t border-sidebar-border px-3 py-3 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:px-0">
        <button
          type="button"
          onClick={() => setTheme(isInk ? "light" : "dark")}
          aria-label={isInk ? "Switch to the paper theme" : "Switch to the ink theme"}
          title={isInk ? "Paper theme" : "Ink theme"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-sidebar-foreground transition-colors duration-fast hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          {isInk ? <Sun className="h-4 w-4" strokeWidth={1.75} /> : <Moon className="h-4 w-4" strokeWidth={1.75} />}
        </button>
        {!isMobile && (
          <SidebarTrigger
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand (Ctrl+B)" : "Collapse (Ctrl+B)"}
            className="h-9 w-9 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
