---
source: manual
created: 2026-08-09
tags:
  - plan
  - implementation
  - mvp
status: active
---
# Phase 3 — Frontend Integration

Status: Active
Estimated: 2 days
Prerequisites: Phase 2 complete

## Goal

Connect the existing React frontend to the FastAPI backend. After this phase,
running `uvicorn` + `npm run dev` gives a working app with real file scanning
and real metadata — no more localStorage, no more mockup data.

## Context

### The integration challenge

**20 files** import `storage` directly from `@/lib/storage`:

| File | What it does |
|---|---|
| `components/dj/SongLibrary.tsx` | Main library table — reads songs, tags |
| `components/dj/SongTableRow.tsx` | Row rendering — reads tags for song |
| `components/dj/EditSongDialog.tsx` | Edit dialog — updates song |
| `components/dj/EditRelationshipsDialog.tsx` | Relationships — reads/creates/deletes |
| `components/dj/SongRelationshipsDialog.tsx` | Relationships view — reads |
| `components/dj/SongRelationshipGraph.tsx` | Graph view — reads |
| `components/dj/LyricsDialog.tsx` | Lyrics — updates song |
| `components/sets/BlockCard.tsx` | Block preview — reads blocks |
| `components/sets/BlockEditor.tsx` | Block editor — CRUD blocks |
| `components/sets/SetCard.tsx` | Set preview — reads sets |
| `components/sets/SetEditor.tsx` | Set editor — CRUD sets |
| `components/ui/tag-selector.tsx` | Tag picker — reads/creates tags |
| `pages/LoadFiles.tsx` | Import — adds songs |
| `pages/Sets.tsx` | Sets page — reads blocks, sets |
| `pages/Settings.tsx` | Settings — reads/deletes tags |
| `services/LocalDataService.ts` | Data service — calls storage |
| `services/MockupDataService.ts` | Data service — calls storage |
| `lib/fileLoader.ts` | File loader — adds songs |

These components call `storage.getSongs()`, `storage.addSong()`, etc.
synchronously. The backend is async (HTTP `fetch`). This is the core
integration work.

### Strategy: async storage layer

**Approach**: Make `storage.ts` methods async (return Promises). The method
signatures stay the same, but callers must `await` them. Components already
use React Query for data fetching, so the migration is natural.

### Why not keep localStorage and sync to backend?

Because the backend is the source of truth now. localStorage is dev mode
only. Having two sources of truth creates sync bugs.

## Tasks

### 3.1 — Create API client (`src/lib/api.ts`)

A thin `fetch` wrapper for the backend:

```typescript
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost<T>(path: string, body?: any): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

// Same for PUT, DELETE
```

Add `VITE_API_BASE` to `.env`:
```
VITE_API_BASE=http://localhost:8000/api
```

### 3.2 — Create `RemoteStorage` class (`src/lib/remoteStorage.ts`)

This class has the **exact same method signatures** as `LocalStorage` in
`storage.ts`, but every method is async and calls the backend:

```typescript
export class RemoteStorage {
  async getSongs(): Promise<Song[]> {
    return apiGet<Song[]>('/songs');
  }

  async addSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song> {
    return apiPost<Song>('/songs', song);
  }

  async updateSong(id: string, updates: Partial<Song>): Promise<Song | null> {
    return apiPut<Song>(`/songs/${id}`, updates);
  }

  async deleteSong(id: string): Promise<boolean> {
    await apiDelete(`/songs/${id}`);
    return true;
  }

  // ... same for all 33 methods
}
```

### 3.3 — Storage selector (`src/lib/storage.ts`)

Update `storage.ts` to export either `LocalStorage` or `RemoteStorage`
based on environment:

```typescript
import { LocalStorage } from './localStorage';
import { RemoteStorage } from './remoteStorage';

const isRemoteMode = import.meta.env.VITE_API_BASE !== undefined;

// Export a storage instance that components use
// All methods are async (Promise-returning) in remote mode
export const storage = isRemoteMode
  ? new RemoteStorage()
  : new LocalStorage();
```

**All methods become async** (return Promises). This is a breaking change for
the 20 consuming files, but the migration is mechanical: add `await` before
each `storage.*` call.

### 3.4 — Migrate components to async

For each of the 20 files that import `storage`:

1. Find all `storage.method()` calls
2. Add `await` before them
3. Wrap in `async` function if not already
4. Handle errors (try/catch or let React Query handle it)

**Components using React Query** (preferred pattern):
- `useQuery(['songs'], () => storage.getSongs())` for reads
- `useMutation({ mutationFn: (data) => storage.addSong(data) })` for writes
- `queryClient.invalidateQueries(['songs'])` after mutations

