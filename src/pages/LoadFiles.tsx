import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import { fileName } from "@/lib/audioVariants";
import { api, apiStatus, describeApiError } from "@/lib/api";
import {
  useBackgroundJobs,
  type AnalysisResult,
  type AttachOffer,
  type ScanResult,
} from "@/lib/BackgroundJobsContext";
import { refreshCratesQuietly, type Crate, type MusicLocation } from "@/lib/crates";
import { storage } from "@/lib/storage";
import { formatDuration } from "@/lib/trackFormat";

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function LoadFiles() {
  const { scan, analysis, busy, startScan, startAnalysis, abortAnalysis } = useBackgroundJobs();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [crates, setCrates] = useState<Crate[]>([]);
  const [locations, setLocations] = useState<MusicLocation[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualPath, setManualPath] = useState("");
  const [manualError, setManualError] = useState("");

  const loadCurrentState = useCallback(async () => {
    try {
      // The registry is the single source for crates and locations (issue #11):
      // a first import adds the library's first music location, so this page
      // reads the same list Settings manages.
      await refreshCratesQuietly();
      const [cratesRes, locationsRes] = await Promise.all([
        api.get<Crate[]>("/library/crates"),
        api.get<MusicLocation[]>("/library/locations"),
      ]);
      setCrates(cratesRes);
      setLocations(locationsRes);
      setStatus("ready");
    } catch (error) {
      setLoadError(describeApiError(error));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadCurrentState();
  }, [loadCurrentState]);

  // BC-5: the summary belongs to a scan that finished while this page was
  // open. A scan that ended on another page, or before the reload, must not
  // leave its numbers behind here. `sawScan` tells "finished now" from the
  // status this page resumed with. The notice itself is the context's job.
  const sawScan = useRef(false);
  useEffect(() => {
    if (scan.running) {
      sawScan.current = true;
      return;
    }
    if (!sawScan.current) return;
    sawScan.current = false;
    if (!scan.error && scan.result) setScanResult(scan.result);
    loadCurrentState();
  }, [scan.running, scan.result, scan.error, loadCurrentState]);

  // A job's progress and its end notice live in BackgroundJobsContext, so
  // every page shows the same numbers and the toast can never disagree with
  // this page (issue #46). This page only starts the jobs and shows what the
  // context reports.

  const scanLocation = async (locationId: string) => {
    setScanResult(null);
    try {
      await startScan(locationId);
    } catch (error) {
      // 409: another job already runs; the context has picked up its progress,
      // so this is information, not a failure.
      if (apiStatus(error) === 409) toast({ title: describeApiError(error) });
      else toast({ title: "Scan failed", description: describeApiError(error), variant: "destructive" });
    }
  };

  /** Register a folder as a music location, then scan it — one action. */
  const adoptFolder = async (path: string) => {
    try {
      const location = await api.post<MusicLocation>("/library/locations", { path });
      await loadCurrentState();
      await scanLocation(location.id);
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
    const first = locations[0];
    if (first) await scanLocation(first.id);
  };

  // Manual path entry — fallback only (headless/SSH setups).
  const saveManualPath = async (alsoScan: boolean) => {
    // Enter in the field reaches here too; no root change while a job runs.
    if (busy) return;
    const path = manualPath.trim();
    if (!path) {
      setManualError("Type the full path of the folder, e.g. /home/you/Music.");
      return;
    }
    try {
      const location = await api.post<MusicLocation>("/library/locations", { path });
      setManualPath("");
      setManualError("");
      await loadCurrentState();
      if (alsoScan) await scanLocation(location.id);
      else toast({ title: "Music location saved" });
    } catch (error) {
      setManualError(describeApiError(error));
    }
  };

  /**
   * Kick off the analysis of all tracks missing BPM/key.
   *
   * The context handles both answers: `{started, total}` for a job, or the
   * summary the route returns when nothing is missing a BPM. A 409 means
   * another job holds the slot: the context reads both statuses then, so that
   * job's progress shows here, and the message says which job it is.
   */
  const handleAnalyzeAll = async () => {
    try {
      await startAnalysis();
    } catch (error) {
      if (apiStatus(error) === 409) toast({ title: describeApiError(error) });
      else toast({ title: "The analysis did not start", description: describeApiError(error), variant: "destructive" });
    }
  };

  const trackTotal = crates.reduce((sum, crate) => sum + crate.track_count, 0);
  // The Import page is the first-location flow (issue #11). Further locations
  // are added, removed and rescanned in Settings, which is their home.
  const firstLocation = locations[0];
  const lastAnalysis: AnalysisResult | null = !analysis.running ? analysis.result : null;

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
        meta={status === "ready" && firstLocation ? `${count(trackTotal, "track")} · ${count(crates.length, "crate")}` : undefined}
        actions={
          status === "ready" && firstLocation ? (
            <Button variant="outline" onClick={handleRescan} disabled={busy}>
              {scan.running ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              {scan.running ? "Scanning…" : "Re-scan"}
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
      ) : !firstLocation ? (
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
                  {scan.running ? <Loader2 className="animate-spin" /> : <FolderOpen />}
                  {scan.running ? "Scanning…" : "Choose folder & scan"}
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
            title="Music folders"
            description="Klangkurator reads each folder below and everything inside it. Every subfolder is a crate."
          >
            <ul className="space-y-2">
              {locations.map((location) => (
                <li
                  key={location.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-4 py-3"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <code className="k-num min-w-0 flex-1 truncate text-[13px]" title={location.path}>
                    {location.path}
                  </code>
                  <span className="k-num shrink-0 text-xs text-muted-foreground">
                    {count(location.crate_count, "crate")} · {count(location.track_count, "track")}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handlePickFolder} disabled={busy}>
                Add a folder
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link to="/settings#locations">Manage folders</Link>
              </Button>
            </div>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Re-scan adds new files. Tracks already in the library keep their notes and tags.
            </p>
            {scan.running && (
              <div className="mt-4 max-w-xl space-y-2">
                <Progress
                  value={scan.total > 0 ? (scan.done / scan.total) * 100 : 0}
                  aria-label="Scan progress"
                />
                <p className="flex min-w-0 gap-2 text-xs text-muted-foreground">
                  <span className="k-num shrink-0">
                    {scan.done} / {scan.total}
                  </span>
                  {scan.currentFile && (
                    <span className="truncate" title={scan.currentFile}>
                      {scan.currentFile}
                      {scan.currentCrate && <span className="text-muted-foreground"> · {scan.currentCrate}</span>}
                    </span>
                  )}
                </p>
              </div>
            )}
            {scanResult && <ScanSummary result={scanResult} />}
            {scanResult && <AttachOffers offers={scanResult.offers ?? []} />}
          </PageSection>

          <PageSection
            id="analysis"
            title="BPM and key"
            description="Detects BPM and key from the audio for tracks that are missing them, about 3–5 seconds per track."
          >
            <Button variant="outline" onClick={handleAnalyzeAll} disabled={busy}>
              {analysis.running ? <Loader2 className="animate-spin" /> : <ScanLine />}
              {analysis.running ? "Analyzing…" : "Analyze BPM and key"}
            </Button>
            {analysis.running && (
              <div className="mt-4 max-w-xl space-y-2">
                <div className="flex items-center gap-3">
                  <Progress
                    value={analysis.total > 0 ? (analysis.done / analysis.total) * 100 : 0}
                    aria-label="BPM and key analysis progress"
                    className="min-w-0 flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={abortAnalysis}
                    disabled={analysis.stopping}
                  >
                    Abort
                  </Button>
                </div>
                <p className="flex min-w-0 gap-2 text-xs text-muted-foreground">
                  <span className="k-num shrink-0">
                    {analysis.done} / {analysis.total}
                  </span>
                  <span className="truncate" title={analysis.stopping ? undefined : analysis.currentTitle}>
                    {analysis.stopping ? "Stopping after this track…" : analysis.currentTitle}
                  </span>
                </p>
              </div>
            )}
            {lastAnalysis && (
              <p className="mt-3 text-[13px] text-muted-foreground">
                Last run: <span className="k-num text-foreground">{lastAnalysis.analyzed}</span> analyzed,{" "}
                <span className="k-num text-foreground">{lastAnalysis.updated}</span> updated
                {lastAnalysis.skipped > 0 && (
                  <>
                    , <span className="k-num text-foreground">{lastAnalysis.skipped}</span> skipped
                  </>
                )}
                {lastAnalysis.cancelled && " (stopped)"}.
              </p>
            )}
          </PageSection>

          <PageSection id="crates" title="Crates" description="Every folder inside your music folders, with its track count.">
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

/**
 * The files the scan met that look like another copy of a track it already has.
 *
 * Issue #65, AC-1: the scan offers, it never attaches. A `.wav` has no tags, so
 * its artist comes from the file name and will not equal the `.mp3`'s tag
 * artist — the match is a guess the user confirms in one click. Applying it
 * adds a variant, never a row (AC-2).
 */
function AttachOffers({ offers }: { offers: AttachOffer[] }) {
  const [applied, setApplied] = useState<Record<string, "busy" | "done" | "failed">>({});
  if (offers.length === 0) return null;

  const attach = async (offer: AttachOffer) => {
    setApplied((prev) => ({ ...prev, [offer.file_path]: "busy" }));
    try {
      await storage.attachVariant(offer.song_id, offer.file_path);
      setApplied((prev) => ({ ...prev, [offer.file_path]: "done" }));
      toast({ title: "File attached", description: `“${fileName(offer.file_path)}” is now a variant of “${offer.title}”.` });
    } catch (error) {
      setApplied((prev) => ({ ...prev, [offer.file_path]: "failed" }));
      toast({ title: "The file was not attached", description: describeApiError(error), variant: "destructive" });
    }
  };

  return (
    <div className="mt-5 max-w-xl space-y-2">
      <h3 className="text-[13px] font-semibold">Files of tracks you already have</h3>
      <ul className="divide-y divide-border border-y border-border">
        {offers.map((offer) => {
          const state = applied[offer.file_path];
          return (
            <li key={offer.file_path} className="flex items-center gap-3 py-2.5 text-[13px]">
              <div className="min-w-0 flex-1">
                <p className="truncate" title={offer.file_path}>
                  {fileName(offer.file_path)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {offer.match === "duration" ? "Same length as" : "Same artist and title as"} “{offer.title}”
                  {offer.match === "duration" && ` — ${formatDuration(offer.duration)}`}
                </p>
              </div>
              {state === "done" ? (
                <span className="shrink-0 text-xs text-muted-foreground">Attached</span>
              ) : (
                <Button variant="outline" size="sm" disabled={state === "busy"} onClick={() => attach(offer)}>
                  {state === "busy" ? "Attaching…" : "Attach as variant"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        A variant is another file of the same recording. It joins the track instead of becoming a second row, and
        the track keeps its notes, ratings and tags.
      </p>
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
        {(result.offered ?? 0) > 0 && (
          <>
            , <span className="k-num text-foreground">{result.offered}</span>{" "}
            {count(result.offered ?? 0, "variant")} offered
          </>
        )}
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
