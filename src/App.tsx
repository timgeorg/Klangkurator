import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { PlayerProvider } from "@/lib/PlayerContext";
import { THEME_STORAGE_KEY } from "@/lib/appearance";
import { DJLayout } from "@/components/layout/DJLayout";
import Index from "./pages/Index";
import LoadFiles from "./pages/LoadFiles";
import SongDetailPage from "./pages/SongDetailPage";
import Sets from "./pages/Sets";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

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
            <PlayerProvider>
              <DJLayout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/load-files" element={<LoadFiles />} />
                  <Route path="/song/:id" element={<SongDetailPage />} />
                  <Route path="/sets" element={<Sets />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DJLayout>
            </PlayerProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
