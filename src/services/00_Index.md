---
source: auto
tags:
  - index
---
# Index — src/services

- [[types.ts]] — DataService interface: contract for environment-specific initialization and data management (initializeData, clearData, getEnvironmentName).
- [[DataServiceFactory.ts]] — Factory singleton that selects between LocalDataService (desktop/PyWebView) or MockupDataService (web/development) based on environment detection (pywebview global, user agent, file protocol, localhost).
- [[LocalDataService.ts]] — Data initialization for desktop PyWebView app; loads existing library or adds a minimal welcome sample track if empty.
- [[MockupDataService.ts]] — Comprehensive sample data for development and testing; populates songs with full metadata, relationships, tags, and playlists; supports idempotent initialization and clearing.

**Note:** Not used by the app yet (grep found no imports). This is a legacy data-service layer; the app now uses direct API calls to the backend.
