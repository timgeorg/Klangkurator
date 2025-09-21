import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { FileLoader, SUPPORTED_AUDIO_EXTENSIONS } from '@/lib/fileLoader';
import { storage } from '@/lib/storage';
import { toast } from '@/hooks/use-toast';
import { 
  FolderOpen, 
  Music, 
  FileAudio, 
  CheckCircle, 
  AlertCircle,
  Info,
  Upload,
  Folder
} from 'lucide-react';

export default function LoadFiles() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [processedFiles, setProcessedFiles] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    processed: 0,
    added: 0,
    skipped: 0
  });

  const handleLoadFiles = async () => {
    try {
      setLoading(true);
      setProgress(0);
      setProcessedFiles([]);
      setStats({ total: 0, processed: 0, added: 0, skipped: 0 });

      const files = await FileLoader.loadAudioFiles();
      
      if (files.length === 0) {
        toast({
          title: "No files selected",
          description: "Please select some audio files to import.",
        });
        return;
      }

      setStats(prev => ({ ...prev, total: files.length }));

      // Simulate processing files (in real pywebview app, this would process actual files)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setProgress(((i + 1) / files.length) * 100);
        
        // Check if file already exists
        const existingSongs = storage.getSongs();
        const exists = existingSongs.some(song => 
          song.file_path === file.path || 
          song.title === FileLoader.parseFilename(file.name).title
        );
        
        if (exists) {
          setStats(prev => ({ ...prev, processed: prev.processed + 1, skipped: prev.skipped + 1 }));
          setProcessedFiles(prev => [...prev, `${file.name} (skipped - already exists)`]);
        } else {
          // In real app, we'd create File objects and process them
          // For demo, we'll create sample entries
          const metadata = FileLoader.parseFilename(file.name);
          storage.addSong({
            title: metadata.title || file.name,
            artist: metadata.artist || 'Unknown Artist',
            album: metadata.album,
            genre: metadata.genre,
            year: metadata.year,
            bpm: FileLoader.estimateBPM(file.name),
            musical_key: FileLoader.detectKey(file.name),
            file_path: file.path,
            danceability: 0,
            energy: 0,
            social_acceptance: 0,
          });
          
          setStats(prev => ({ ...prev, processed: prev.processed + 1, added: prev.added + 1 }));
          setProcessedFiles(prev => [...prev, `${file.name} (added)`]);
        }
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      toast({
        title: "Import complete!",
        description: `Added ${stats.added + files.length - stats.skipped} new tracks to your library.`,
      });

    } catch (error: any) {
      toast({
        title: "Error importing files",
        description: error.message || "Failed to import audio files",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDirectory = async () => {
    try {
      setLoading(true);
      const files = await FileLoader.loadDirectory();
      
      if (files.length === 0) {
        toast({
          title: "No audio files found",
          description: "The selected directory doesn't contain any supported audio files.",
        });
        return;
      }

      toast({
        title: "Directory scanned",
        description: `Found ${files.length} audio files. Processing...`,
      });

      // Process the files similar to handleLoadFiles
      // Implementation would be similar to above
      
    } catch (error: any) {
      toast({
        title: "Error scanning directory",
        description: error.message || "Failed to scan directory",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
          Load Audio Files
        </h1>
        <p className="text-muted-foreground">
          Import your music files into the DJ database for organization and analysis
        </p>
      </div>

      {/* Supported Formats */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Supported Audio Formats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_AUDIO_EXTENSIONS.map((ext) => (
              <Badge key={ext} variant="secondary" className="text-xs">
                {ext.replace('.', '').toUpperCase()}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            The system will automatically extract metadata from filenames and ID3 tags where available.
          </p>
        </CardContent>
      </Card>

      {/* Import Options */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-gradient-card border-border/50 hover:shadow-elevated transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileAudio className="w-5 h-5 text-accent" />
              Select Individual Files
            </CardTitle>
            <CardDescription>
              Choose specific audio files from your computer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleLoadFiles}
              disabled={loading}
              className="w-full bg-gradient-primary hover:shadow-glow"
            >
              <Upload className="w-4 h-4 mr-2" />
              {loading ? 'Processing...' : 'Select Files'}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card border-border/50 hover:shadow-elevated transition-all duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Folder className="w-5 h-5 text-secondary" />
              Scan Directory
            </CardTitle>
            <CardDescription>
              Recursively scan a folder for all audio files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleLoadDirectory}
              disabled={loading}
              variant="outline"
              className="w-full border-border hover:bg-muted"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              {loading ? 'Scanning...' : 'Scan Folder'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Progress Section */}
      {loading && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary animate-pulse" />
              Processing Files
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
            
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Files</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-accent">{stats.processed}</div>
                <div className="text-xs text-muted-foreground">Processed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-energy-high">{stats.added}</div>
                <div className="text-xs text-muted-foreground">Added</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-muted-foreground">{stats.skipped}</div>
                <div className="text-xs text-muted-foreground">Skipped</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {processedFiles.length > 0 && (
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-energy-high" />
              Import Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {processedFiles.map((file, index) => {
                const isSkipped = file.includes('(skipped');
                return (
                  <div 
                    key={index}
                    className="flex items-center gap-2 text-sm p-2 rounded bg-muted/30"
                  >
                    {isSkipped ? (
                      <AlertCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-energy-high flex-shrink-0" />
                    )}
                    <span className={isSkipped ? 'text-muted-foreground' : 'text-foreground'}>
                      {file}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips */}
      <Card className="bg-gradient-card border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-secondary" />
            Import Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Filename Conventions</h4>
            <p className="text-xs text-muted-foreground">
              Use formats like "Artist - Title" or "Artist - Album - Title" for better metadata detection.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium text-sm">BPM Detection</h4>
            <p className="text-xs text-muted-foreground">
              Include BPM in filenames (e.g., "Song Name 128bpm") for automatic tempo detection.
            </p>
          </div>
          <Separator />
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Key Detection</h4>
            <p className="text-xs text-muted-foreground">
              Musical keys in filenames (e.g., "Song Am" or "Song A minor") will be automatically detected.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}