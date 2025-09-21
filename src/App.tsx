import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DJLayout } from "@/components/layout/DJLayout";
import { FileLoader } from "@/lib/fileLoader";
import { useEffect } from "react";
import Index from "./pages/Index";
import LoadFiles from "./pages/LoadFiles";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize sample data on first load
    console.log('App: Initializing sample data...');
    FileLoader.initializeSampleData();
    console.log('App: Sample data initialization complete');
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <DJLayout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/load-files" element={<LoadFiles />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DJLayout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
