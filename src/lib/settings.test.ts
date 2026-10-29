import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one-time migration out of `localStorage` (issue #51).
 *
 * Only the browser can read the old keys, so the copy has to happen in the app.
 * It must run before any component can write its defaults, and it must not
 * repeat once the files are the truth.
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

/** A `localStorage` with no persistence, so each test starts clean. */
function stubStorage(seed: Record<string, string> = {}) {
  const store = { ...seed };
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  });
  return store;
}

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

describe("migration from localStorage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("copies every legacy value into the files on the first start", async () => {
    stubStorage(LEGACY);
    const backend = stubBackend();

    const mod = await freshModule();
    await mod.loadSettings();

    expect(mod.getSettings().theme).toBe("light");
    expect(mod.getSettings().covers).toBe("original");
    expect(mod.getSettings().playerDock).toBe("bar");
    expect(mod.getSettings().volume).toBe(0.25);
    expect(mod.getSettings().crateTabsExpanded).toBe(true);
    expect((mod.getSettings().columns as { widths: { title: number } }).widths.title).toBe(420);
    expect(mod.getGenres()).toEqual([
      { name: "Legacy Techno", color: "#123456", subgenres: ["Legacy Sub"] },
    ]);
    expect(backend.reads().settings).toMatchObject({ theme: "light", volume: 0.25 });
  });

  it("runs once: a second start keeps the files even when the browser differs", async () => {
    const storage = stubStorage(LEGACY);
    stubBackend();
    const mod = await freshModule();
    await mod.loadSettings();
    expect(storage["klangkurator.settingsMigrated.v1"]).toBe("1");

    // The user changes the theme in the app; the browser copy stays stale.
    const backend = stubBackend({
      settings: { theme: "paper", volume: 0.25 },
      genres: [],
    });
    storage["klangkurator.theme.v1"] = "light";
    const again = await freshModule();
    await again.loadSettings();

    expect(again.getSettings().theme).toBe("paper");
    expect(backend.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("never overwrites a value the file already holds", async () => {
    stubStorage({ ...LEGACY, "klangkurator.theme.v1": "dark" });
    const backend = stubBackend({ settings: { theme: "paper" }, genres: [{ name: "House", color: "#fff", subgenres: [] }] });

    const mod = await freshModule();
    await mod.loadSettings();

    expect(mod.getSettings().theme).toBe("paper");
    expect(mod.getGenres()).toEqual([{ name: "House", color: "#fff", subgenres: [] }]);
    expect(backend.reads().settings.theme).toBe("paper");
  });

  it("does nothing in a browser without storage", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("denied"); },
      setItem: () => { throw new Error("denied"); },
      removeItem: () => { throw new Error("denied"); },
      clear: () => { throw new Error("denied"); },
    });
    const backend = stubBackend();

    const mod = await freshModule();
    await mod.loadSettings();

    expect(mod.getSettings()).toEqual({});
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
