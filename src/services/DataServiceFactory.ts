import { DataService } from './types';
import { MockupDataService } from './MockupDataService';
import { LocalDataService } from './LocalDataService';

export class DataServiceFactory {
  private static instance: DataService | null = null;

  static getDataService(): DataService {
    if (this.instance) {
      return this.instance;
    }

    // Determine which service to use based on environment
    // For development/web, use mockup service
    // For desktop/pywebview, use local service
    const isDesktop = this.isDesktopEnvironment();
    
    if (isDesktop) {
      console.log('DataServiceFactory: Using LocalDataService for desktop environment');
      this.instance = new LocalDataService();
    } else {
      console.log('DataServiceFactory: Using MockupDataService for development environment');
      this.instance = new MockupDataService();
    }

    return this.instance;
  }

  // Force use of a specific service (for testing or manual override)
  static setDataService(service: DataService): void {
    this.instance = service;
    console.log('DataServiceFactory: Manually set data service to:', service.getEnvironmentName());
  }

  // Reset to allow re-detection
  static reset(): void {
    this.instance = null;
  }

  private static isDesktopEnvironment(): boolean {
    // Check for PyWebView indicators
    // @ts-ignore - pywebview global may not be defined
    if (typeof window !== 'undefined' && window.pywebview) {
      return true;
    }

    // Check user agent for Electron or other desktop indicators
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent.toLowerCase();
      if (userAgent.includes('electron') || userAgent.includes('pywebview')) {
        return true;
      }
    }

    // Check for local file protocol or localhost without port (desktop app indicators)
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      
      if (protocol === 'file:' || 
          (hostname === 'localhost' && !window.location.port) ||
          hostname === '127.0.0.1') {
        return true;
      }
    }

    // Default to web/development environment
    return false;
  }

  // Utility method to get environment info
  static getEnvironmentInfo(): { 
    isDesktop: boolean; 
    serviceName: string; 
    userAgent: string;
    location: string;
  } {
    const isDesktop = this.isDesktopEnvironment();
    const service = this.getDataService();
    
    return {
      isDesktop,
      serviceName: service.getEnvironmentName(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
      location: typeof window !== 'undefined' ? window.location.href : 'Unknown'
    };
  }
}