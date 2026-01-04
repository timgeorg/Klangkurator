// Local storage service for DJ database
export interface Song {
  id: string;
  title: string;
  artist: string;
  album?: string;
  bpm?: number;
  musical_key?: string;
  duration?: number; // in seconds
  genre?: string;
  year?: number;
  file_path: string;
  artwork_url?: string;
  
  // DJ-specific ratings (0-5 scale)
  danceability: number;
  energy: number;
  social_acceptance: number;
  
  // Notes about sound characteristics
  drum_notes?: string;
  element_notes?: string;
  mixing_notes?: string;
  
  // Lyrics
  lyrics?: string;
  
  created_at: string;
  updated_at: string;
}

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

// Utility interface for playlist membership display
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

// Block = a sequence of songs with transitions
export interface BlockSong {
  song_id: string;
  position: number;
  transition_notes?: string; // Notes about transition TO the next song
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

// Set = a sequence of songs/blocks with transitions (including alternatives)
export interface SetItem {
  id: string;
  type: 'song' | 'block';
  song_id?: string;
  block_id?: string;
  position: number;
  transition_notes?: string; // Primary transition to next item
  alternative_transitions?: Array<{
    to_song_id?: string;
    to_block_id?: string;
    notes?: string;
  }>;
}

export interface DJSet {
  id: string;
  name: string;
  description?: string;
  color: string;
  items: SetItem[];
  created_at: string;
  updated_at: string;
}

class LocalStorage {
  private getKey(type: string): string {
    return `dj_database_${type}`;
  }

  private getData<T>(key: string): T[] {
    const data = localStorage.getItem(this.getKey(key));
    return data ? JSON.parse(data) : [];
  }

  private setData<T>(key: string, data: T[]): void {
    localStorage.setItem(this.getKey(key), JSON.stringify(data));
  }

  // Songs
  getSongs(): Song[] {
    return this.getData<Song>('songs');
  }

