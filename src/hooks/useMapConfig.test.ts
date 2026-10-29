import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The map's saved settings come from `settings.json` (issue #51).
 *
 * The first cut of #51 converted only the write half of this hook: the map's
 * document was written but never read, and the save effect then replaced the
 * user's weights and layer switches with the defaults on the first mount.
 */

function stubStorage(seed: Record<string, string> = {}) {
  const store = { ...seed };
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
  });
}

async function withSettings(settings: Record<string, unknown>, storage: Record<string, string> = {}) {
  stubStorage(storage);
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify(settings), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  vi.resetModules();
  const settingsModule = await import("@/lib/settings");
  await settingsModule.loadSettings();
  return import("./useMapConfig");
}

describe("the map's saved settings", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("come from the file when the browser has nothing", async () => {
    const { loadPersistedMapConfig } = await withSettings({
      map: { inputs: {}, layers: {}, sections: {}, railOpen: false, leftRailOpen: true },
    });

    expect(loadPersistedMapConfig().railOpen).toBe(false);
  });

  it("keep the stored similarity weights", async () => {
    const { loadPersistedMapConfig } = await withSettings({
      map: {
        inputs: { bpm: { enabled: true, weight: 2.5 } },
        layers: { relationships: false },
        sections: { similarity: false },
        railOpen: true,
        leftRailOpen: true,
      },
    });

    const config = loadPersistedMapConfig();
    expect(config.inputs.bpm).toEqual({ enabled: true, weight: 2.5 });
    expect(config.layers.relationships).toBe(false);
  });

  it("fall back to the browser copy while the file has no map", async () => {
    const browser = JSON.stringify({
      inputs: {}, layers: {}, sections: {}, railOpen: false, leftRailOpen: false,
    });
    // The key is a literal here: destructuring it from the module before the
    // dynamic import resolves would read it in its temporal dead zone.
    const { loadPersistedMapConfig } = await withSettings(
      {},
      { "klangkurator.map.v1": browser },
    );

    expect(loadPersistedMapConfig().leftRailOpen).toBe(false);
  });
});
