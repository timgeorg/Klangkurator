import { describe, expect, it } from "vitest";

import { songRowMeta } from "./SetEditor";

function song(over: Record<string, unknown>) {
  return {
    id: "s1",
    title: "Track",
    artist: "Artist",
    file_path: "/music/house/Artist - Track.mp3",
    crate_id: null,
    mainGenre: null,
    genres: null,
    genre: null,
    ...over,
  } as never;
}

describe("songRowMeta", () => {
  it("falls back to the file's parent folder, as the Crate column does", () => {
    expect(songRowMeta(song({ file_path: "/music/techno-picks/Track.mp3" })).crate).toBe("techno-picks");
  });

  it("gives the artist and the crate the library shows", () => {
    expect(songRowMeta(song({ artist: "Artist", crate_id: "crate-1" }))).toEqual({
      artist: "Artist",
      crate: "crate-1",
      genre: undefined,
    });
  });

  it("leaves a missing crate empty, so the row draws no separator", () => {
    expect(songRowMeta(song({ artist: "Artist", file_path: "Track.mp3" }))).toEqual({
      artist: "Artist",
      crate: "",
      genre: undefined,
    });
  });

  it("treats a whitespace-only artist as missing", () => {
    expect(songRowMeta(song({ artist: "   ", crate_id: "crate-1" }))).toEqual({
      artist: "",
      crate: "crate-1",
      genre: undefined,
    });
  });

  it("leaves a missing genre empty", () => {
    expect(songRowMeta(song({ artist: "", crate_id: "crate-1" })).genre).toBeUndefined();
  });

  it("takes the genre from the tags when there is no main genre", () => {
    expect(songRowMeta(song({ genres: ["Tech House"] })).genre).toBe("Tech House");
  });

  it("prefers the main genre", () => {
    expect(songRowMeta(song({ mainGenre: "House", genres: ["Tech House"] })).genre).toBe("House");
  });
});
