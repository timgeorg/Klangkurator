import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The preferences and genre documents as files (issue #51).
 *
 * The files are the only store since 2026-10-30: nothing is read from the
 * browser and nothing is written back to it, so copying the data folder
 * reproduces the app. `stubStorage` exists to prove exactly that — it records
 * every write so a test can assert there were none.
 */

type Call = { method: string; path: string; body?: unknown };

function stubBackend(initial: { settings?: unknown; genres?: unknown } = {}) {
  const calls: Call[] = [];
  let settings = initial.settings ?? {};
  let genres = initial.genres ?? [];

  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const path = String(input).replace("/api", "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path, body });

    if (path === "/settings" && method === "GET") return json(settings);
    if (path === "/settings" && method === "PUT") {
      settings = { ...settings, ...body };
      return json(settings);
    }
    if (path === "/genres" && method === "GET") return json(genres);
    if (path === "/genres" && method === "PUT") {
      genres = body;
      return json(genres);
    }
    // The crate registry loads beside them (issue #11); an empty one keeps
    // these tests about the settings document alone.
    if (path === "/library/crates" || path === "/library/locations") return json([]);
    return json({}, 404);
  });

  return { calls, reads: () => ({ settings, genres }) };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Every key a test wrote to the browser copy, to prove nothing goes there. */
let writes: string[] = [];

function storageWrites(): string[] {
  return writes;
}

/** A `localStorage` with no persistence, recording every write. */
function stubStorage(seed: Record<string, string> = {}) {
  const store = { ...seed };
  writes = [];
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { writes.push(key); store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  });
  return store;
}

/** A browser still holding the pre-#51 keys; every test asserts it is ignored. */
const LEGACY = {
  "klangkurator.theme.v1": "light",
  "klangkurator.covers.v1": "original",
  "klangkurator.player.dock.v1": "bar",
  "klangkurator.player.volume.v1": "0.25",
  "klangkurator.crates.expanded": "1",
  "dj_database_genre_config": JSON.stringify([{ name: "Legacy Techno", color: "#123456", subgenres: ["Legacy Sub"] }]),
  "klangkurator.columnConfig.v1": JSON.stringify({
    order: ["play", "cover", "title", "artist", "bpm", "key", "energy", "people", "rank", "album", "rootFolder", "tags", "lyrics", "notes", "genre", "subgenres", "duration", "preview"],
    visibility: { play: true, cover: true, title: true, artist: true, bpm: true, key: true, energy: false, people: true, rank: true, album: true, rootFolder: true, tags: true, lyrics: true, notes: true, genre: true, subgenres: true, duration: true, preview: true },
    widths: { title: 420 },
    sized: ["title"],
  }),
};

async function freshModule() {
  vi.resetModules();
  return import("./settings");
}

describe("the documents are the only store", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads both documents and nothing else", async () => {
    // Nothing is read from the browser any more: no migration, no fallback.
    stubStorage(LEGACY);
    const backend = stubBackend({ settings: { theme: "light", volume: 0.25 }, genres: [] });

    const mod = await freshModule();
    await mod.loadSettings();

    expect(mod.getSettings().theme).toBe("light");
    expect(mod.getSettings().volume).toBe(0.25);
    // The browser's genre list is ignored; the file's empty list wins.
    expect(mod.getGenres()).toEqual([]);
    expect(backend.calls.filter((c) => c.method === "PUT")).toEqual([]);
    expect(storageWrites()).toEqual([]);
  });

  it("never writes a preference or the genres back to the browser", async () => {
    stubStorage({});
    const backend = stubBackend({ genres: [{ name: "House", color: "#fff", subgenres: [] }] });
    const mod = await freshModule();
    await mod.loadSettings();

    mod.saveSettings({ theme: "paper" });
    mod.setGenres([{ name: "Techno", color: "#000", subgenres: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(backend.reads().settings.theme).toBe("paper");
    expect(backend.reads().genres).toEqual([{ name: "Techno", color: "#000", subgenres: [] }]);
    // `saveSettings` and `setGenres` reach the files, never the browser.
    expect(storageWrites()).toEqual([]);
  });

  it("still loads when the browser denies storage access", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
      clear: () => { throw new Error("denied"); },
    });
    const backend = stubBackend({ settings: { theme: "light" } });

    const mod = await freshModule();
    await mod.loadSettings();

    expect(mod.getSettings().theme).toBe("light");
    expect(backend.calls.every((c) => c.method === "GET")).toBe(true);
  });
});

