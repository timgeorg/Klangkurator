import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { api } from "@/lib/api";
import { FolderBrowserDialog } from "@/components/dj/FolderBrowserDialog";
import {
  FolderOpen, Music, Folder, ScanLine, XCircle,
  ChevronDown, RefreshCw, Loader2,
} from "lucide-react";

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

interface AnalysisSummary {
  analyzed: number;
  updated: number;
  skipped: number;
}

interface AnalysisProgress {
  running: boolean;
  done: number;
  total: number;
  currentTitle: string;
}

/** POST /library/analyze-all returns either a started-job marker or a direct summary. */
interface AnalyzeAllResponse {
  started?: boolean;
  total?: number;
  analyzed?: number;
  updated?: number;
  skipped?: number;
}

const describeAnalysisResult = (r: AnalysisSummary): string =>
  `Analyzed ${r.analyzed} tracks, updated ${r.updated} with BPM/key.` +
  (r.skipped > 0 ? ` Skipped ${r.skipped}.` : "");

export default function LoadFiles() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [currentRoot, setCurrentRoot] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const advancedRef = useRef<HTMLInputElement | null>(null);

  // Load current root folder and crates on mount
  useEffect(() => {
    loadCurrentState();
  }, []);

  // Poll analysis status every 500ms while a job is running. The interval
  // is cleaned up when `analysis` is cleared or the component unmounts;
  // `cancelled` guards against setState after unmount.
  useEffect(() => {
    if (!analysis?.running) return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const status = await api.get<{
          running: boolean;
          done: number;
          total: number;
          current_title: string;
          finished: boolean;
          result: (AnalysisSummary & { errors: string[] }) | null;
          error: string | null;
        }>("/library/analyze-status");
        if (cancelled) return;
        if (status.running) {
          // `done` may briefly repeat between polls (backend fires the
          // callback pre+post track) — harmless, the bar just pauses.
          setAnalysis({
            running: true,
            done: status.done,
            total: status.total,
            currentTitle: status.current_title,
          });
        } else if (status.error) {
          setAnalysis(null);
          toast({ title: "Analysis failed", description: status.error, variant: "destructive" });
        } else if (status.finished && status.result) {
          setAnalysisResult({
            analyzed: status.result.analyzed,
            updated: status.result.updated,
            skipped: status.result.skipped,
          });
          setAnalysis(null);
          loadCurrentState();
          toast({ title: "Analysis complete", description: describeAnalysisResult(status.result) });
        } else {
          // Running flag went away without result or error — stop defensively.
          setAnalysis(null);
        }
      } catch {
        // Transient poll error (e.g. backend restart) — keep polling.
      }
    }, 500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [analysis?.running]);

  const loadCurrentState = async () => {
    try {
      const [rootRes, cratesRes] = await Promise.all([
        api.get<{ root_path: string | null }>("/library/root"),
        api.get<Crate[]>("/library/crates"),
      ]);
      setCurrentRoot(rootRes.root_path);
      setCrates(cratesRes);
    } catch {
      // Backend not reachable — show as is
    }
  };

  const scanRoot = async (root: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.post<ScanResult>("/library/scan", { root_path: root });
      setScanResult(result);
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
      setScanning(false);
      loadCurrentState();
    }
  };

  /**
   * Pick a folder (native OS dialog), set it as root, and scan it —
   * one action. Works in desktop mode (PyWebView dialog) and browser
   * mode against a local backend (GTK portal dialog).
   */
  const handlePickFolder = async () => {
    // Desktop first: real native dialog.
    try {
      const result = await api.post<{ path: string | null }>("/library/pick-folder");
      if (result.path) {
        setCurrentRoot(result.path);
        await scanRoot(result.path);
        return;
      }
      return; // user cancelled the native dialog
    } catch {
      // Not in desktop mode — fall through to the in-app browser dialog.
    }

    setBrowserOpen(true);
  };

  const handleBrowserSelect = async (path: string) => {
    try {
      await api.put("/library/root", { root_path: path });
      setCurrentRoot(path);
      await scanRoot(path);
    } catch (e: any) {
      toast({
        title: "Could not use folder",
        description: e.message || "Failed to set root folder.",
        variant: "destructive",
      });
    }
  };

  const handleRescan = async () => {
    if (!currentRoot) return;
    await scanRoot(currentRoot);
  };

  // Manual path entry — fallback only (headless/SSH setups).
  const handleManualSave = async () => {
    const p = manualPath.trim();
    if (!p) return;
    try {
      await api.put("/library/root", { root_path: p });
      setCurrentRoot(p);
      setManualPath("");
      toast({ title: "Root folder saved" });
    } catch (e: any) {
      toast({
        title: "Invalid path",
        description: e.message || "Could not save root folder.",
        variant: "destructive",
      });
    }
  };

  const handleManualSaveAndScan = async () => {
    const p = manualPath.trim();
    if (!p) return;
    try {
      await api.put("/library/root", { root_path: p });
      setCurrentRoot(p);
      setManualPath("");
      await scanRoot(p);
    } catch (e: any) {
      toast({
        title: "Invalid path",
        description: e.message || "Could not save root folder.",
        variant: "destructive",
      });
    }
  };

  /**
   * Kick off analysis of all tracks missing BPM/key.
   * Two outcomes:
   * - `{started: true, total: N}` — job started, begin polling /analyze-status.
   * - a direct summary — nothing to analyze, show the completion toast now.
   * HTTP 409 means a job is already running (double-click protection).
   */
  const handleAnalyzeAll = async () => {
    try {
      const result = await api.post<AnalyzeAllResponse>("/library/analyze-all");
      if (result.started === true) {
        setAnalysis({ running: true, done: 0, total: result.total ?? 0, currentTitle: "" });
        return;
      }
      const summary: AnalysisSummary = {
        analyzed: result.analyzed ?? 0,
        updated: result.updated ?? 0,
        skipped: result.skipped ?? 0,
      };
      setAnalysisResult(summary);
      toast({ title: "Analysis complete", description: describeAnalysisResult(summary) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409")) {
        toast({ title: "Analysis already running", variant: "destructive" });
      } else {
        toast({ title: "Analysis failed", description: msg, variant: "destructive" });
      }
    }
  };

  const analysisRunning = analysis?.running ?? false;
  // Busy covers scan + analysis so folder-pick/rescan can't run mid-analysis.
  const busy = scanning || analysisRunning;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-orange-500 mb-1">Load Files</h2>
        <p className="text-sm text-muted-foreground">
          Pick your music root folder — it is scanned and imported automatically.
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
            The top-level folder containing all your music crates. All folders
            and audio files inside it are loaded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {currentRoot ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-4 w-4 shrink-0 text-orange-500" />
                <code className="truncate text-xs bg-muted px-1.5 py-0.5 rounded" title={currentRoot}>
                  {currentRoot}
                </code>
              </div>
              <Button
                size="sm" variant="ghost" className="h-7 shrink-0"
                disabled={busy}
                onClick={handleRescan}
                title="Re-scan this folder (only adds new files)"
              >
                {scanning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                Re-scan
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No root folder set yet.</p>
          )}

          <Button
            onClick={handlePickFolder}
            disabled={busy}
            className="w-full bg-orange-600 hover:bg-orange-700"
            size="lg"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning…
              </>
            ) : (
              <>
                <FolderOpen className="h-4 w-4 mr-2" />
                Choose folder & scan
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">
            Opens your operating system's folder picker. Selecting a folder sets
            it as root and scans it immediately — including all subfolders.
          </p>

          {scanResult && (
            <div className="space-y-3 pt-1">
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
        </CardContent>
      </Card>

      {/* Maintenance section — only relevant once a root exists */}
      {currentRoot && crates.length > 0 && (
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <ScanLine className="h-4 w-4" />
              Audio Analysis
            </CardTitle>
            <CardDescription>
              Fill in missing BPM and key for imported tracks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={handleAnalyzeAll}
              disabled={busy || analysisRunning}
              variant="outline"
              className="w-full"
            >
              {analysisRunning ? "Analyzing…" : "Analyze BPM/Key"}
            </Button>

            {analysisRunning && (
              <div className="space-y-1.5">
                <Progress
                  value={analysis && analysis.total > 0 ? (analysis.done / analysis.total) * 100 : 0}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  Analyzing ({analysis?.done ?? 0}/{analysis?.total ?? 0})…
                  {analysis?.currentTitle && (
                    <span className="block truncate" title={analysis.currentTitle}>
                      {analysis.currentTitle}
                    </span>
                  )}
                </p>
              </div>
            )}

            {analysisResult && !analysisRunning && (
              <p className="text-xs text-muted-foreground">
                Last run: {analysisResult.analyzed} analyzed, {analysisResult.updated} updated
                {analysisResult.skipped > 0 ? `, ${analysisResult.skipped} skipped` : ""}.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Runs librosa audio analysis to detect BPM and key for tracks missing them (~3-5s per track).
            </p>
          </CardContent>
        </Card>
      )}

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

      <Separator />

      {/* Manual path entry — fallback only */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="w-full">
        <CollapsibleTrigger className="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ChevronDown className="h-3 w-3 transition-transform group-data-[state=open]:rotate-180" />
          Advanced — set root folder by path (headless setups)
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <div className="flex gap-2">
            <Input
              ref={advancedRef}
              placeholder="/home/tim/Music"
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSaveAndScan()}
              className="flex-1"
            />
            <Button variant="secondary" onClick={handleManualSave}>Save</Button>
            <Button variant="outline" onClick={handleManualSaveAndScan}>Save & scan</Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            For machines without a GUI (SSH). On a desktop, use the folder
            picker above.
          </p>
        </CollapsibleContent>
      </Collapsible>

      <FolderBrowserDialog
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        onSelect={handleBrowserSelect}
      />
    </div>
  );
}