**Components with direct calls** (simpler components):
- Add `useEffect` + `useState` for data loading
- `const [songs, setSongs] = useState<Song[]>([])`
- `useEffect(() => { storage.getSongs().then(setSongs) }, [])`

**Migration order** (by dependency):
1. `SongLibrary.tsx` — the main table (most important)
2. `EditSongDialog.tsx` — edit dialog
3. `tag-selector.tsx` — tag picker
4. `SongTableRow.tsx` — row rendering
5. `LoadFiles.tsx` — file import
6. `Settings.tsx` — tag management
7. `Sets.tsx` + set/block components — set management
8. Relationship components — relationship CRUD
9. `LyricsDialog.tsx` — lyrics editing

### 3.5 — Update LoadFiles page

Replace the browser File System Access API with a backend scan call:

```typescript
const handleScan = async () => {
  setLoading(true);
  const result = await apiPost('/library/scan', { root_path: rootPath });
  setStats({ total: result.total, added: result.added, skipped: result.skipped });
  setLoading(false);
  // Refresh song list
  queryClient.invalidateQueries(['songs']);
};
```

UI changes:
- Replace file picker with a text input for root path (folder picker comes in Phase 5)
- Add a "Scan" button
- Show progress spinner during scan
- Show results: "Added 180, Skipped 67, Total 247"
- Add a "Root Folder" field that persists (GET/PUT `/api/library/root`)

### 3.6 — Update DataServiceFactory

```typescript
export class DataServiceFactory {
  private static instance: DataService | null = null;

  static getDataService(): DataService {
    if (this.instance) return this.instance;

    const isRemote = import.meta.env.VITE_API_BASE !== undefined;
    
    if (isRemote) {
      this.instance = new RemoteDataService();
    } else {
      this.instance = new MockupDataService();
    }
    return this.instance;
  }
}
```

`RemoteDataService` just calls `storage.initializeData()` which is now a
no-op (backend is the source of truth, no seed data needed).

### 3.7 — Remove MockupDataService from App.tsx

Currently `App.tsx` forces `MockupDataService`:
```typescript
const mockupService = new MockupDataService();
DataServiceFactory.setDataService(mockupService);
```

Change to:
```typescript
const dataService = DataServiceFactory.getDataService();
dataService.initializeData();
```

In remote mode, `initializeData()` is a no-op.
In dev mode, `initializeData()` seeds sample data (existing behavior).

### 3.8 — Remove Supabase dependency

The project still has `@supabase/supabase-js` in `package.json` and a
`src/integrations/supabase/` folder. Remove both — they're unused and
conflict with the local-only principle.

### 3.9 — Vite dev proxy

Add to `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

This lets the frontend call `/api/songs` (relative) instead of
`http://localhost:8000/api/songs` (absolute). Avoids CORS issues in dev.

## Deliverable

```bash
# Terminal 1: Start backend
cd dj-crate-explorer && /home/tim/Vault/.venv/bin/uvicorn backend.main:app --reload --port 8000

# Terminal 2: Start frontend
cd dj-crate-explorer && npm run dev
```

- Open `http://localhost:5173`
- Go to "Load Files" → enter a music folder path → click "Scan"
- Library table shows real tracks with real metadata from mutagen
- Edit a song's notes → changes persist to `~/.klangkurator/library.json`
- Create tags, assign to songs → persists
- Create blocks and sets → persists

## Key Decisions

- **Async storage**: all `storage.*` methods return Promises. Components
  must `await`. This is a breaking change but mechanical — add `await`.
- **React Query for data fetching**: components that already use React
  Query get `useQuery`/`useMutation` patterns. Components that don't get
  `useEffect` + `useState` (can upgrade to React Query later).
- **Vite proxy**: avoid CORS in dev by proxying `/api` to the backend.
- **No offline mode**: if the backend is down, the app shows an error.
  localStorage fallback is not worth the complexity for MVP.

## Risks

- **20-file migration is tedious but not hard.** Each file needs `await`
  added to storage calls. Risk: missing an `await` causes a Promise to be
  stored instead of data → blank UI. Test each component after migration.
- **React Query cache invalidation**: after a mutation (add/update/delete),
  must invalidate the relevant query key or the UI shows stale data.
  Convention: `['songs']`, `['tags']`, `['blocks']`, `['sets']`.
- **Set model migration**: existing sets use flat `items[]`. New sets use
  `phases[]`. The SetEditor needs to handle both during migration. For MVP:
  existing sets show in "legacy mode" (flat list), new sets use phases.