import React from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { DJSidebar } from './DJSidebar';

interface DJLayoutProps {
  children: React.ReactNode;
}

export function DJLayout({ children }: DJLayoutProps) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DJSidebar />
        
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="h-14 border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30">
            <div className="flex items-center h-full px-4 gap-4">
              <SidebarTrigger className="text-foreground hover:bg-muted" />
              <div className="flex-1" />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}