describe("writes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sends unchanged values nowhere", async () => {
    stubStorage({});
    const backend = stubBackend({ settings: { volume: 0.5 } });
    const mod = await freshModule();
    await mod.loadSettings();

    // A component that initialises from the document and saves on mount.
    mod.saveSettings({ volume: 0.5 });
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(backend.calls.filter((c) => c.method === "PUT")).toEqual([]);
  });

  it("debounces a burst into one request that carries the last value", async () => {
    stubStorage({});
    const backend = stubBackend();
    const mod = await freshModule();
    await mod.loadSettings();

    mod.saveSettings({ volume: 0.2 });
    mod.saveSettings({ volume: 0.6 });
    mod.saveSettings({ volume: 0.9 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const puts = backend.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ volume: 0.9 });
  });
});

describe("the two debounced writes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("a genre change and a preference change both reach the backend", async () => {
    // They used to share one debounce handle, so the second cancelled the
    // first: adding a genre right after a theme change lost the genre.
    stubStorage({});
    const backend = stubBackend({ genres: [] });
    const mod = await freshModule();
    await mod.loadSettings();

    mod.saveSettings({ theme: "dark" });
    mod.setGenres([{ name: "Ambient", color: "#123456", subgenres: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const puts = backend.calls.filter((c) => c.method === "PUT");
    expect(puts.map((c) => c.path).sort()).toEqual(["/genres", "/settings"]);
    expect(backend.reads().genres).toEqual([{ name: "Ambient", color: "#123456", subgenres: [] }]);
    expect(backend.reads().settings.theme).toBe("dark");
  });

  it("a genre set twice in a row sends only the last one", async () => {
    stubStorage({});
    const backend = stubBackend({ genres: [] });
    const mod = await freshModule();
    await mod.loadSettings();

    mod.setGenres([{ name: "A", color: "#111111", subgenres: [] }]);
    mod.setGenres([{ name: "B", color: "#222222", subgenres: [] }]);
    await new Promise((resolve) => setTimeout(resolve, 600));

    const puts = backend.calls.filter((c) => c.method === "PUT");
    expect(puts).toHaveLength(1);
    expect(backend.reads().genres).toEqual([{ name: "B", color: "#222222", subgenres: [] }]);
  });
});

describe("the read paths (review of #51)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("an emptied genre list stays empty instead of resurrecting the defaults", async () => {
    // Deleting every genre used to make `getGenreConfig` fall back to the 13
    // defaults, which the next edit then wrote back over the file.
    stubStorage({});
    stubBackend({ genres: [] });
    const mod = await freshModule();
    await mod.loadSettings();
    const { getGenreConfig } = await import("./genreData");

    expect(getGenreConfig()).toEqual([]);
  });

  it("uses the defaults when no genre document was ever stored", async () => {
    stubStorage({
      "dj_database_genre_config": JSON.stringify([{ name: "Legacy", color: "#123456", subgenres: [] }]),
    });
    stubBackend({ genres: [] });
    const mod = await freshModule();
    // Before any load: nothing has been stored, so the defaults apply.
    const { getGenreConfig } = await import("./genreData");
    expect(getGenreConfig().length).toBeGreaterThan(1);
    await mod.loadSettings();
  });

  it("refreshGenres re-reads the list without writing it back", async () => {
    // An import merges genres server-side; a stale copy would delete them on
    // the next edit, because PUT /api/genres replaces the whole list.
    stubStorage({});
    const backend = stubBackend({ genres: [{ name: "House", color: "#fff", subgenres: [] }] });
    const mod = await freshModule();
    await mod.loadSettings();
    expect(mod.getGenres()).toHaveLength(1);

    backend.calls.length = 0;
    // The backend now has two more genres, as an import would leave it.
    vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
      const path = String(input).replace("/api", "");
      if (init?.method === "PUT") backend.calls.push({ method: "PUT", path });
      if (path === "/genres") {
        return json([
          { name: "House", color: "#fff", subgenres: [] },
          { name: "Techno", color: "#111111", subgenres: [] },
        ]);
      }
      return json({});
    });

    await mod.refreshGenres();

    expect(mod.getGenres().map((g) => g.name)).toEqual(["House", "Techno"]);
    expect(backend.calls.filter((c) => c.method === "PUT")).toEqual([]);
  });
});

describe("the map's saved settings (review of #51)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("come from the file, not only from the browser", async () => {
    // The read half was once left on localStorage, so the file's `map` was
    // write-only and the save effect then wrote the defaults over it.
    stubStorage({});  // no browser copy at all: a different browser
    stubBackend({
      settings: { map: { inputs: {}, layers: {}, sections: {}, railOpen: false, leftRailOpen: true } },
      genres: [],
    });
    const mod = await freshModule();
    await mod.loadSettings();

    const { readSetting } = mod;
    const map = readSetting<{ railOpen: boolean }>("map", { railOpen: true });
    expect(map.railOpen).toBe(false);
  });
});
