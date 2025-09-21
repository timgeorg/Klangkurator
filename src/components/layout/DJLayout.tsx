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
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-12 border-b border-table-border bg-table-header flex items-center px-4 flex-shrink-0">
            <SidebarTrigger className="text-foreground hover:bg-table-row-hover" />
          </header>

          {/* Main Content */}
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}