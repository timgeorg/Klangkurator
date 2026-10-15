import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/lib/PlayerContext";
import { LibraryFilterProvider } from "@/lib/LibraryFilterContext";
import { THEME_STORAGE_KEY } from "@/lib/appearance";
import { DJLayout } from "@/components/layout/DJLayout";
import Index from "./pages/Index";
import LoadFiles from "./pages/LoadFiles";
import SongDetailPage from "./pages/SongDetailPage";
import Sets from "./pages/Sets";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

// The map route is loaded on demand, so the map page and the modules only it
// needs leave the library's first paint (plan › Risks and spikes › Bundle
// size, the phase 2 note's phase 7 checklist item). The relationships
// dialog's graph tab is lazy-loaded the same way, in
// `components/dj/RelationshipGraphTab.tsx`, so the renderer stays out of the
// entry chunk entirely.
const TrackMap = lazy(() => import("./pages/TrackMap"));

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <BrowserRouter>
            {/* Above the routes: the one search and one set of filters the
                table and the map share for the session, so they survive
                navigating between them and the browser's Back (TM-R11). */}
            <LibraryFilterProvider>
              <PlayerProvider>
                <DJLayout>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/load-files" element={<LoadFiles />} />
                    <Route path="/song/:id" element={<SongDetailPage />} />
                    <Route path="/sets" element={<Sets />} />
                    <Route
                      path="/map"
                      element={
                        <Suspense fallback={<MapRouteFallback />}>
                          <TrackMap />
                        </Suspense>
                      }
                    />
                    <Route path="/settings" element={<Settings />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DJLayout>
              </PlayerProvider>
            </LibraryFilterProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

/** Shown while the map's own chunk arrives: a skeleton shaped like the map page. */
function MapRouteFallback() {
  return (
    <div aria-busy="true" aria-label="Loading the map" className="flex h-full min-h-0 flex-col p-5 md:p-8">
      <Skeleton className="h-7 w-24" />
      <Skeleton className="mt-4 min-h-0 flex-1 rounded-lg" />
    </div>
  );
}

export default App;
