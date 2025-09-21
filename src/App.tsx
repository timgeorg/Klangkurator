import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DJLayout } from "@/components/layout/DJLayout";
import { DataServiceFactory } from "@/services/DataServiceFactory";
import { useEffect } from "react";
import Index from "./pages/Index";
import LoadFiles from "./pages/LoadFiles";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function App() {
  useEffect(() => {
    // Initialize data using the appropriate service
    console.log('App: Initializing data service...');
    
    // Force use of MockupDataService for development
    const { MockupDataService } = require('@/services/MockupDataService');
    const mockupService = new MockupDataService();
    DataServiceFactory.setDataService(mockupService);
    
    const dataService = DataServiceFactory.getDataService();
    const envInfo = DataServiceFactory.getEnvironmentInfo();
    
    console.log('App: Environment info:', envInfo);
    console.log('App: Using data service:', dataService.getEnvironmentName());
    
    dataService.initializeData();
    console.log('App: Data service initialization complete');
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
