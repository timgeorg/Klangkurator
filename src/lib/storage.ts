// Unified storage service — LocalStorage (browser dev) or RemoteStorage (backend API).
// All methods are async so they work with both backends.
// All 20 consuming components use `storage.*` — a Proxy resolves to the active backend.

import { api } from "./api";

// ── Interfaces (unchanged from original) ──────────────────

/**
 * Another file of the same recording (issue #65). A variant carries no BPM,
 * rating, note or tag: those belong to the track, once. Its format facts are
 * stored at attach time so a listing never probes a 36 MB `.wav` per row.
 */
export interface AudioVariant {
  id: string;
  file_path: string;
  /** The suffix without the dot, lowercased (`mp3`, `wav`, `flac`). */
  format: string;
  duration?: number;
  /** kbps. */
  bitrate?: number;
  sample_rate?: number;
  bit_depth?: number;
  size_bytes?: number;
  added_at: string;
  /**
   * A tempo recorded for *this file* by an earlier analysis or its TBPM tag.
   * Never the track's BPM; it exists so the re-analyze popup can show a
   * half-tempo disagreement instead of hiding it.
   */
  bpm_reading?: number;
  /** Derived by the backend on every read: the file is not on this machine. */
  missing?: boolean;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  bpm?: number;
  musical_key?: string;
  duration?: number;
  mainGenre?: string;
  subgenres?: string[];
  /** @deprecated Use mainGenre and subgenres instead */
  genres?: string[];
  /** @deprecated Use mainGenre instead */
  genre?: string;
  year?: number;
  file_path: string;
  artwork_url?: string;
  /** Energy and people are the two 0–5 ratings, one decimal each; 0 = unrated. */
  energy: number;
  /** 0–5, one decimal; 0 or missing reads as unrated (issue #48). */
  people?: number;
  rank?: number;
  drum_notes?: string;
  element_notes?: string;
  mixing_notes?: string;
  lyrics?: string;
  phase_tags?: string[];
  vibe_tags?: string[];
  transition_notes?: string;
  root_folder?: string;
  waveform_peaks?: number[];
  /** Other files of the same recording. `file_path` stays the primary (INV-14). */
  audio_variants?: AudioVariant[];
  /** Derived on read: the primary's file is gone, so playback uses a variant. */
  primary_missing?: boolean;
  created_at: string;
  updated_at: string;
}

/** The BPM hint for a re-analysis: both bounds or neither (issue #6). */
export interface BpmRange {
  min: number;
  max: number;
}

/** What a per-track re-analysis detected and actually wrote (issue #6). */
export interface ReanalyzeResult {
  song_id: string;
  bpm: number | null;
  musical_key: string | null;
  duration: number | null;
  /** Whether the detected BPM sits inside the requested range (always true without one). */
  bpm_fit: boolean;
  /** The fields that were written — a hint that did not fit leaves `bpm` out. */
  applied: Partial<Pick<Song, "bpm" | "musical_key" | "duration">>;
  /** The track's BPM after the run, and a variant's own reading when it differs. */
  primary_bpm?: number | null;
  variant_bpm?: number | null;
  /** True when the variant reads the primary's tempo doubled or halved. */
  octave_disagreement?: boolean;
}

/**
 * A partial song update. A field set to null clears it (optional fields
 * only; the backend ignores null for required ones); a field left out is not
 * touched.
 */
export type SongPatch = { [K in keyof Song]?: Song[K] | null };

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface SongTag {
  song_id: string;
  tag_id: string;
}

export interface SongRelationship {
  id: string;
  source_song_id: string;
  target_song_id: string;
  relationship_type: 'remix' | 'same_sample' | 'cover' | 'mashup' | 'edit' | 'bootleg' | 'in_playlist' | 'transition';
  notes?: string;
  created_at: string;
}

export interface SongPlaylistMembership {
  playlist: Playlist;
  position: number;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  color: string;
  is_smart_playlist: boolean;
  search_criteria?: unknown;
  created_at: string;
  updated_at: string;
}

export interface PlaylistSong {
  playlist_id: string;
  song_id: string;
  position: number;
}

export interface BlockSong {
  song_id: string;
  position: number;
  transition_notes?: string;
}

export interface Block {
  id: string;
  name: string;
  description?: string;
  color: string;
  songs: BlockSong[];
  created_at: string;
  updated_at: string;
}

export interface AltTransition {
  ref_id: string;
  label?: string;
}

export interface SetItem {
  id: string;
  type: 'song' | 'block';
  ref_id: string;                    // new unified reference field
  /** @legacy frontend uses these before migration */
  song_id?: string;
  block_id?: string;
  position: number;
  transition_notes?: string;
  alternative_transitions?: AltTransition[];
}

export interface SetPhase {
  id: string;
  name: string;
  position: number;
  target_duration_min?: number;
  notes?: string;
  items: SetItem[];
}

