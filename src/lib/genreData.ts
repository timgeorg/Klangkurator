// Main genres with their subgenres and colors

export interface GenreConfig {
  name: string;
  color: string;
  subgenres: string[];
}

// Default genre configuration
export const DEFAULT_GENRES: GenreConfig[] = [
  {
    name: 'House',
    color: '#22c55e',
    subgenres: ['Deep House', 'Tech House', 'Progressive House', 'Afro House', 'Melodic House', 'Minimal House', 'Organic House', 'Funky House', 'Soulful House', 'Jackin House', 'Bass House', 'Electro House', 'Future House', 'Groove']
  },
  {
    name: 'Techno',
    color: '#8b5cf6',
    subgenres: ['Melodic Techno', 'Hard Techno', 'Industrial Techno', 'Minimal Techno', 'Acid Techno', 'Peak Time Techno', 'Hypnotic Techno', 'Bouncy', 'Schranz', 'Driving Techno', 'Atmospheric Techno', 'Raw Techno']
  },
  {
    name: 'Trance',
    color: '#3b82f6',
    subgenres: ['Progressive Trance', 'Uplifting Trance', 'Psytrance', 'Tech Trance', 'Vocal Trance', 'Hard Trance', 'Goa Trance', 'Balearic Trance']
  },
  {
    name: 'Drum & Bass',
    color: '#d946ef',
    subgenres: ['Liquid DnB', 'Neurofunk', 'Jump Up', 'Jungle', 'Rollers', 'Dancefloor DnB', 'Minimal DnB', 'Half Time']
  },
  {
    name: 'EDM',
    color: '#f97316',
    subgenres: ['Big Room', 'Future Bass', 'Trap', 'Dubstep', 'Riddim', 'Hardstyle', 'Future Rave', 'Slap House', 'Brazilian Bass']
  },
  {
    name: 'Disco',
    color: '#eab308',
    subgenres: ['Nu-Disco', 'Italo Disco', 'Cosmic Disco', 'Space Disco', 'French Touch', 'Boogie', 'Indie Dance']
  },
  {
    name: 'Breaks',
    color: '#84cc16',
    subgenres: ['Breakbeat', 'UK Breaks', 'Progressive Breaks', 'Nu Skool Breaks', 'Big Beat', 'Electro Breaks']
  },
  {
    name: 'Electro',
    color: '#a855f7',
    subgenres: ['Electro House', 'Electro Clash', 'Miami Bass', 'Ghetto Tech', 'Electro Funk']
  },
  {
    name: 'Ambient',
    color: '#06b6d4',
    subgenres: ['Dark Ambient', 'Drone', 'Space Ambient', 'Downtempo', 'Chillout', 'Organic Ambient']
  },
  {
    name: 'Hip Hop',
    color: '#ef4444',
    subgenres: ['Trap', 'Boom Bap', 'Lo-Fi Hip Hop', 'UK Hip Hop', 'Phonk', 'Cloud Rap']
  },
  {
    name: 'R&B',
    color: '#f43f5e',
    subgenres: ['Contemporary R&B', 'Neo Soul', 'Alternative R&B', 'UK R&B']
  },
  {
    name: 'Pop',
    color: '#f472b6',
    subgenres: ['Dance Pop', 'Synth Pop', 'Electro Pop', 'Indie Pop', 'K-Pop', 'Future Pop']
  },
  {
    name: 'Other',
    color: '#6b7280',
    subgenres: ['Experimental', 'World Music', 'Latin', 'Afrobeats', 'Reggaeton', 'Moombahton']
  }
];

const STORAGE_KEY = 'dj_database_genre_config';

// Get genre configuration from localStorage or use defaults
export function getGenreConfig(): GenreConfig[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return DEFAULT_GENRES;
    }
  }
  return DEFAULT_GENRES;
}

// Save genre configuration to localStorage
export function saveGenreConfig(config: GenreConfig[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

// Get all main genre names
export function getMainGenres(): string[] {
  return getGenreConfig().map(g => g.name);
}

// Get subgenres for a specific main genre
export function getSubgenresForMainGenre(mainGenre: string): string[] {
  const config = getGenreConfig();
  const genre = config.find(g => g.name === mainGenre);
  return genre?.subgenres || [];
}

// Get color for a main genre
export function getMainGenreColor(mainGenre: string): string {
  const config = getGenreConfig();
  const genre = config.find(g => g.name === mainGenre);
  return genre?.color || '#6366f1';
}

// Get all subgenres across all main genres
export function getAllSubgenres(): { subgenre: string; mainGenre: string; color: string }[] {
  const config = getGenreConfig();
  const result: { subgenre: string; mainGenre: string; color: string }[] = [];
  
  config.forEach(genre => {
    genre.subgenres.forEach(sub => {
      result.push({
        subgenre: sub,
        mainGenre: genre.name,
        color: genre.color
      });
    });
  });
  
  return result;
}

// Add a new main genre
export function addMainGenre(name: string, color: string): void {
  const config = getGenreConfig();
  if (!config.find(g => g.name.toLowerCase() === name.toLowerCase())) {
    config.push({ name, color, subgenres: [] });
    saveGenreConfig(config);
  }
}

// Update a main genre
export function updateMainGenre(oldName: string, newName: string, newColor: string): void {
  const config = getGenreConfig();
  const index = config.findIndex(g => g.name === oldName);
  if (index !== -1) {
    config[index].name = newName;
    config[index].color = newColor;
    saveGenreConfig(config);
  }
}

// Delete a main genre
export function deleteMainGenre(name: string): void {
  const config = getGenreConfig();
  const filtered = config.filter(g => g.name !== name);
  saveGenreConfig(filtered);
}

// Add a subgenre to a main genre
export function addSubgenre(mainGenre: string, subgenre: string): void {
  const config = getGenreConfig();
  const genre = config.find(g => g.name === mainGenre);
  if (genre && !genre.subgenres.includes(subgenre)) {
    genre.subgenres.push(subgenre);
    saveGenreConfig(config);
  }
}

// Remove a subgenre from a main genre
export function removeSubgenre(mainGenre: string, subgenre: string): void {
  const config = getGenreConfig();
  const genre = config.find(g => g.name === mainGenre);
  if (genre) {
    genre.subgenres = genre.subgenres.filter(s => s !== subgenre);
    saveGenreConfig(config);
  }
}

// Update a subgenre within a main genre
export function updateSubgenre(mainGenre: string, oldSubgenre: string, newSubgenre: string): void {
  const config = getGenreConfig();
  const genre = config.find(g => g.name === mainGenre);
  if (genre) {
    const index = genre.subgenres.indexOf(oldSubgenre);
    if (index !== -1) {
      genre.subgenres[index] = newSubgenre;
      saveGenreConfig(config);
    }
  }
}
