import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { FolderOpen, Music, FileAudio, CheckCircle, AlertCircle, Info, Folder, ScanLine, XCircle } from "lucide-react";

interface ScanResult {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}

interface Crate {
  name: string;
  track_count: number;
}

export default function LoadFiles() {
  const [rootPath, setRootPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [currentRoot, setCurrentRoot] = useState<string | null>(null);

  // Load current root folder and crates on mount
  useEffect(() => {
    loadCurrentState();
  }, []);

  const loadCurrentState = async () => {
    try {
      const [rootRes, cratesRes] = await Promise.all([
        api.get<{ root_path: string | null }>("/library/root"),
        api.get<Crate[]>("/library/crates"),
      ]);
      setCurrentRoot(rootRes.root_path);
      if (rootRes.root_path) setRootPath(rootRes.root_path);
      setCrates(cratesRes);
    } catch {
      // Backend not reachable — show as is
    }
  };

  const handlePickFolder = async () => {
    try {
      const result = await api.post<{ path: string | null }>("/library/pick-folder");
      if (result.path) {
        setRootPath(result.path);
        handleSaveRoot(result.path);
      }
    } catch {
      // Not in desktop mode — user types path manually
      toast({
        title: "Manual mode",
        description: "Enter the folder path manually below.",
      });
    }
  };

  const handleSaveRoot = async (path?: string) => {
    const toSave = path || rootPath;
    if (!toSave) return;
    try {
      await api.put("/library/root", { root_path: toSave });
      setCurrentRoot(toSave);
      toast({ title: "Root folder saved" });
    } catch (e: any) {
      toast({
        title: "Invalid path",
        description: e.message || "Could not save root folder.",
        variant: "destructive",
      });
    }
  };

  const handleScan = async () => {
    if (!rootPath) {
      toast({ title: "No folder selected", description: "Pick or enter a folder path first." });
      return;
    }
    try {
      setLoading(true);
      setScanResult(null);
      const result = await api.post<ScanResult>("/library/scan", { root_path: rootPath });
      setScanResult(result);
      loadCurrentState();
      toast({
        title: "Scan complete",
        description: `Found ${result.total} files, added ${result.added} tracks.`,
      });
    } catch (e: any) {
      toast({
        title: "Scan failed",
        description: e.message || "Failed to scan folder.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyzeAll = async () => {
    try {
      setLoading(true);
      const result = await api.post<{ analyzed: number; updated: number; skipped: number; errors: string[] }>("/library/analyze-all");
      toast({
        title: "Analysis complete",
        description: `Analyzed ${result.analyzed} tracks, updated ${result.updated} with BPM/key.`,
      });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-orange-500 mb-1">Load Files</h2>
        <p className="text-sm text-muted-foreground">
          Select your music root folder and scan it to import tracks with real metadata.
        </p>
      </div>

      {/* Root folder section */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Root Folder
          </CardTitle>
          <CardDescription>
            The top-level folder containing all your music crates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="/home/tim/Music"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handlePickFolder}>
              <FolderOpen className="h-4 w-4 mr-2" />
              Browse
            </Button>
            <Button onClick={() => handleSaveRoot()} variant="secondary">
              Save
            </Button>
          </div>
          {currentRoot && (
            <p className="text-xs text-muted-foreground">
              Current: <code className="bg-muted px-1 rounded">{currentRoot}</code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Scan section */}
      <Card className="bg-card/50 border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ScanLine className="h-4 w-4" />
            Scan Library
          </CardTitle>
          <CardDescription>
            Scans the root folder recursively for audio files and imports them with metadata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={handleScan} disabled={loading || !rootPath} className="w-full bg-orange-600 hover:bg-orange-700">
            {loading ? "Scanning..." : "Scan Library"}
          </Button>

          {scanResult && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-3 bg-muted/30 rounded">
                  <div className="text-2xl font-bold text-orange-500">{scanResult.total}</div>
                  <div className="text-xs text-muted-foreground">Found</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded">
                  <div className="text-2xl font-bold text-green-500">{scanResult.added}</div>
                  <div className="text-xs text-muted-foreground">Added</div>
                </div>
                <div className="text-center p-3 bg-muted/30 rounded">
                  <div className="text-2xl font-bold text-muted-foreground">{scanResult.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
              </div>

              {scanResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-red-400 font-medium">Errors:</p>
                  {scanResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-400/80 flex items-start gap-1">
                      <XCircle className="h-3 w-3 mt-0.5 shrink-0" /> {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          <Separator />

          <div className="flex gap-2">
            <Button onClick={handleAnalyzeAll} disabled={loading} variant="outline" className="flex-1">
              {loading ? "Analyzing..." : "Analyze BPM/Key"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs librosa audio analysis to detect BPM and key for tracks missing them (~3-5s per track).
          </p>
        </CardContent>
      </Card>

      {/* Crates section */}
      {crates.length > 0 && (
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Crates</CardTitle>
            <CardDescription>Your music folders detected in the library.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {crates.map((c) => (
                <Badge key={c.name} variant="secondary" className="bg-orange-900/30 text-orange-300 border-orange-800">
                  <Music className="h-3 w-3 mr-1" />
                  {c.name} ({c.track_count})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}