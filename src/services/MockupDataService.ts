import { storage } from '@/lib/storage';
import { DataService } from './types';

export class MockupDataService implements DataService {
  getEnvironmentName(): string {
    return 'Development (Mockup Data)';
  }

  clearData(): void {
    // Clear existing data for fresh start
    const songs = storage.getSongs();
    songs.forEach(song => storage.deleteSong(song.id));
    
    const tags = storage.getTags();
    tags.forEach(tag => storage.deleteTag(tag.id));
    
    // Clear relationships
    const relationships = storage.getSongRelationships();
    relationships.forEach(rel => storage.deleteSongRelationship(rel.id));
    
    // Clear playlists
    const playlists = storage.getPlaylists();
    playlists.forEach(playlist => storage.deletePlaylist(playlist.id));
  }

  initializeData(): void {
    console.log('MockupDataService: Checking existing data...');
    const existingSongs = storage.getSongs();
    
    if (existingSongs.length > 0) {
      console.log('MockupDataService: Data exists, performing idempotent upsert (no clearing).');
    }

    console.log('MockupDataService: Initializing comprehensive sample data...');

    // Comprehensive sample songs for development
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
        title: 'Titanium Future Rave Remix',
        artist: 'David Guetta & MORTEN',
        album: 'Future Rave',
        bpm: 130,
        musical_key: 'E♭ minor',
        genre: 'Future Rave',
        year: 2021,
        duration: 218,
        file_path: '/music/David Guetta MORTEN - Titanium Future Rave Remix.mp3',
        danceability: 5,
        energy: 5,
        social_acceptance: 4,
        drum_notes: 'Hard-hitting techno kicks, industrial groove',
        element_notes: 'Dark rave synths, reimagined vocals',
        mixing_notes: 'Underground energy meets mainstage power'
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
      },
      {
        title: 'Sandstorm',
        artist: 'Darude',
        bpm: 136,
        musical_key: 'E minor',
        genre: 'Trance',
        year: 1999,
        duration: 229,
        file_path: '/music/Darude - Sandstorm.mp3',
        danceability: 5,
        energy: 5,
        social_acceptance: 5,
        drum_notes: 'Driving trance kicks, relentless energy',
        element_notes: 'Iconic lead synth, hypnotic build',
        mixing_notes: 'Timeless classic, instant recognition'
      },
      {
        title: 'Around the World',
        artist: 'Daft Punk',
        album: 'Homework',
        bpm: 121,
        musical_key: 'D minor',
        genre: 'French House',
        year: 1997,
        duration: 429,
        file_path: '/music/Daft Punk - Around the World.mp3',
        danceability: 4,
        energy: 3,
        social_acceptance: 4,
        drum_notes: 'Minimal house groove, repetitive perfection',
        element_notes: 'Robotic vocals, funky bassline',
        mixing_notes: 'Hypnotic journey, perfect for long mixes'
      },
      {
        title: 'Kernkraft 400',
        artist: 'Zombie Nation',
        bpm: 142,
        musical_key: 'C minor',
        genre: 'Techno',
        year: 1999,
        duration: 211,
        file_path: '/music/Zombie Nation - Kernkraft 400.mp3',
        danceability: 5,
        energy: 5,
        social_acceptance: 4,
        drum_notes: 'Hard techno beats, driving force',
        element_notes: 'Aggressive synth lead, raw energy',
        mixing_notes: 'Peak-time weapon, guaranteed madness'
      },
      {
        title: 'Born Slippy (Nuxx)',
        artist: 'Underworld',
        album: 'Second Toughest in the Infants',
        bpm: 134,
        musical_key: 'A minor',
        genre: 'Progressive House',
        year: 1995,
        duration: 569,
        file_path: '/music/Underworld - Born Slippy.mp3',
        danceability: 4,
        energy: 4,
        social_acceptance: 3,
        drum_notes: 'Progressive builds, euphoric drops',
        element_notes: 'Emotional vocals, cinematic progression',
        mixing_notes: 'Epic journey track, film soundtrack legend'
      }
    ];

    console.log('MockupDataService: Upserting', sampleSongs.length, 'sample songs...');
    const addedSongs: { [key: string]: any } = {};

    const normalizeKey = (s: { title: string; artist: string }) => `${s.artist} - ${s.title}`.toLowerCase().trim();
    const existing = storage.getSongs();
    const existingMap = new Map(existing.map(s => [normalizeKey(s), s]));

    sampleSongs.forEach((songData) => {
      const key = normalizeKey(songData as any);
      const existingSong = existingMap.get(key);
      if (existingSong) {
        const updated = storage.updateSong(existingSong.id, { ...(songData as any) });
        addedSongs[(songData as any).title] = updated || existingSong;
        console.log('MockupDataService: Updated existing song:', (songData as any).title);
      } else {
        const created = storage.addSong(songData as any);
        addedSongs[(songData as any).title] = created;
        console.log('MockupDataService: Added new song:', (songData as any).title);
      }
    });

    // Create relationships between songs
    console.log('MockupDataService: Creating song relationships...');
    
    // Titanium Future Rave Remix is a remix of Titanium
    if (addedSongs['Titanium'] && addedSongs['Titanium Future Rave Remix']) {
      const sourceId = addedSongs['Titanium Future Rave Remix'].id;
      const targetId = addedSongs['Titanium'].id;
      const rels = storage.getSongRelationships();
      const existsRel = rels.some(r => r.source_song_id === sourceId && r.target_song_id === targetId && r.relationship_type === 'remix');
      
      if (!existsRel) {
        const relationship = storage.addSongRelationship({
          source_song_id: sourceId,
          target_song_id: targetId,
          relationship_type: 'remix',
          notes: 'Future Rave reimagining with darker, harder techno elements'
        });
        console.log('MockupDataService: Created remix relationship:', {
          relationship,
          remixId: sourceId,
          remixTitle: addedSongs['Titanium Future Rave Remix'].title,
          originalId: targetId,
          originalTitle: addedSongs['Titanium'].title
        });
      } else {
        console.log('MockupDataService: Remix relationship already exists');
      }
      
      // Verify stored relationships
      const allRelationships = storage.getSongRelationships();
      console.log('MockupDataService: Total relationships in storage after upsert:', allRelationships.length);
      console.log('MockupDataService: All relationships:', allRelationships);
    } else {
      console.log('MockupDataService: Could not create relationship - songs not found:', {
        titanium: addedSongs['Titanium']?.title,
        remix: addedSongs['Titanium Future Rave Remix']?.title
      });
    }

    // Add comprehensive sample tags
    const sampleTags = [
      { name: 'Peak Time', color: '#ef4444' },
      { name: 'Warm Up', color: '#f97316' },
      { name: 'Vocal', color: '#8b5cf6' },
      { name: 'Instrumental', color: '#06b6d4' },
      { name: 'Festival', color: '#eab308' },
      { name: 'Underground', color: '#64748b' },
      { name: 'Classic', color: '#10b981' },
      { name: 'Commercial', color: '#f59e0b' },
      { name: 'Hard Style', color: '#dc2626' },
      { name: 'Chill', color: '#14b8a6' }
    ];

    console.log('MockupDataService: Upserting sample tags...');
    const existingTags = storage.getTags();
    const tagMap = new Map(existingTags.map(t => [t.name.toLowerCase().trim(), t]));

    sampleTags.forEach((tagData) => {
      const key = tagData.name.toLowerCase().trim();
      const existing = tagMap.get(key);
      if (existing) {
        storage.updateTag(existing.id, { color: tagData.color });
        console.log('MockupDataService: Updated tag:', existing.name);
      } else {
        const tag = storage.addTag(tagData);
        console.log('MockupDataService: Added tag:', tag.name);
      }
    });

    console.log('MockupDataService: Sample data initialization complete!');
  }
}