export interface DJSet {
  id: string;
  name: string;
  description?: string;
  color: string;
  items: SetItem[];        // legacy flat model
  phases: SetPhase[];      // new phase-based model
  event_name?: string;
  event_date?: string;
  target_duration_min?: number;
  crates?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// ── Storage interface ─────────────────────────────────────

export interface StorageInterface {
  getSongs(): Promise<Song[]>;
  getSong(id: string): Promise<Song | null>;
  addSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Promise<Song>;
  updateSong(id: string, updates: SongPatch): Promise<Song | null>;
  deleteSong(id: string): Promise<boolean>;
  getTags(): Promise<Tag[]>;
  addTag(tag: Omit<Tag, 'id' | 'created_at'>): Promise<Tag>;
  updateTag(id: string, updates: Partial<Tag>): Promise<Tag | null>;
  deleteTag(id: string): Promise<boolean>;
  getSongTags(): Promise<SongTag[]>;
  addSongTag(songId: string, tagId: string): Promise<void>;
  removeSongTag(songId: string, tagId: string): Promise<void>;
  getSongRelationships(): Promise<SongRelationship[]>;
  addSongRelationship(rel: Omit<SongRelationship, 'id' | 'created_at'>): Promise<SongRelationship>;
  deleteSongRelationship(id: string): Promise<boolean>;
  getPlaylists(): Promise<Playlist[]>;
  addPlaylist(p: Omit<Playlist, 'id' | 'created_at' | 'updated_at'>): Promise<Playlist>;
  updatePlaylist(id: string, updates: Partial<Playlist>): Promise<Playlist | null>;
  deletePlaylist(id: string): Promise<boolean>;
  getPlaylistSongs(): Promise<PlaylistSong[]>;
  addPlaylistSong(playlistId: string, songId: string, position?: number): Promise<void>;
  removePlaylistSong(playlistId: string, songId: string): Promise<void>;
  getBlocks(): Promise<Block[]>;
  addBlock(block: Omit<Block, 'id' | 'created_at' | 'updated_at'>): Promise<Block>;
  updateBlock(id: string, updates: Partial<Block>): Promise<Block | null>;
  deleteBlock(id: string): Promise<boolean>;
  getSets(): Promise<DJSet[]>;
  addSet(set: Omit<DJSet, 'id' | 'created_at' | 'updated_at'>): Promise<DJSet>;
  updateSet(id: string, updates: Partial<DJSet>): Promise<DJSet | null>;
  deleteSet(id: string): Promise<boolean>;
  searchSongs(query: string): Promise<Song[]>;
  getTagsForSong(songId: string): Promise<Tag[]>;
  getSongsForTag(tagId: string): Promise<Song[]>;
  getRelatedSongs(songId: string): Promise<Array<{ song: Song; relationship: SongRelationship; direction: 'source' | 'target' }>>;
  getTransitionSuggestions(songId: string): Promise<Array<{ song: Song; notes?: string }>>;
  getPlaylistsForSong(songId: string): Promise<SongPlaylistMembership[]>;
  getBlockWithSongs(blockId: string): Promise<{ block: Block; songs: Song[] } | null>;
  /** Issue #10 (PF-83): merge-import an exported library envelope.
   *  resolutions choose per-conflict overwrites; absent = local value wins.
   *  Export goes through a raw fetch download in Settings (api.get
   *  JSON-parses and cannot return a blob), so there is no exportData here. */
  importData(
    envelope: object,
    resolutions?: Array<{ song_id: string; field: string; overwrite: boolean }>,
  ): Promise<boolean>;
  /** Issue #6 (PF-79): re-analyze ONE track's BPM and key, overriding the
   *  library-wide "only fill missing" rule. `range` is an optional BPM hint:
   *  the detector is biased toward it, and when the result does not land
   *  inside, `bpm_fit` is false and the stored BPM is left alone. */
  reanalyzeSong(songId: string, range?: BpmRange): Promise<ReanalyzeResult>;
  /** Issue #65: attach another file of the same recording to a track. */
  attachVariant(songId: string, filePath: string): Promise<Song>;
  /** Issue #65: promote a variant — the paths swap, everything else stays. */
  makeVariantPrimary(songId: string, variantId: string): Promise<Song>;
  /** Issue #65: take a variant off a track. The audio file stays on disk. */
  detachVariant(songId: string, variantId: string): Promise<Song>;
}

// ── RemoteStorage implementation (backend API) ─────────────

class RemoteStorageImpl implements StorageInterface {
  async getSongs() { return api.get<Song[]>('/songs'); }
  async getSong(id: string) { return api.get<Song>(`/songs/${id}`); }
  async addSong(data: Omit<Song, 'id' | 'created_at' | 'updated_at'>) { return api.post<Song>('/songs', data); }
  async updateSong(id: string, u: SongPatch) { return api.put<Song>(`/songs/${id}`, u); }
  async deleteSong(id: string) { await api.delete(`/songs/${id}`); return true; }
  async getTags() { return api.get<Tag[]>('/tags'); }
  async addTag(data: Omit<Tag, 'id' | 'created_at'>) { return api.post<Tag>('/tags', data); }
  async updateTag(id: string, u: Partial<Tag>) { return api.put<Tag>(`/tags/${id}`, u); }
  async deleteTag(id: string) { await api.delete(`/tags/${id}`); return true; }
  async getSongTags() { return api.get<SongTag[]>('/song-tags'); }
  async addSongTag(sid: string, tid: string) { await api.post(`/songs/${sid}/tags`, { tag_id: tid }); }
  async removeSongTag(sid: string, tid: string) { await api.delete(`/songs/${sid}/tags/${tid}`); }
  async getSongRelationships() { return api.get<SongRelationship[]>('/relationships'); }
  async addSongRelationship(data: Omit<SongRelationship, 'id' | 'created_at'>) { return api.post<SongRelationship>('/relationships', data); }
  async deleteSongRelationship(id: string) { await api.delete(`/relationships/${id}`); return true; }
  async getPlaylists() { return api.get<Playlist[]>('/playlists'); }
  async addPlaylist(data: Omit<Playlist, 'id' | 'created_at' | 'updated_at'>) { return api.post<Playlist>('/playlists', data); }
  async updatePlaylist(id: string, u: Partial<Playlist>) { return api.put<Playlist>(`/playlists/${id}`, u); }
  async deletePlaylist(id: string) { await api.delete(`/playlists/${id}`); return true; }
  async getPlaylistSongs() { return api.get<PlaylistSong[]>('/playlist-songs'); }
  async addPlaylistSong(pid: string, sid: string, pos?: number) { await api.post(`/playlists/${pid}/songs`, { song_id: sid, position: pos }); }
  async removePlaylistSong(pid: string, sid: string) { await api.delete(`/playlists/${pid}/songs/${sid}`); }
  async getBlocks() { return api.get<Block[]>('/blocks'); }
  async addBlock(data: Omit<Block, 'id' | 'created_at' | 'updated_at'>) { return api.post<Block>('/blocks', data); }
  async updateBlock(id: string, u: Partial<Block>) { return api.put<Block>(`/blocks/${id}`, u); }
  async deleteBlock(id: string) { await api.delete(`/blocks/${id}`); return true; }
  async getSets() { return api.get<DJSet[]>('/sets'); }
  async addSet(data: Omit<DJSet, 'id' | 'created_at' | 'updated_at'>) { return api.post<DJSet>('/sets', data); }
  async updateSet(id: string, u: Partial<DJSet>) { return api.put<DJSet>(`/sets/${id}`, u); }
  async deleteSet(id: string) { await api.delete(`/sets/${id}`); return true; }
  async searchSongs(q: string) { return api.get<Song[]>(`/songs?search=${encodeURIComponent(q)}`); }
  async getTagsForSong(sid: string) { return api.get<Tag[]>(`/songs/${sid}/tags`); }
  async getSongsForTag(tid: string) { return api.get<Song[]>(`/tags/${tid}/songs`); }
  async getRelatedSongs(id: string) { return api.get<Array<{ song: Song; relationship: SongRelationship; direction: 'source' | 'target' }>>(`/songs/${id}/related`); }
  async getTransitionSuggestions(id: string) { return api.get<Array<{ song: Song; notes?: string }>>(`/songs/${id}/transition-suggestions`); }
  async getPlaylistsForSong(id: string) { return api.get<SongPlaylistMembership[]>(`/songs/${id}/playlists`); }
  async getBlockWithSongs(id: string) {
    const b = await api.get<Block>(`/blocks/${id}`); if (!b) return null;
    const s = await this.getSongs();
    return { block: b, songs: b.songs.sort((x, y) => x.position - y.position).map(bs => s.find(s => s.id === bs.song_id)).filter(Boolean) as Song[] };
  }
  async importData(envelope: object, resolutions?: Array<{ song_id: string; field: string; overwrite: boolean }>) { await api.post('/import', { envelope, resolutions }); return true; }
  async reanalyzeSong(songId: string, range?: BpmRange) {
    return api.post<ReanalyzeResult>(`/library/analyze/${songId}`, range ? { bpm_min: range.min, bpm_max: range.max } : {});
  }
  async attachVariant(songId: string, filePath: string) {
    return api.post<Song>(`/songs/${songId}/variants`, { file_path: filePath });
  }
  async makeVariantPrimary(songId: string, variantId: string) {
    return api.post<Song>(`/songs/${songId}/variants/${variantId}/primary`, {});
  }
  async detachVariant(songId: string, variantId: string) {
    return api.delete<Song>(`/songs/${songId}/variants/${variantId}`);
  }
}

// ── Selector ───────────────────────────────────────────────

let _instance: StorageInterface | null = null;

function resolve(): StorageInterface {
  if (!_instance) {
    _instance = new RemoteStorageImpl();
  }
  return _instance;
}

// Backward-compatible export — components call `storage.method()` and it just works.
export const storage = new Proxy({} as StorageInterface, {
  get(_, prop) { return Reflect.get(resolve(), prop); },
});
