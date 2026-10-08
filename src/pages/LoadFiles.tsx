import { useCallback, useEffect, useState } from "react";
import { ChevronDown, FolderOpen, Loader2, RefreshCw, ScanLine } from "lucide-react";

import { FolderBrowserDialog } from "@/components/dj/FolderBrowserDialog";
import { ShapeCluster } from "@/components/layout/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PageSection } from "@/components/layout/PageSection";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { api, apiStatus, describeApiError } from "@/lib/api";

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
  `Analyzed ${r.analyzed} tracks, updated ${r.updated} with BPM/key.` + (r.skipped > 0 ? ` Skipped ${r.skipped}.` : "");

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function LoadFiles() {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisProgress | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [currentRoot, setCurrentRoot] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [manualError, setManualError] = useState("");

  const loadCurrentState = useCallback(async () => {
    try {
      const [rootRes, cratesRes] = await Promise.all([
        api.get<{ root_path: string | null }>("/library/root"),
        api.get<Crate[]>("/library/crates"),
      ]);
      setCurrentRoot(rootRes.root_path);
      setCrates(cratesRes);
      setStatus("ready");
    } catch (error) {
      setLoadError(describeApiError(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadCurrentState();
  }, [loadCurrentState]);

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
          setAnalysis({ running: true, done: status.done, total: status.total, currentTitle: status.current_title });
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
  }, [analysis?.running, loadCurrentState]);

  const scanRoot = async (root: string) => {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await api.post<ScanResult>("/library/scan", { root_path: root });
      setScanResult(result);
      toast({ title: "Scan complete", description: `Found ${result.total} files, added ${result.added} tracks.` });
    } catch (error) {
      toast({ title: "Scan failed", description: describeApiError(error), variant: "destructive" });
    } finally {
      setScanning(false);
      loadCurrentState();
    }
  };

  /** Save a folder as the music folder, then scan it. */
  const adoptFolder = async (path: string) => {
    try {
      await api.put("/library/root", { root_path: path });
      setCurrentRoot(path);
      await scanRoot(path);
    } catch (error) {
      toast({ title: "That folder can't be used", description: describeApiError(error), variant: "destructive" });
    }
  };

  /**
   * Pick a folder and scan it, in one action. The desktop app opens the
   * system's folder dialog; in a browser tab the in-app folder browser opens.
   */
  const handlePickFolder = async () => {
    try {
      const result = await api.post<{ path: string | null }>("/library/pick-folder");
      if (result.path) await adoptFolder(result.path);
      return; // a null path means the dialog was cancelled
    } catch {
      // Not in desktop mode — fall through to the in-app browser dialog.
    }
    setBrowserOpen(true);
  };

  const handleRescan = async () => {
    if (currentRoot) await scanRoot(currentRoot);
  };

  // Manual path entry — fallback only (headless/SSH setups).
  const saveManualPath = async (scan: boolean) => {
    const path = manualPath.trim();
    if (!path) {
      setManualError("Type the full path of the folder, e.g. /home/you/Music.");
      return;
    }
    try {
      await api.put("/library/root", { root_path: path });
      setCurrentRoot(path);
      setManualPath("");
      setManualError("");
      if (scan) await scanRoot(path);
      else {
        toast({ title: "Music folder saved" });
        loadCurrentState();
      }
    } catch (error) {
      setManualError(describeApiError(error));
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
    } catch (error) {
      if (apiStatus(error) === 409) {
        toast({ title: "Analysis is already running", variant: "destructive" });
      } else {
        toast({ title: "Analysis failed", description: describeApiError(error), variant: "destructive" });
      }
    }
  };

  const analysisRunning = analysis?.running ?? false;
  // Busy covers scan + analysis so folder-pick/rescan can't run mid-analysis.
  const busy = scanning || analysisRunning;
  const trackTotal = crates.reduce((sum, crate) => sum + crate.track_count, 0);

  const advanced = (
    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
      <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-sm text-[13px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown className="h-3.5 w-3.5 transition-transform duration-fast group-data-[state=open]:rotate-180" />
        Set the folder by typing its path
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-4">
        <div className="max-w-xl space-y-2">
          <Label htmlFor="manual-path">Folder path</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="manual-path"
              placeholder="/home/you/Music"
              value={manualPath}
              onChange={(e) => {
                setManualPath(e.target.value);
                if (manualError) setManualError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && saveManualPath(true)}
              aria-invalid={!!manualError}
              aria-describedby="manual-path-help"
              className="k-num min-w-[14rem] flex-1 text-[13px]"
            />
            <Button variant="outline" onClick={() => saveManualPath(true)} disabled={busy}>
              Save and scan
            </Button>
            <Button variant="ghost" onClick={() => saveManualPath(false)} disabled={busy}>
              Save only
            </Button>
          </div>
          <p id="manual-path-help" className={manualError ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {manualError || "For machines without a desktop, e.g. over SSH. On a desktop, the folder picker is quicker."}
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  return (
    <div className="min-h-full">
      <PageHeader
        title="Import"
        meta={status === "ready" && currentRoot ? `${count(trackTotal, "track")} · ${count(crates.length, "crate")}` : undefined}
        actions={
          status === "ready" && currentRoot ? (
            <Button variant="outline" onClick={handleRescan} disabled={busy}>
              {scanning ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {scanning ? "Scanning…" : "Re-scan"}
            </Button>
          ) : undefined
        }
      />

      {status === "loading" ? (
        <div role="status" aria-label="Loading" className="max-w-4xl space-y-4 px-5 py-8 md:px-8">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-4 w-72" />
        </div>
      ) : status === "error" ? (
        <div className="k-grain px-5 py-14 md:px-8">
          <h2 className="k-display-sm">Import isn't available.</h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted-foreground">
            Klangkurator couldn't reach its backend: {loadError}. Check that the app is running (./run.sh status), then try
            again.
          </p>
          <Button className="mt-7" onClick={() => loadCurrentState()}>
            Try again
          </Button>
        </div>
      ) : !currentRoot ? (
        <>
          <section aria-labelledby="start-heading" className="k-grain border-b border-border px-5 py-12 md:px-8 md:py-16">
            <div className="grid max-w-5xl items-center gap-12 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="max-w-xl">
                <h2 id="start-heading" className="k-display-sm md:text-display">
                  Start with your music folder.
                </h2>
                <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                  Klangkurator reads one folder on this computer and everything inside it. Each subfolder becomes a crate.
                  Your files stay where they are.
                </p>
                <Button size="lg" className="mt-8" onClick={handlePickFolder} disabled={busy}>
                  {scanning ? <Loader2 className="animate-spin" /> : <FolderOpen />}
                  {scanning ? "Scanning…" : "Choose folder & scan"}
                </Button>
                <p className="mt-3 text-xs text-muted-foreground">
                  The desktop app opens your system's folder dialog; in a browser tab a folder browser opens.
                </p>
              </div>
              <ShapeCluster arrangement="orbit" className="hidden h-44 w-44 md:block" />
            </div>
          </section>

          <ol aria-label="How importing works" className="grid max-w-5xl gap-x-10 gap-y-6 px-5 py-10 md:grid-cols-3 md:px-8">
            {[
              ["Choose the folder", "The top folder that holds all your music, with a subfolder per crate."],
              ["Scan", "Every audio file inside is added with its tags and cover art. A re-scan only adds new files."],
              ["Analyze", "Fill in missing BPM and key from the audio itself, about 3–5 seconds per track."],
            ].map(([title, body], i) => (
              <li key={title} className="border-t border-border pt-4">
                <h3 className="flex items-baseline gap-2.5 text-[15px] font-semibold">
                  <span className="k-num text-xs font-normal text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  {title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>

          <div className="px-5 pb-16 md:px-8">{advanced}</div>
        </>
      ) : (
        <div className="max-w-5xl px-5 pb-20 md:px-8">
          <PageSection
            id="folder"
            title="Music folder"
            description="Klangkurator reads this folder and everything inside it. Each subfolder is a crate."
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-4 py-3">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <code className="k-num min-w-0 flex-1 truncate text-[13px]" title={currentRoot}>
                {currentRoot}
              </code>
              <Button variant="ghost" size="sm" onClick={handlePickFolder} disabled={busy}>
                Change folder
              </Button>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Re-scan adds new files. Tracks already in the library keep their notes and tags.
            </p>
            {scanResult && <ScanSummary result={scanResult} />}
          </PageSection>

          <PageSection
            id="analysis"
            title="BPM and key"
            description="Detects BPM and key from the audio for tracks that are missing them, about 3–5 seconds per track."
          >
            <Button variant="outline" onClick={handleAnalyzeAll} disabled={busy}>
              {analysisRunning ? <Loader2 className="animate-spin" /> : <ScanLine />}
              {analysisRunning ? "Analyzing…" : "Analyze BPM and key"}
            </Button>
            {analysisRunning && analysis && (
              <div className="mt-4 max-w-xl space-y-2">
                <Progress
                  value={analysis.total > 0 ? (analysis.done / analysis.total) * 100 : 0}
                  aria-label="BPM and key analysis"
                />
                <p className="flex min-w-0 gap-2 text-xs text-muted-foreground">
                  <span className="k-num shrink-0">
                    {analysis.done} / {analysis.total}
                  </span>
                  {analysis.currentTitle && (
                    <span className="truncate" title={analysis.currentTitle}>
                      {analysis.currentTitle}
                    </span>
                  )}
                </p>
              </div>
            )}
            {analysisResult && !analysisRunning && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Last run: <span className="k-num text-foreground">{analysisResult.analyzed}</span> analyzed,{" "}
                <span className="k-num text-foreground">{analysisResult.updated}</span> updated
                {analysisResult.skipped > 0 && (
                  <>
                    , <span className="k-num text-foreground">{analysisResult.skipped}</span> skipped
                  </>
                )}
                .
              </p>
            )}
          </PageSection>

          <PageSection id="crates" title="Crates" description="The subfolders of the music folder, with their track counts.">
            {crates.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No tracks yet. Scan the folder to fill your crates.</p>
            ) : (
              <ul className="max-w-xl divide-y divide-border border-y border-border">
                {crates.map((crate) => (
                  <li key={crate.name} className="flex h-10 items-center justify-between gap-4 text-[13px]">
                    <span className="truncate">{crate.name}</span>
                    <span className="k-num shrink-0 text-xs text-muted-foreground">{crate.track_count}</span>
                  </li>
                ))}
              </ul>
            )}
          </PageSection>

          <PageSection id="advanced" title="Advanced">
            {advanced}
          </PageSection>
        </div>
      )}

      <FolderBrowserDialog open={browserOpen} onOpenChange={setBrowserOpen} onSelect={adoptFolder} />
    </div>
  );
}

function ScanSummary({ result }: { result: ScanResult }) {
  const shownErrors = result.errors.slice(0, 5);
  return (
    <div role="status" className="mt-5 text-[13px]">
      <p>
        Scan finished: <span className="k-num">{result.added}</span> added,{" "}
        <span className="k-num">{result.skipped}</span> already in the library
        {result.errors.length > 0 && (
          <>
            , <span className="k-num text-destructive">{result.errors.length}</span> could not be read
          </>
        )}
        . <span className="text-muted-foreground">{count(result.total, "audio file")} found.</span>
      </p>
      {shownErrors.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {shownErrors.map((error, i) => (
            <li key={i} className="k-num break-all">
              {error}
            </li>
          ))}
          {result.errors.length > shownErrors.length && <li>and {result.errors.length - shownErrors.length} more</li>}
        </ul>
      )}
    </div>
  );
}
