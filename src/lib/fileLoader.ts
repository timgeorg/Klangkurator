import { storage, Song } from './storage';

export interface FileMetadata {
  name: string;
  path: string;
  size: number;
  lastModified: number;
  type: string;
}

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: number;
  duration?: number; // in seconds
  bitrate?: number;
  sampleRate?: number;
}

// File extensions supported by the DJ database
export const SUPPORTED_AUDIO_EXTENSIONS = [
  '.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma'
];

export class FileLoader {
  // In a pywebview environment, this would use the Python backend
  // For now, we'll simulate file loading with HTML5 File API
  
  static async loadAudioFiles(): Promise<FileMetadata[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = SUPPORTED_AUDIO_EXTENSIONS.join(',');
      
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        const metadata: FileMetadata[] = files.map(file => ({
          name: file.name,
          path: file.name, // In pywebview, this would be the full path
          size: file.size,
          lastModified: file.lastModified,
          type: file.type
        }));
        resolve(metadata);
      };
      
      input.click();
    });
  }

  static async loadDirectory(): Promise<FileMetadata[]> {
    // In pywebview, this would scan a directory recursively for audio files
    // For web demo, we'll use the directory picker API if available
    if ('showDirectoryPicker' in window) {
      try {
        // @ts-ignore - Directory picker is experimental
        const dirHandle = await window.showDirectoryPicker();
        const files: FileMetadata[] = [];
        
        // @ts-ignore
        for await (const entry of dirHandle.values()) {
          if (entry.kind === 'file') {
            const file = await entry.getFile();
            const ext = '.' + file.name.split('.').pop()?.toLowerCase();
            if (SUPPORTED_AUDIO_EXTENSIONS.includes(ext)) {
              files.push({
                name: file.name,
                path: file.name,
                size: file.size,
                lastModified: file.lastModified,
                type: file.type
              });
            }
          }
        }
        
        return files;
      } catch (error) {
        console.log('Directory picker cancelled or not supported');
        return this.loadAudioFiles();
      }
    } else {
      return this.loadAudioFiles();
    }
  }

  // Extract metadata from audio file
  static async extractAudioMetadata(file: File): Promise<AudioMetadata> {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        const metadata: AudioMetadata = {
          duration: audio.duration,
          // Basic metadata extraction
          // In pywebview, we'd use a proper audio metadata library
        };
        
        URL.revokeObjectURL(url);
        resolve(metadata);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve({});
      });
      
      audio.src = url;
    });
  }

  // Parse filename for metadata hints
  static parseFilename(filename: string): Partial<AudioMetadata> {
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // Common patterns: "Artist - Title", "Artist - Album - Title", "Title - Artist"
    const patterns = [
      /^(.+?)\s*-\s*(.+?)\s*-\s*(.+)$/, // Artist - Album - Title
      /^(.+?)\s*-\s*(.+)$/, // Artist - Title or Title - Artist
    ];
    
    for (const pattern of patterns) {
      const match = nameWithoutExt.match(pattern);
      if (match) {
        if (match.length === 4) {
          return {
            artist: match[1].trim(),
            album: match[2].trim(),
            title: match[3].trim()
          };
        } else if (match.length === 3) {
          // Try to determine if it's Artist - Title or Title - Artist
          // Usually artist names are shorter and more likely to be at the beginning
          return {
            artist: match[1].trim(),
            title: match[2].trim()
          };
        }
      }
    }
    
    // If no pattern matches, use the filename as title
    return {
      title: nameWithoutExt
    };
  }

  // Auto-detect BPM (simplified version)
  static estimateBPM(filename: string): number | undefined {
    const bpmMatch = filename.match(/(\d{2,3})\s*bpm/i);
    if (bpmMatch) {
      const bpm = parseInt(bpmMatch[1]);
      return bpm >= 60 && bpm <= 200 ? bpm : undefined;
    }
    
    // Common BPM ranges by genre (rough estimates)
    const genreHints = [
      { pattern: /house/i, bpm: 128 },
      { pattern: /techno/i, bpm: 132 },
      { pattern: /trance/i, bpm: 138 },
      { pattern: /drum.*bass|dnb/i, bpm: 174 },
      { pattern: /dubstep/i, bpm: 140 },
      { pattern: /trap/i, bpm: 150 },
    ];
    
    for (const hint of genreHints) {
      if (hint.pattern.test(filename)) {
        return hint.bpm;
      }
    }
    
    return undefined;
  }

  // Auto-detect musical key
  static detectKey(filename: string): string | undefined {
    const keyPattern = /\b([A-G]#?)\s*(maj|major|min|minor|m)?\b/i;
    const match = filename.match(keyPattern);
    
    if (match) {
      const note = match[1].toUpperCase();
      const type = match[2]?.toLowerCase();
      
      if (type === 'min' || type === 'minor' || type === 'm') {
        return `${note} minor`;
      } else {
        return `${note} major`;
      }
    }
    
    return undefined;
  }

  // Create song entries from loaded files
  static async createSongsFromFiles(files: File[]): Promise<Song[]> {
    const songs: Song[] = [];
    
    for (const file of files) {
      const filenameMetadata = this.parseFilename(file.name);
      const audioMetadata = await this.extractAudioMetadata(file);
      const estimatedBPM = this.estimateBPM(file.name);
      const detectedKey = this.detectKey(file.name);
      
      const song = storage.addSong({
        title: filenameMetadata.title || file.name,
        artist: filenameMetadata.artist || 'Unknown Artist',
        album: filenameMetadata.album,
        genre: filenameMetadata.genre,
        year: filenameMetadata.year,
        bpm: estimatedBPM,
        musical_key: detectedKey,
        duration: audioMetadata.duration ? Math.round(audioMetadata.duration) : undefined,
        file_path: file.name, // In pywebview, this would be the full file path
        danceability: 0,
        energy: 0,
        social_acceptance: 0,
      });
      
      songs.push(song);
    }
    
    return songs;
  }

  // Initialize with sample data for demo purposes
  static initializeSampleData() {
    const songs = storage.getSongs();
    if (songs.length === 0) {
      // Add some sample songs to demonstrate the interface
      const sampleSongs = [
        {
          title: 'Satisfaction',
          artist: 'Benny Benassi',
          album: 'Hypnotica',
          bpm: 132,
          musical_key: 'F# minor',
          genre: 'Electro House',
          year: 2002,
          duration: 274,
          file_path: '/music/Benny Benassi - Satisfaction.mp3',
          danceability: 5,
          energy: 5,
          social_acceptance: 4,
          drum_notes: 'Punchy 4/4 kick, tight snare on 2&4',
          element_notes: 'Distorted synth lead, robotic vocals',
          mixing_notes: 'High energy opener, great for peak time'
        },
        {
          title: 'One More Time',
          artist: 'Daft Punk',
          album: 'Discovery',
          bpm: 123,
          musical_key: 'F minor',
          genre: 'French House',
          year: 2000,
          duration: 320,
          file_path: '/music/Daft Punk - One More Time.mp3',
          danceability: 4,
          energy: 4,
          social_acceptance: 5,
          drum_notes: 'Classic four-on-floor, filtered drums',
          element_notes: 'Auto-tuned vocals, funky bassline',
          mixing_notes: 'Crowd favorite, works in any set'
        },
        {
          title: 'Levels',
          artist: 'Avicii',
          bpm: 126,
          musical_key: 'C# minor',
          genre: 'Progressive House',
          year: 2011,
          duration: 199,
          file_path: '/music/Avicii - Levels.mp3',
          danceability: 5,
          energy: 4,
          social_acceptance: 5,
          drum_notes: 'Big room kick, explosive drops',
          element_notes: 'Euphoric lead synth, vocal chops',
          mixing_notes: 'Festival anthem, guaranteed sing-along'
        },
        {
          title: 'Strobe',
          artist: 'Deadmau5',
          album: '4x4=12',
          bpm: 128,
          musical_key: 'C# minor',
          genre: 'Progressive House',
          year: 2009,
          duration: 636,
          file_path: '/music/Deadmau5 - Strobe.mp3',
          danceability: 3,
          energy: 3,
          social_acceptance: 4,
          drum_notes: 'Subtle groove builds slowly',
          element_notes: 'Emotional progression, ambient pads',
          mixing_notes: 'Long journey track, perfect for storytelling'
        },
        {
          title: 'Titanium',
          artist: 'David Guetta ft. Sia',
          album: 'Nothing But the Beat',
          bpm: 126,
          musical_key: 'E♭ minor',
          genre: 'Pop House',
          year: 2011,
          duration: 245,
          file_path: '/music/David Guetta - Titanium.mp3',
          danceability: 4,
          energy: 4,
          social_acceptance: 5,
          drum_notes: 'Commercial four-on-floor, big drops',
          element_notes: 'Powerful vocals, uplifting synths',
          mixing_notes: 'Radio-friendly anthem, wide appeal'
        },
        {
          title: 'Animals',
          artist: 'Martin Garrix',
          bpm: 128,
          musical_key: 'G minor',
          genre: 'Big Room House',
          year: 2013,
          duration: 305,
          file_path: '/music/Martin Garrix - Animals.mp3',
          danceability: 5,
          energy: 5,
          social_acceptance: 4,
          drum_notes: 'Massive kick, explosive drops',
          element_notes: 'Tribal lead synth, minimal vocals',
          mixing_notes: 'Main stage banger, festival favorite'
        },
        {
          title: 'Clarity',
          artist: 'Zedd ft. Foxes',
          album: 'Clarity',
          bpm: 128,
          musical_key: 'G major',
          genre: 'Electro Pop',
          year: 2012,
          duration: 271,
          file_path: '/music/Zedd - Clarity.mp3',
          danceability: 4,
          energy: 3,
          social_acceptance: 5,
          drum_notes: 'Clean electro drums, subtle groove',
          element_notes: 'Emotional vocals, melodic drops',
          mixing_notes: 'Crossover hit, works in multiple contexts'
        },
        {
          title: 'Bangarang',
          artist: 'Skrillex',
          album: 'Bangarang EP',
          bpm: 110,
          musical_key: 'E minor',
          genre: 'Dubstep',
          year: 2011,
          duration: 215,
          file_path: '/music/Skrillex - Bangarang.mp3',
          danceability: 4,
          energy: 5,
          social_acceptance: 3,
          drum_notes: 'Syncopated rhythm, heavy bass drops',
          element_notes: 'Vocal chops, aggressive wobbles',
          mixing_notes: 'High-energy moment, polarizing but effective'
        },
        {
          title: 'Adagio for Strings',
          artist: 'Tiësto',
          bpm: 136,
          musical_key: 'B♭ minor',
          genre: 'Uplifting Trance',
          year: 2005,
          duration: 428,
          file_path: '/music/Tiesto - Adagio for Strings.mp3',
          danceability: 3,
          energy: 4,
          social_acceptance: 4,
          drum_notes: 'Driving trance rhythm, emotional builds',
          element_notes: 'Classical melody, epic orchestration',
          mixing_notes: 'Peak-time emotional moment, goosebumps guaranteed'
        },
        {
          title: 'Gecko (Overdrive)',
          artist: 'Oliver Heldens',
          bpm: 124,
          musical_key: 'A minor',
          genre: 'Future House',
          year: 2014,
          duration: 195,
          file_path: '/music/Oliver Heldens - Gecko.mp3',
          danceability: 5,
          energy: 4,
          social_acceptance: 4,
          drum_notes: 'Groovy future house beats, punchy kick',
          element_notes: 'Funky bass, garage-influenced',
          mixing_notes: 'Dancefloor filler, perfect groove'
        },
        {
          title: 'Language',
          artist: 'Porter Robinson',
          album: 'Worlds',
          bpm: 174,
          musical_key: 'C major',
          genre: 'Melodic Dubstep',
          year: 2012,
          duration: 386,
          file_path: '/music/Porter Robinson - Language.mp3',
          danceability: 3,
          energy: 4,
          social_acceptance: 4,
          drum_notes: 'Complex drum patterns, emotional builds',
          element_notes: 'Cinematic pads, euphoric lead',
          mixing_notes: 'Journey track, builds atmosphere beautifully'
        },
        {
          title: 'Ghosts \'n\' Stuff',
          artist: 'Deadmau5',
          album: 'For Lack of a Better Name',
          bpm: 128,
          musical_key: 'F# minor',
          genre: 'Electro House',
          year: 2008,
          duration: 305,
          file_path: '/music/Deadmau5 - Ghosts n Stuff.mp3',
          danceability: 4,
          energy: 4,
          social_acceptance: 4,
          drum_notes: 'Solid four-on-floor, driving rhythm',
          element_notes: 'Dark synth stabs, spooky atmosphere',
          mixing_notes: 'Classic club track, timeless appeal'
        },
        {
          title: 'Scary Monsters and Nice Sprites',
          artist: 'Skrillex',
          album: 'Scary Monsters and Nice Sprites EP',
          bpm: 140,
          musical_key: 'G# minor',
          genre: 'Dubstep',
          year: 2010,
          duration: 207,
          file_path: '/music/Skrillex - Scary Monsters.mp3',
          danceability: 4,
          energy: 5,
          social_acceptance: 3,
          drum_notes: 'Dubstep rhythm, massive drops',
          element_notes: 'Vocal manipulation, signature wobbles',
          mixing_notes: 'Genre-defining track, use sparingly'
        },
        {
          title: 'Turbulence',
          artist: 'Laidback Luke & Steve Aoki',
          bpm: 128,
          musical_key: 'A minor',
          genre: 'Electro House',
          year: 2011,
          duration: 334,
          file_path: '/music/Laidback Luke - Turbulence.mp3',
          danceability: 5,
          energy: 5,
          social_acceptance: 4,
          drum_notes: 'Driving house rhythm, explosive energy',
          element_notes: 'Aggressive synths, party vocals',
          mixing_notes: 'Peak-time destroyer, guaranteed hands up'
        }
      ];
      
      sampleSongs.forEach(songData => storage.addSong(songData));
      
      // Add some sample tags
      const sampleTags = [
        { name: 'Peak Time', color: '#ef4444' },
        { name: 'Warm Up', color: '#f97316' },
        { name: 'Vocal', color: '#8b5cf6' },
        { name: 'Instrumental', color: '#06b6d4' },
        { name: 'Festival', color: '#eab308' },
        { name: 'Underground', color: '#64748b' }
      ];
      
      sampleTags.forEach(tagData => storage.addTag(tagData));
    }
  }
}