  addSong(song: Omit<Song, 'id' | 'created_at' | 'updated_at'>): Song {
    const songs = this.getSongs();
    const newSong: Song = {
      ...song,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    songs.push(newSong);
    this.setData('songs', songs);
    return newSong;
  }

  updateSong(id: string, updates: Partial<Song>): Song | null {
    const songs = this.getSongs();
    const index = songs.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    songs[index] = { ...songs[index], ...updates, updated_at: new Date().toISOString() };
    this.setData('songs', songs);
    return songs[index];
  }

  deleteSong(id: string): boolean {
    const songs = this.getSongs();
    const filtered = songs.filter(s => s.id !== id);
    if (filtered.length === songs.length) return false;
    
    this.setData('songs', filtered);
    
    // Also remove from song_tags and relationships
    const songTags = this.getSongTags().filter(st => st.song_id !== id);
    this.setData('song_tags', songTags);
    
    const relationships = this.getSongRelationships().filter(
      r => r.source_song_id !== id && r.target_song_id !== id
    );
    this.setData('song_relationships', relationships);
    
    return true;
  }

  // Tags
  getTags(): Tag[] {
    return this.getData<Tag>('tags');
  }

  addTag(tag: Omit<Tag, 'id' | 'created_at'>): Tag {
    const tags = this.getTags();
    const newTag: Tag = {
      ...tag,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    tags.push(newTag);
    this.setData('tags', tags);
    return newTag;
  }

  updateTag(id: string, updates: Partial<Tag>): Tag | null {
    const tags = this.getTags();
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) return null;
    
    tags[index] = { ...tags[index], ...updates };
    this.setData('tags', tags);
    return tags[index];
  }

  deleteTag(id: string): boolean {
    const tags = this.getTags();
    const filtered = tags.filter(t => t.id !== id);
    if (filtered.length === tags.length) return false;
    
    this.setData('tags', filtered);
    
    // Also remove from song_tags
    const songTags = this.getSongTags().filter(st => st.tag_id !== id);
    this.setData('song_tags', songTags);
    
    return true;
  }

  // Song Tags
  getSongTags(): SongTag[] {
    return this.getData<SongTag>('song_tags');
  }

  addSongTag(songId: string, tagId: string): void {
    const songTags = this.getSongTags();
    const exists = songTags.some(st => st.song_id === songId && st.tag_id === tagId);
    if (!exists) {
      songTags.push({ song_id: songId, tag_id: tagId });
      this.setData('song_tags', songTags);
    }
  }

  removeSongTag(songId: string, tagId: string): void {
    const songTags = this.getSongTags();
    const filtered = songTags.filter(st => !(st.song_id === songId && st.tag_id === tagId));
    this.setData('song_tags', filtered);
  }

  // Song Relationships
  getSongRelationships(): SongRelationship[] {
    return this.getData<SongRelationship>('song_relationships');
  }

  addSongRelationship(relationship: Omit<SongRelationship, 'id' | 'created_at'>): SongRelationship {
    const relationships = this.getSongRelationships();
    const newRelationship: SongRelationship = {
      ...relationship,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    relationships.push(newRelationship);
    this.setData('song_relationships', relationships);
    return newRelationship;
  }

  deleteSongRelationship(id: string): boolean {
    const relationships = this.getSongRelationships();
    const filtered = relationships.filter(r => r.id !== id);
    if (filtered.length === relationships.length) return false;
    
    this.setData('song_relationships', filtered);
    return true;
  }

  // Playlists
  getPlaylists(): Playlist[] {
    return this.getData<Playlist>('playlists');
  }

  addPlaylist(playlist: Omit<Playlist, 'id' | 'created_at' | 'updated_at'>): Playlist {
    const playlists = this.getPlaylists();
    const newPlaylist: Playlist = {
      ...playlist,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    playlists.push(newPlaylist);
    this.setData('playlists', playlists);
    return newPlaylist;
  }

  updatePlaylist(id: string, updates: Partial<Playlist>): Playlist | null {
    const playlists = this.getPlaylists();
    const index = playlists.findIndex(p => p.id === id);
    if (index === -1) return null;
    
    playlists[index] = { ...playlists[index], ...updates, updated_at: new Date().toISOString() };
    this.setData('playlists', playlists);
    return playlists[index];
  }

  deletePlaylist(id: string): boolean {
    const playlists = this.getPlaylists();
    const filtered = playlists.filter(p => p.id !== id);
    if (filtered.length === playlists.length) return false;
    
    this.setData('playlists', filtered);
    
    // Also remove playlist songs
    const playlistSongs = this.getPlaylistSongs().filter(ps => ps.playlist_id !== id);
    this.setData('playlist_songs', playlistSongs);
    
    return true;
  }

  // Playlist Songs
  getPlaylistSongs(): PlaylistSong[] {
    return this.getData<PlaylistSong>('playlist_songs');
  }

  addPlaylistSong(playlistId: string, songId: string, position?: number): void {
    const playlistSongs = this.getPlaylistSongs();
    const exists = playlistSongs.some(ps => ps.playlist_id === playlistId && ps.song_id === songId);
    if (!exists) {
      const maxPosition = Math.max(...playlistSongs
        .filter(ps => ps.playlist_id === playlistId)
        .map(ps => ps.position), -1);
      
      playlistSongs.push({ 
        playlist_id: playlistId, 
        song_id: songId, 
        position: position ?? maxPosition + 1 
      });
      this.setData('playlist_songs', playlistSongs);
    }
  }

  removePlaylistSong(playlistId: string, songId: string): void {
    const playlistSongs = this.getPlaylistSongs();
    const filtered = playlistSongs.filter(ps => !(ps.playlist_id === playlistId && ps.song_id === songId));
    this.setData('playlist_songs', filtered);
  }

  // Blocks
  getBlocks(): Block[] {
    return this.getData<Block>('blocks');
  }

  addBlock(block: Omit<Block, 'id' | 'created_at' | 'updated_at'>): Block {
    const blocks = this.getBlocks();
    const newBlock: Block = {
      ...block,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    blocks.push(newBlock);
    this.setData('blocks', blocks);
    return newBlock;
  }

  updateBlock(id: string, updates: Partial<Block>): Block | null {
    const blocks = this.getBlocks();
    const index = blocks.findIndex(b => b.id === id);
    if (index === -1) return null;
    
    blocks[index] = { ...blocks[index], ...updates, updated_at: new Date().toISOString() };
    this.setData('blocks', blocks);
    return blocks[index];
  }

  deleteBlock(id: string): boolean {
    const blocks = this.getBlocks();
    const filtered = blocks.filter(b => b.id !== id);
    if (filtered.length === blocks.length) return false;
    
    this.setData('blocks', filtered);
    return true;
  }

  getBlockWithSongs(blockId: string): { block: Block; songs: Song[] } | null {
    const blocks = this.getBlocks();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return null;

    const allSongs = this.getSongs();
    const songs = block.songs
      .sort((a, b) => a.position - b.position)
      .map(bs => allSongs.find(s => s.id === bs.song_id))
      .filter(Boolean) as Song[];

    return { block, songs };
  }

  // DJ Sets
  getSets(): DJSet[] {
    return this.getData<DJSet>('sets');
  }

  addSet(set: Omit<DJSet, 'id' | 'created_at' | 'updated_at'>): DJSet {
    const sets = this.getSets();
    const newSet: DJSet = {
      ...set,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    sets.push(newSet);
    this.setData('sets', sets);
    return newSet;
  }

  updateSet(id: string, updates: Partial<DJSet>): DJSet | null {
    const sets = this.getSets();
    const index = sets.findIndex(s => s.id === id);
    if (index === -1) return null;
    
    sets[index] = { ...sets[index], ...updates, updated_at: new Date().toISOString() };
    this.setData('sets', sets);
    return sets[index];
  }

  deleteSet(id: string): boolean {
    const sets = this.getSets();
    const filtered = sets.filter(s => s.id !== id);
    if (filtered.length === sets.length) return false;
    
    this.setData('sets', filtered);
    return true;
  }

  // Get transition suggestions for a song based on existing relationships
  getTransitionSuggestions(songId: string): Array<{ song: Song; notes?: string }> {
    const relationships = this.getSongRelationships()
      .filter(r => r.relationship_type === 'transition' && r.source_song_id === songId);
    const songs = this.getSongs();
    
    return relationships.map(rel => {
      const song = songs.find(s => s.id === rel.target_song_id);
      return song ? { song, notes: rel.notes } : null;
    }).filter(Boolean) as Array<{ song: Song; notes?: string }>;
  }

  // Utility methods
  searchSongs(query: string): Song[] {
    const songs = this.getSongs();
    const lowerQuery = query.toLowerCase();
    return songs.filter(song =>
      song.title.toLowerCase().includes(lowerQuery) ||
      song.artist.toLowerCase().includes(lowerQuery) ||
      song.genre?.toLowerCase().includes(lowerQuery) ||
      song.musical_key?.toLowerCase().includes(lowerQuery) ||
      song.album?.toLowerCase().includes(lowerQuery)
    );
  }

  getTagsForSong(songId: string): Tag[] {
    const songTags = this.getSongTags().filter(st => st.song_id === songId);
    const tags = this.getTags();
    return songTags.map(st => tags.find(t => t.id === st.tag_id)).filter(Boolean) as Tag[];
  }

  getSongsForTag(tagId: string): Song[] {
    const songTags = this.getSongTags().filter(st => st.tag_id === tagId);
    const songs = this.getSongs();
    return songTags.map(st => songs.find(s => s.id === st.song_id)).filter(Boolean) as Song[];
  }

  getRelatedSongs(songId: string): Array<{ song: Song; relationship: SongRelationship; direction: 'source' | 'target' }> {
    const relationships = this.getSongRelationships();
    const songs = this.getSongs();
    const related: Array<{ song: Song; relationship: SongRelationship; direction: 'source' | 'target' }> = [];

    relationships.forEach(rel => {
      if (rel.source_song_id === songId) {
        const targetSong = songs.find(s => s.id === rel.target_song_id);
        if (targetSong) {
          related.push({ song: targetSong, relationship: rel, direction: 'target' });
        }
      } else if (rel.target_song_id === songId) {
        const sourceSong = songs.find(s => s.id === rel.source_song_id);
        if (sourceSong) {
          related.push({ song: sourceSong, relationship: rel, direction: 'source' });
        }
      }
    });

    return related;
  }

  getPlaylistsForSong(songId: string): SongPlaylistMembership[] {
    const playlistSongs = this.getPlaylistSongs().filter(ps => ps.song_id === songId);
    const playlists = this.getPlaylists();
    return playlistSongs.map(ps => {
      const playlist = playlists.find(p => p.id === ps.playlist_id);
      return playlist ? { playlist, position: ps.position } : null;
    }).filter(Boolean) as SongPlaylistMembership[];
  }

  // Export/Import functionality for backup
  exportData(): string {
    const data = {
      songs: this.getSongs(),
      tags: this.getTags(),
      song_tags: this.getSongTags(),
      song_relationships: this.getSongRelationships(),
      playlists: this.getPlaylists(),
      playlist_songs: this.getPlaylistSongs(),
      blocks: this.getBlocks(),
      sets: this.getSets(),
      exported_at: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.songs) this.setData('songs', data.songs);
      if (data.tags) this.setData('tags', data.tags);
      if (data.song_tags) this.setData('song_tags', data.song_tags);
      if (data.song_relationships) this.setData('song_relationships', data.song_relationships);
      if (data.playlists) this.setData('playlists', data.playlists);
      if (data.playlist_songs) this.setData('playlist_songs', data.playlist_songs);
      if (data.blocks) this.setData('blocks', data.blocks);
      if (data.sets) this.setData('sets', data.sets);
      
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }
}

export const storage = new LocalStorage();