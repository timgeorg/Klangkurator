import { storage } from '@/lib/storage';
import { DataService } from './types';

export class LocalDataService implements DataService {
  getEnvironmentName(): string {
    return 'Local Desktop (PyWebView)';
  }

  async clearData(): Promise<void> {
    console.log('LocalDataService: Clear data called (no-op for local desktop)');
  }

  async initializeData(): Promise<void> {
    const existingSongs = await storage.getSongs();
    
    if (existingSongs.length > 0) {
      console.log('LocalDataService: Found existing library with', existingSongs.length, 'songs');
      return;
    }

    console.log('LocalDataService: No existing data, adding minimal sample...');
    const sample = {
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
    };
    await storage.addSong(sample);
    console.log('LocalDataService: Minimal initialization complete!');
  }
}