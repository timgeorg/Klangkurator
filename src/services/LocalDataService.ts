import { storage } from '@/lib/storage';
import { DataService } from './types';

export class LocalDataService implements DataService {
  getEnvironmentName(): string {
    return 'Local Desktop (PyWebView)';
  }

  clearData(): void {
    // For local desktop, we don't automatically clear data
    // Users manage their own library
    console.log('LocalDataService: Clear data called (no-op for local desktop)');
  }

  initializeData(): void {
    console.log('LocalDataService: Checking for existing data...');
    const existingSongs = storage.getSongs();
    
    if (existingSongs.length > 0) {
      console.log('LocalDataService: Found existing library with', existingSongs.length, 'songs');
      return;
    }

    console.log('LocalDataService: No existing data, adding minimal sample for first run...');

    // Minimal sample data for first-time desktop users
    const minimalSampleSongs = [
      {
        title: 'Welcome to Your DJ Library',
        artist: 'Sample Artist',
        album: 'Getting Started',
        bpm: 128,
        musical_key: 'C major',
        genre: 'House',
        year: 2024,
        duration: 180,
        file_path: '/sample/welcome.mp3',
        danceability: 3,
        energy: 3,
        social_acceptance: 3,
        drum_notes: 'This is a sample track to get you started',
        element_notes: 'Use the Load Files button to import your music',
        mixing_notes: 'Delete this sample once you have your own tracks'
      }
    ];

    console.log('LocalDataService: Adding minimal sample data...');
    minimalSampleSongs.forEach((songData, index) => {
      const song = storage.addSong(songData);
      console.log(`LocalDataService: Added sample song ${index + 1}:`, song.title);
    });

    // Add DJ-focused mixing element tags for local users
    const basicTags = [
      { name: 'Piano', color: '#8b5cf6' },
      { name: 'Sing-Along', color: '#f97316' },
      { name: 'Minimal Drop', color: '#ef4444' },
      { name: 'Peak Time', color: '#dc2626' },
      { name: 'Warm Up', color: '#fbbf24' },
      { name: 'Vocal Chops', color: '#fb923c' },
      { name: 'Long Intro', color: '#0891b2' },
      { name: 'Crowd Pleaser', color: '#fb7185' }
    ];

    console.log('LocalDataService: Adding basic tags...');
    basicTags.forEach((tagData, index) => {
      const tag = storage.addTag(tagData);
      console.log(`LocalDataService: Added tag ${index + 1}:`, tag.name);
    });

    console.log('LocalDataService: Minimal initialization complete!');
  }
}