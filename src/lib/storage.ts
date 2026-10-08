// Unified storage service — LocalStorage (browser dev) or RemoteStorage (backend API).
// All methods are async so they work with both backends.
// All 20 consuming components use `storage.*` — a Proxy resolves to the active backend.

import { api } from "./api";

// ── Interfaces (unchanged from original) ──────────────────

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
  danceability: number;
  energy: number;
  social_acceptance: number;
  drum_notes?: string;
  element_notes?: string;
  mixing_notes?: string;
  lyrics?: string;
  phase_tags?: string[];
  vibe_tags?: string[];
  transition_notes?: string;
  root_folder?: string;
  waveform_peaks?: number[];
  created_at: string;
  updated_at: string;
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
  search_criteria?: any;
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
  exportData(): Promise<string>;
  importData(jsonData: string): Promise<boolean>;
}

// ── LocalStorage implementation (browser dev fallback) ──────

class LocalStorageImpl implements StorageInterface {
  private getKey(t: string) { return `dj_database_${t}`; }
  private getData<T>(k: string): T[] { const d = localStorage.getItem(this.getKey(k)); return d ? JSON.parse(d) : []; }
  private setData<T>(k: string, v: T[]) { localStorage.setItem(this.getKey(k), JSON.stringify(v)); }

  async getSongs() { return this.getData<Song>('songs'); }
  async getSong(id: string) { return this.getData<Song>('songs').find(s => s.id === id) || null; }
  async addSong(data: Omit<Song, 'id' | 'created_at' | 'updated_at'>) {
    const s: Song = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.setData('songs', [...this.getData<Song>('songs'), s]); return s;
  }
  async updateSong(id: string, u: SongPatch) {
    const a = this.getData<Song>('songs'); const i = a.findIndex(s => s.id === id);
    if (i < 0) return null; a[i] = { ...a[i], ...u, updated_at: new Date().toISOString() } as Song; this.setData('songs', a); return a[i];
  }
  async deleteSong(id: string) {
    const b = this.getData<Song>('songs').length;
    this.setData('songs', this.getData<Song>('songs').filter(s => s.id !== id));
    if (this.getData<Song>('songs').length === b) return false;
    this.setData('song_tags', this.getData<SongTag>('song_tags').filter(x => x.song_id !== id));
    this.setData('song_relationships', this.getData<SongRelationship>('song_relationships').filter(r => r.source_song_id !== id && r.target_song_id !== id));
    this.setData('playlist_songs', this.getData<PlaylistSong>('playlist_songs').filter(x => x.song_id !== id));
    return true;
  }
  async getTags() { return this.getData<Tag>('tags'); }
  async addTag(data: Omit<Tag, 'id' | 'created_at'>) {
    const t: Tag = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this.setData('tags', [...this.getData<Tag>('tags'), t]); return t;
  }
  async updateTag(id: string, u: Partial<Tag>) {
    const a = this.getData<Tag>('tags'); const i = a.findIndex(t => t.id === id);
    if (i < 0) return null; a[i] = { ...a[i], ...u }; this.setData('tags', a); return a[i];
  }
  async deleteTag(id: string) {
    const b = this.getData<Tag>('tags').length;
    this.setData('tags', this.getData<Tag>('tags').filter(t => t.id !== id));
    if (this.getData<Tag>('tags').length === b) return false;
    this.setData('song_tags', this.getData<SongTag>('song_tags').filter(x => x.tag_id !== id)); return true;
  }
  async getSongTags() { return this.getData<SongTag>('song_tags'); }
  async addSongTag(songId: string, tagId: string) {
    const a = this.getSongTags();
    if (!(await a).some(x => x.song_id === songId && x.tag_id === tagId)) this.setData('song_tags', [...await a, { song_id: songId, tag_id: tagId }]);
  }
  async removeSongTag(songId: string, tagId: string) { this.setData('song_tags', this.getData<SongTag>('song_tags').filter(x => !(x.song_id === songId && x.tag_id === tagId))); }
  async getSongRelationships() { return this.getData<SongRelationship>('song_relationships'); }
  async addSongRelationship(data: Omit<SongRelationship, 'id' | 'created_at'>) {
    const r: SongRelationship = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    this.setData('song_relationships', [...this.getData<SongRelationship>('song_relationships'), r]); return r;
  }
  async deleteSongRelationship(id: string) {
    const b = this.getData<SongRelationship>('song_relationships').length;
    this.setData('song_relationships', this.getData<SongRelationship>('song_relationships').filter(r => r.id !== id));
    return this.getData<SongRelationship>('song_relationships').length < b;
  }
  async getPlaylists() { return this.getData<Playlist>('playlists'); }
  async addPlaylist(data: Omit<Playlist, 'id' | 'created_at' | 'updated_at'>) {
    const p: Playlist = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.setData('playlists', [...this.getData<Playlist>('playlists'), p]); return p;
  }
  async updatePlaylist(id: string, u: Partial<Playlist>) {
    const a = this.getData<Playlist>('playlists'); const i = a.findIndex(p => p.id === id);
    if (i < 0) return null; a[i] = { ...a[i], ...u, updated_at: new Date().toISOString() }; this.setData('playlists', a); return a[i];
  }
  async deletePlaylist(id: string) {
    const b = this.getData<Playlist>('playlists').length;
    this.setData('playlists', this.getData<Playlist>('playlists').filter(p => p.id !== id));
    if (this.getData<Playlist>('playlists').length === b) return false;
    this.setData('playlist_songs', this.getData<PlaylistSong>('playlist_songs').filter(x => x.playlist_id !== id)); return true;
  }
  async getPlaylistSongs() { return this.getData<PlaylistSong>('playlist_songs'); }
  async addPlaylistSong(pid: string, sid: string, pos?: number) {
    const a = this.getPlaylistSongs();
    if (!(await a).some(p => p.playlist_id === pid && p.song_id === sid)) {
      const mp = Math.max(...(await a).filter(p => p.playlist_id === pid).map(p => p.position), -1);
      this.setData('playlist_songs', [...await a, { playlist_id: pid, song_id: sid, position: pos ?? mp + 1 }]);
    }
  }
  async removePlaylistSong(pid: string, sid: string) { this.setData('playlist_songs', this.getData<PlaylistSong>('playlist_songs').filter(x => !(x.playlist_id === pid && x.song_id === sid))); }
  async getBlocks() { return this.getData<Block>('blocks'); }
  async addBlock(data: Omit<Block, 'id' | 'created_at' | 'updated_at'>) {
    const b: Block = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.setData('blocks', [...this.getData<Block>('blocks'), b]); return b;
  }
  async updateBlock(id: string, u: Partial<Block>) {
    const a = this.getData<Block>('blocks'); const i = a.findIndex(b => b.id === id);
    if (i < 0) return null; a[i] = { ...a[i], ...u, updated_at: new Date().toISOString() }; this.setData('blocks', a); return a[i];
  }
  async deleteBlock(id: string) {
    const b = this.getData<Block>('blocks').length;
    this.setData('blocks', this.getData<Block>('blocks').filter(b => b.id !== id));
    return this.getData<Block>('blocks').length < b;
  }
  async getSets() { return this.getData<DJSet>('sets'); }
  async addSet(data: Omit<DJSet, 'id' | 'created_at' | 'updated_at'>) {
    const s: DJSet = { ...data, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.setData('sets', [...this.getData<DJSet>('sets'), s]); return s;
  }
  async updateSet(id: string, u: Partial<DJSet>) {
    const a = this.getData<DJSet>('sets'); const i = a.findIndex(s => s.id === id);
    if (i < 0) return null; a[i] = { ...a[i], ...u, updated_at: new Date().toISOString() }; this.setData('sets', a); return a[i];
  }
  async deleteSet(id: string) {
    const b = this.getData<DJSet>('sets').length;
    this.setData('sets', this.getData<DJSet>('sets').filter(s => s.id !== id));
    return this.getData<DJSet>('sets').length < b;
  }
  async searchSongs(q: string) {
    const songs = await this.getSongs(); const lq = q.toLowerCase();
    return songs.filter(s => s.title.toLowerCase().includes(lq) || s.artist.toLowerCase().includes(lq) || s.genres?.some(g => g.toLowerCase().includes(lq)) || s.genre?.toLowerCase().includes(lq) || s.musical_key?.toLowerCase().includes(lq) || s.album?.toLowerCase().includes(lq));
  }
  async getTagsForSong(sid: string) {
    const st = await this.getSongTags(); const ids = st.filter(x => x.song_id === sid).map(x => x.tag_id);
    return (await this.getTags()).filter(t => ids.includes(t.id));
  }
  async getSongsForTag(tid: string) {
    const st = await this.getSongTags(); const ids = st.filter(x => x.tag_id === tid).map(x => x.song_id);
    return (await this.getSongs()).filter(s => ids.includes(s.id));
  }
  async getRelatedSongs(id: string) {
    const [rels, songs] = [await this.getSongRelationships(), await this.getSongs()];
    const r: Array<{ song: Song; relationship: SongRelationship; direction: 'source' | 'target' }> = [];
    rels.forEach(rel => {
      if (rel.source_song_id === id) { const t = songs.find(s => s.id === rel.target_song_id); if (t) r.push({ song: t, relationship: rel, direction: 'target' }); }
      else if (rel.target_song_id === id) { const s = songs.find(s => s.id === rel.source_song_id); if (s) r.push({ song: s, relationship: rel, direction: 'source' }); }
    }); return r;
  }
  async getTransitionSuggestions(id: string) {
    const [rels, songs] = [await this.getSongRelationships(), await this.getSongs()];
    return rels.filter(r => r.relationship_type === 'transition' && r.source_song_id === id)
      .map(rel => { const s = songs.find(s => s.id === rel.target_song_id); return s ? { song: s, notes: rel.notes } : null; })
      .filter(Boolean) as Array<{ song: Song; notes?: string }>;
  }
  async getPlaylistsForSong(id: string) {
    const [ps, pls] = [await this.getPlaylistSongs(), await this.getPlaylists()];
    return ps.filter(p => p.song_id === id).map(p => { const pl = pls.find(pl => pl.id === p.playlist_id); return pl ? { playlist: pl, position: p.position } : null; })
      .filter(Boolean) as SongPlaylistMembership[];
  }
  async getBlockWithSongs(id: string) {
    const b = (await this.getBlocks()).find(b => b.id === id); if (!b) return null;
    const s = await this.getSongs();
    return { block: b, songs: b.songs.sort((x, y) => x.position - y.position).map(bs => s.find(s => s.id === bs.song_id)).filter(Boolean) as Song[] };
  }
  async exportData() {
    const [s, t, st, r, p, ps, b, st2] = [await this.getSongs(), await this.getTags(), await this.getSongTags(), await this.getSongRelationships(), await this.getPlaylists(), await this.getPlaylistSongs(), await this.getBlocks(), await this.getSets()];
    return JSON.stringify({ songs: s, tags: t, song_tags: st, song_relationships: r, playlists: p, playlist_songs: ps, blocks: b, sets: st2 }, null, 2);
  }
  async importData(j: string) { try { const d = JSON.parse(j); if (d.songs) this.setData('songs', d.songs); if (d.tags) this.setData('tags', d.tags); if (d.song_tags) this.setData('song_tags', d.song_tags); if (d.song_relationships) this.setData('song_relationships', d.song_relationships); if (d.playlists) this.setData('playlists', d.playlists); if (d.playlist_songs) this.setData('playlist_songs', d.playlist_songs); if (d.blocks) this.setData('blocks', d.blocks); if (d.sets) this.setData('sets', d.sets); return true; } catch { return false; } }
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
  async exportData() {
    const [s, t, st, r, p, ps, b, st2] = await Promise.all([this.getSongs(), this.getTags(), this.getSongTags(), this.getSongRelationships(), this.getPlaylists(), this.getPlaylistSongs(), this.getBlocks(), this.getSets()]);
    return JSON.stringify({ songs: s, tags: t, song_tags: st, song_relationships: r, playlists: p, playlist_songs: ps, blocks: b, sets: st2 }, null, 2);
  }
  async importData(j: string) { const d = JSON.parse(j); await api.post('/import', d); return true; }
}

// ── Selector ───────────────────────────────────────────────

let _instance: StorageInterface | null = null;

function resolve(): StorageInterface {
  if (!_instance) {
    _instance = new RemoteStorageImpl();
  }
  return _instance;
}

export function switchToLocal() { _instance = new LocalStorageImpl(); }

// Backward-compatible export — components call `storage.method()` and it just works.
export const storage = new Proxy({} as StorageInterface, {
  get(_, prop) { const s = resolve(); return (s as any)[prop]; },
});
