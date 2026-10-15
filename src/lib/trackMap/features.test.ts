import { describe, expect, it } from "vitest";

import type { SongTag } from "@/lib/storage";

import { buildFeatures, parseCamelot, toFeatures } from "./features";
import type { TrackMapSong } from "./types";

/** A stored song with everything the features read, overridable per test. */
function song(overrides: Partial<TrackMapSong> & { id: string }): TrackMapSong {
  return {
    title: overrides.id,
    artist: "Artist",
    danceability: 0,
    energy: 0,
    social_acceptance: 0,
    ...overrides,
  };
}

describe("parseCamelot", () => {
  it("reads short notation, minor and major", () => {
    expect(parseCamelot("Am")).toEqual({ n: 8, mode: "A" });
    expect(parseCamelot("F#m")).toEqual({ n: 11, mode: "A" });
    expect(parseCamelot("Bb")).toEqual({ n: 6, mode: "B" });
    expect(parseCamelot("C")).toEqual({ n: 8, mode: "B" });
    expect(parseCamelot("A#m")).toEqual({ n: 3, mode: "A" });
  });

  it("reads long notation", () => {
    expect(parseCamelot("A minor")).toEqual({ n: 8, mode: "A" });
    expect(parseCamelot("C# major")).toEqual({ n: 3, mode: "B" });
    expect(parseCamelot("C minor")).toEqual({ n: 5, mode: "A" });
    expect(parseCamelot("E major")).toEqual({ n: 12, mode: "B" });
  });

  it("reads Camelot notation", () => {
    expect(parseCamelot("8A")).toEqual({ n: 8, mode: "A" });
    expect(parseCamelot("12B")).toEqual({ n: 12, mode: "B" });
    expect(parseCamelot("1B")).toEqual({ n: 1, mode: "B" });
  });

  it("is case-insensitive", () => {
    expect(parseCamelot("am")).toEqual({ n: 8, mode: "A" });
    expect(parseCamelot("a MINOR")).toEqual({ n: 8, mode: "A" });
    expect(parseCamelot("8a")).toEqual({ n: 8, mode: "A" });
  });

  it("reads ♯ and ♭ beside # and b", () => {
    expect(parseCamelot("F♯m")).toEqual({ n: 11, mode: "A" });
    expect(parseCamelot("B♭")).toEqual({ n: 6, mode: "B" });
    expect(parseCamelot("A♯m")).toEqual({ n: 3, mode: "A" });
  });

  it("shares a code between enharmonics", () => {
    expect(parseCamelot("G#m")).toEqual(parseCamelot("Abm"));
    expect(parseCamelot("Ebm")).toEqual(parseCamelot("D#m"));
    expect(parseCamelot("Gb")).toEqual(parseCamelot("F#"));
    expect(parseCamelot("Gbm")).toEqual({ n: 11, mode: "A" });
  });

  it("gives every code of the plan's table", () => {
    // Code 1: G#m/Abm (A) and B (B); code 3: A#m/Bbm (A) and C#/Db (B).
    expect(parseCamelot("G#m")).toEqual({ n: 1, mode: "A" });
    expect(parseCamelot("B")).toEqual({ n: 1, mode: "B" });
    expect(parseCamelot("Bbm")).toEqual({ n: 3, mode: "A" });
    expect(parseCamelot("C#")).toEqual({ n: 3, mode: "B" });
    expect(parseCamelot("Fm")).toEqual({ n: 4, mode: "A" });
    expect(parseCamelot("G#")).toEqual({ n: 4, mode: "B" });
    expect(parseCamelot("Dm")).toEqual({ n: 7, mode: "A" });
    expect(parseCamelot("F")).toEqual({ n: 7, mode: "B" });
    expect(parseCamelot("Bm")).toEqual({ n: 10, mode: "A" });
    expect(parseCamelot("D")).toEqual({ n: 10, mode: "B" });
    expect(parseCamelot("C#m")).toEqual({ n: 12, mode: "A" });
    expect(parseCamelot("E")).toEqual({ n: 12, mode: "B" });
  });

  it("is missing for anything else", () => {
    expect(parseCamelot(undefined)).toBeUndefined();
    expect(parseCamelot(null)).toBeUndefined();
    expect(parseCamelot("")).toBeUndefined();
    expect(parseCamelot("xyz")).toBeUndefined();
    expect(parseCamelot("H")).toBeUndefined();
    expect(parseCamelot("13A")).toBeUndefined();
    expect(parseCamelot("0A")).toBeUndefined();
    expect(parseCamelot("8C")).toBeUndefined();
    expect(parseCamelot("8A/9A")).toBeUndefined();
    // Spellings outside the plan's table are missing too.
    expect(parseCamelot("Cb")).toBeUndefined();
    expect(parseCamelot("Fb major")).toBeUndefined();
    expect(parseCamelot("B#")).toBeUndefined();
  });
});

