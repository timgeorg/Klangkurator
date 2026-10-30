import { describe, expect, it } from "vitest";

import {
  clock,
  extensionOf,
  fileName,
  fileFacts,
  filesOf,
  formatSize,
  octaveApart,
  playableFile,
  variantCount,
} from "./audioVariants";
import type { Song } from "./storage";

const song = (over: Partial<Song> = {}): Song => ({
  id: "s1",
  title: "Skrillex - Scary Monsters and Nice Sprites (Levex Remix)",
  artist: "Levex",
  file_path: "/music/house/Skrillex - Scary Monsters (Levex Remix).mp3",
  duration: 204.624,
  energy: 4.2,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  ...over,
});

const variant = (over = {}) => ({
  id: "v1",
  file_path: "/music/house/Skrillex - Scary Monsters (Levex Remix).wav",
  format: "wav",
  duration: 204.545,
  size_bytes: 36_158_234,
  bit_depth: 24,
  sample_rate: 44100,
  added_at: "2026-10-30T15:00:00Z",
  ...over,
});

describe("filesOf", () => {
  it("lists the primary first, then each variant", () => {
    const rows = filesOf(song({ audio_variants: [variant(), variant({ id: "v2", file_path: "/m/b.flac", format: "flac" })] }));
    expect(rows.map((r) => r.primary)).toEqual([true, false, false]);
    expect(rows.map((r) => r.format)).toEqual(["mp3", "wav", "flac"]);
  });

  it("marks the primary with the row's own facts", () => {
    const [primary] = filesOf(song());
    expect(primary).toMatchObject({ primary: true, format: "mp3", duration: 204.624, missing: false });
  });

  it("carries a missing flag from the backend instead of dropping the row", () => {
    const rows = filesOf(song({ audio_variants: [variant({ missing: true })] }));
    expect(rows).toHaveLength(2);
    expect(rows[1].missing).toBe(true);
  });

  it("marks a missing primary", () => {
    expect(filesOf(song({ primary_missing: true }))[0].missing).toBe(true);
  });

  it("returns nothing for no song", () => {
    expect(filesOf(null)).toEqual([]);
  });

  it("falls back to the path's suffix when no format was stored", () => {
    const rows = filesOf(song({ audio_variants: [variant({ format: "" })] }));
    expect(rows[1].format).toBe("wav");
  });
});

describe("variantCount", () => {
  it("counts the extra files", () => {
    expect(variantCount(song({ audio_variants: [variant(), variant({ id: "v2" })] }))).toBe(2);
  });

  it("is 0 without variants, so no badge shows", () => {
    expect(variantCount(song())).toBe(0);
    expect(variantCount(null)).toBe(0);
  });
});

describe("playableFile", () => {
  it("plays the primary when it is there", () => {
    expect(playableFile(song({ audio_variants: [variant()] }))).toEqual({
      file_path: song().file_path,
      source: "primary",
      missing: false,
    });
  });

  it("plays a variant when the primary's file is gone", () => {
    const chosen = playableFile(song({ primary_missing: true, audio_variants: [variant()] }));
    expect(chosen).toMatchObject({ source: "variant" });
    expect(chosen!.file_path).toContain(".wav");
  });

  it("skips a variant that is missing too", () => {
    const chosen = playableFile(
      song({ primary_missing: true, audio_variants: [variant({ missing: true }), variant({ id: "v2", file_path: "/m/c.flac" })] }),
    );
    expect(chosen).toMatchObject({ source: "variant" });
    expect(chosen!.file_path).toBe("/m/c.flac");
  });

  it("reports a missing primary when nothing is playable", () => {
    const chosen = playableFile(song({ primary_missing: true, audio_variants: [variant({ missing: true })] }));
    expect(chosen).toMatchObject({ source: "primary", missing: true });
  });

  it("returns null for no song", () => {
    expect(playableFile(null)).toBeNull();
  });
});

describe("formatSize", () => {
  it("reads a lossless master and a compressed copy the way a DJ would", () => {
    expect(formatSize(36_158_234)).toBe("36 MB");
    expect(formatSize(9_900_000)).toBe("9.9 MB");
    expect(formatSize(812_000)).toBe("812 KB");
  });

  it("shows a dash for a size it never read", () => {
    expect(formatSize(undefined)).toBe("–");
    expect(formatSize(0)).toBe("–");
  });
});

describe("fileFacts", () => {
  it("joins the facts a file line shows, skipping the ones it lacks", () => {
    const [, wav] = filesOf(song({ audio_variants: [variant()] }));
    expect(fileFacts(wav)).toBe("WAV · 3:25 · 36 MB · 24-bit · 44.1 kHz");
  });

  it("shows no trailing separators when facts are missing", () => {
    const [primary] = filesOf(song());
    expect(fileFacts(primary)).toBe("MP3 · 3:25");
  });
});

describe("clock and names", () => {
  it("formats seconds as m:ss", () => {
    expect(clock(204.624)).toBe("3:25");
    expect(clock(6)).toBe("0:06");
  });

  it("takes the file name from either separator style", () => {
    expect(fileName("/a/b/c.wav")).toBe("c.wav");
    expect(fileName("C:\\a\\b\\c.wav")).toBe("c.wav");
    expect(extensionOf("/a/b/c.WAV")).toBe("wav");
  });
});

describe("octaveApart", () => {
  it("flags the measured pair", () => {
    expect(octaveApart(132, 66.3)).toBe(true);
    expect(octaveApart(66.3, 132)).toBe(true);
  });

  it("does not flag two unrelated tempos", () => {
    expect(octaveApart(132, 128)).toBe(false);
    expect(octaveApart(132, 132)).toBe(false);
  });

  it("says nothing when either value is absent", () => {
    expect(octaveApart(132, null)).toBe(false);
    expect(octaveApart(null, 66)).toBe(false);
  });
});