describe("toFeatures", () => {
  it("keeps a positive BPM and drops 0, negative and non-finite ones", () => {
    expect(toFeatures(song({ id: "a", bpm: 128 })).bpm).toBe(128);
    expect(toFeatures(song({ id: "a", bpm: 0 })).bpm).toBeUndefined();
    expect(toFeatures(song({ id: "a", bpm: -5 })).bpm).toBeUndefined();
    expect(toFeatures(song({ id: "a", bpm: Number.NaN })).bpm).toBeUndefined();
    expect(toFeatures(song({ id: "a", bpm: Number.POSITIVE_INFINITY })).bpm).toBeUndefined();
    expect(toFeatures(song({ id: "a" })).bpm).toBeUndefined();
  });

  it("treats a rating of 0 as unrated and keeps the rated ones", () => {
    const features = toFeatures(song({ id: "a", energy: 0, danceability: 3.5, social_acceptance: 5 }));
    expect(features.energy).toBeUndefined();
    expect(features.danceability).toBe(3.5);
    expect(features.social_acceptance).toBe(5);
  });

  it("drops 0 and non-finite years and durations", () => {
    const features = toFeatures(song({ id: "a", year: 0, duration: Number.NaN }));
    expect(features.year).toBeUndefined();
    expect(features.duration).toBeUndefined();
    expect(toFeatures(song({ id: "a", year: 2011, duration: 300 })).duration).toBe(300);
  });

  it("lowercases the genre and keeps its display case", () => {
    const features = toFeatures(song({ id: "a", mainGenre: "  Techno  " }));
    expect(features.genre).toBe("techno");
    expect(features.genreLabel).toBe("Techno");
    expect(toFeatures(song({ id: "a" })).genre).toBeUndefined();
    expect(toFeatures(song({ id: "a" })).genreLabel).toBeUndefined();
  });

  it("falls back through trackGenre: mainGenre, then genres[0], then genre", () => {
    expect(toFeatures(song({ id: "a", genres: ["House"] })).genre).toBe("house");
    expect(toFeatures(song({ id: "a", genre: "Trance" })).genre).toBe("trance");
    expect(toFeatures(song({ id: "a", mainGenre: "Techno", genres: ["House"] })).genre).toBe("techno");
  });

  it("lowercases and deduplicates subgenres, dropping blanks", () => {
    const features = toFeatures(song({ id: "a", subgenres: ["Peak Time", "peak time", "  ", "Deep"] }));
    expect(features.subgenres).toEqual(["peak time", "deep"]);
  });

  it("keeps empty sets empty, so the pair skips the input", () => {
    expect(toFeatures(song({ id: "a" })).subgenres).toEqual([]);
    expect(toFeatures(song({ id: "a", subgenres: [] }), []).tagIds).toEqual([]);
  });

  it("reads the key in every notation", () => {
    expect(toFeatures(song({ id: "a", musical_key: "Am" })).key).toEqual({ n: 8, mode: "A" });
    expect(toFeatures(song({ id: "a", musical_key: "8A" })).key).toEqual({ n: 8, mode: "A" });
    expect(toFeatures(song({ id: "a", musical_key: "nonsense" })).key).toBeUndefined();
  });

  it("carries the tag ids it is handed", () => {
    expect(toFeatures(song({ id: "a" }), ["t2", "t1", "t2"]).tagIds).toEqual(["t2", "t1"]);
  });
});

describe("buildFeatures", () => {
  it("joins the song_tags rows onto their songs", () => {
    const songs = [song({ id: "s1" }), song({ id: "s2" }), song({ id: "s3" })];
    const songTags: SongTag[] = [
      { song_id: "s1", tag_id: "dark" },
      { song_id: "s1", tag_id: "peak" },
      { song_id: "s3", tag_id: "dark" },
    ];
    const features = buildFeatures(songs, songTags);
    expect(features.map((feature) => feature.id)).toEqual(["s1", "s2", "s3"]);
    expect(features[0].tagIds).toEqual(["dark", "peak"]);
    expect(features[1].tagIds).toEqual([]);
    expect(features[2].tagIds).toEqual(["dark"]);
  });
});
