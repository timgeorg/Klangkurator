import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "@/hooks/use-toast";
import { api, apiStatus, describeApiError } from "@/lib/api";

/** How often a running job's status is read (REQ-10-SP, REQ-10-AP). */
const POLL_MS = 500;

/** What a finished scan counted (the job's `result`). */
export interface ScanResult {
  total: number;
  added: number;
  skipped: number;
  errors: string[];
}

/** What a finished analysis counted; `cancelled` is true only after an Abort. */
export interface AnalysisResult {
  analyzed: number;
  updated: number;
  skipped: number;
  errors: string[];
  cancelled: boolean;
}

/** A scan as the views show it, in camelCase. */
export interface ScanProgress {
  running: boolean;
  done: number;
  total: number;
  /** The file in progress — its name, not its path. */
  currentFile: string;
  currentCrate: string;
  result: ScanResult | null;
  error: string | null;
}

/** An analysis as the views show it, in camelCase. */
export interface AnalysisProgress {
  running: boolean;
  /** An Abort was asked for; the run ends after the track it is on. */
  stopping: boolean;
  done: number;
  total: number;
  currentTitle: string;
  result: AnalysisResult | null;
  error: string | null;
}

interface ScanStatusResponse {
  running: boolean;
  finished: boolean;
  done: number;
  total: number;
  current_file: string;
  current_crate: string;
  added: number;
  skipped: number;
  errors: string[];
  result: ScanResult | null;
  error: string | null;
}

interface AnalysisStatusResponse {
  running: boolean;
  stopping: boolean;
  finished: boolean;
  done: number;
  total: number;
  current_title: string;
  result: AnalysisResult | null;
  error: string | null;
}

/** POST /library/analyze-all answers either a started-job marker or a summary. */
interface AnalyzeAllResponse {
  started?: boolean;
  total?: number;
  analyzed?: number;
  updated?: number;
  skipped?: number;
  errors?: string[];
  cancelled?: boolean;
}

export interface BackgroundJobsContextValue {
  scan: ScanProgress;
  analysis: AnalysisProgress;
  /** True while either job runs — the Import page disables its starts then. */
  busy: boolean;
  /** Start a scan of `root`. Throws when the backend refuses it. */
  startScan: (root: string) => Promise<void>;
  /** Start the BPM/key analysis. Throws when the backend refuses it. */
  startAnalysis: () => Promise<void>;
  /** Ask the running analysis to stop after the track it is on. */
  abortAnalysis: () => Promise<void>;
  /** The progress toast was closed for the scan that is running. */
  scanToastClosed: boolean;
  /** The progress toast was closed for the analysis that is running. */
  analysisToastClosed: boolean;
  closeScanToast: () => void;
  closeAnalysisToast: () => void;
}

const IDLE_SCAN: ScanProgress = {
  running: false,
  done: 0,
  total: 0,
  currentFile: "",
  currentCrate: "",
  result: null,
  error: null,
};

const IDLE_ANALYSIS: AnalysisProgress = {
  running: false,
  stopping: false,
  done: 0,
  total: 0,
  currentTitle: "",
  result: null,
  error: null,
};

const describeAnalysisResult = (r: AnalysisResult): string =>
  `Analyzed ${r.analyzed} tracks, updated ${r.updated} with BPM/key.` +
  (r.skipped > 0 ? ` Skipped ${r.skipped}.` : "");

const toScanProgress = (status: ScanStatusResponse): ScanProgress => ({
  running: status.running,
  done: status.done,
  total: status.total,
  currentFile: status.current_file,
  currentCrate: status.current_crate,
  result: status.result,
  error: status.error,
});

const toAnalysisProgress = (status: AnalysisStatusResponse): AnalysisProgress => ({
  running: status.running,
  stopping: status.stopping,
  done: status.done,
  total: status.total,
  currentTitle: status.current_title,
  result: status.result,
  error: status.error,
});

const BackgroundJobsContext = createContext<BackgroundJobsContextValue | null>(null);

/**
 * The scan and the analysis as one app-wide pair of background jobs.
 *
 * The backend runs at most one of them at a time (REQ-10-SP, REQ-10-AP), so
 * this provider keeps both statuses, polls the one that runs, and announces
 * how each run ends: `klangkurator:library-changed` for the tables, and the
 * notice the user gets on whatever page is open ("Scan finished" without
 * numbers; "Analysis complete" or "Analysis stopped" with them).
 *
 * The status is read once on mount, so a reload (or a second tab) picks a
 * running job back up. Each run also gets a number, which is what makes a
 * closed progress toast stay closed for that run and open again for the next.
 */
export function BackgroundJobsProvider({ children }: { children: React.ReactNode }) {
  const [scan, setScan] = useState<ScanProgress>(IDLE_SCAN);
  const [analysis, setAnalysis] = useState<AnalysisProgress>(IDLE_ANALYSIS);
  const [scanRun, setScanRun] = useState(0);
  const [analysisRun, setAnalysisRun] = useState(0);
  const [closedScanRun, setClosedScanRun] = useState<number | null>(null);
  const [closedAnalysisRun, setClosedAnalysisRun] = useState<number | null>(null);

  // The last status applied, so a run's end is noticed exactly once.
  const scanRunning = useRef(false);
  const analysisRunning = useRef(false);

  const applyScan = useCallback((status: ScanStatusResponse, announce: boolean) => {
    const wasRunning = scanRunning.current;
    scanRunning.current = status.running;
    setScan(toScanProgress(status));
    if (status.running && !wasRunning) {
      setScanRun((run) => run + 1);
      return;
    }
    if (!wasRunning || status.running) return;
    if (!announce) return;
    window.dispatchEvent(new Event("klangkurator:library-changed"));
    if (status.error) {
      toast({ variant: "destructive", title: "Scan failed", description: status.error });
    } else {
      // BC-5: the notice says it finished, and nothing more.
      toast({ title: "Scan finished" });
    }
  }, []);

  const applyAnalysis = useCallback((status: AnalysisStatusResponse, announce: boolean) => {
    const wasRunning = analysisRunning.current;
    analysisRunning.current = status.running;
    setAnalysis(toAnalysisProgress(status));
    if (status.running && !wasRunning) {
      setAnalysisRun((run) => run + 1);
      return;
    }
    if (!wasRunning || status.running) return;
    if (!announce) return;
    window.dispatchEvent(new Event("klangkurator:library-changed"));
    announceAnalysisEnd(status);
  }, []);

  /**
   * Read the given statuses. A failed read is swallowed: a transient backend
   * hiccup must not end the polling, and the next tick tries again.
   */
  const refresh = useCallback(
    async (jobs: { scan?: boolean; analysis?: boolean }, announce = true) => {
      if (jobs.scan) {
        const status = await api.get<ScanStatusResponse>("/library/scan-status").catch(() => null);
        if (status) applyScan(status, announce);
      }
      if (jobs.analysis) {
        const status = await api.get<AnalysisStatusResponse>("/library/analyze-status").catch(() => null);
        if (status) applyAnalysis(status, announce);
      }
    },
    [applyScan, applyAnalysis],
  );

  const anyRunning = scan.running || analysis.running;
  const scanRunningNow = scan.running;
  const analysisRunningNow = analysis.running;

  // Resume: a job that was already running before this page loaded. Its end
  // is not announced — it did not end under this page.
  useEffect(() => {
    refresh({ scan: true, analysis: true }, false);
  }, [refresh]);

  // Poll the job that runs (the backend allows one at a time). The timeout
  // is chained, not an interval, so a slow backend cannot stack requests.
  useEffect(() => {
    if (!anyRunning) return;
    const jobs = { scan: scanRunningNow, analysis: analysisRunningNow };
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      await refresh(jobs);
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [anyRunning, scanRunningNow, analysisRunningNow, refresh]);

  const startScan = useCallback(async (root: string) => {
    const res = await api.post<{ started: boolean; total: number }>("/library/scan", { root_path: root });
    scanRunning.current = true;
    setScanRun((run) => run + 1);
    setScan({ ...IDLE_SCAN, running: true, total: res?.total ?? 0 });
  }, []);

  const startAnalysis = useCallback(async () => {
    const res = await api.post<AnalyzeAllResponse>("/library/analyze-all");
    if (res?.started === true) {
      analysisRunning.current = true;
      setAnalysisRun((run) => run + 1);
      setAnalysis({ ...IDLE_ANALYSIS, running: true, total: res.total ?? 0 });
      return;
    }
    // Nothing was missing a BPM: the route answered with the summary itself.
    const result: AnalysisResult = {
      analyzed: res?.analyzed ?? 0,
      updated: res?.updated ?? 0,
      skipped: res?.skipped ?? 0,
      errors: res?.errors ?? [],
      cancelled: false,
    };
    setAnalysis({ ...IDLE_ANALYSIS, result });
    toast({ title: "Analysis complete", description: describeAnalysisResult(result) });
  }, []);

  const abortAnalysis = useCallback(async () => {
    try {
      await api.post("/library/analyze-cancel");
    } catch (error) {
      // 409: nothing was running any more. Read the status instead of
      // reporting an error the user cannot act on (REQ-10-AP).
      if (apiStatus(error) !== 409) {
        toast({
          variant: "destructive",
          title: "The analysis could not be stopped",
          description: describeApiError(error),
        });
      }
    }
    await refresh({ scan: true, analysis: true });
  }, [refresh]);

  const value = useMemo<BackgroundJobsContextValue>(
    () => ({
      scan,
      analysis,
      busy: scan.running || analysis.running,
      startScan,
      startAnalysis,
      abortAnalysis,
      scanToastClosed: closedScanRun === scanRun,
      analysisToastClosed: closedAnalysisRun === analysisRun,
      closeScanToast: () => setClosedScanRun(scanRun),
      closeAnalysisToast: () => setClosedAnalysisRun(analysisRun),
    }),
    [scan, analysis, startScan, startAnalysis, abortAnalysis, closedScanRun, closedAnalysisRun, scanRun, analysisRun],
  );

  return <BackgroundJobsContext.Provider value={value}>{children}</BackgroundJobsContext.Provider>;
}

/** The BPM/key analysis ending notice: stopped or complete, with its counts. */
function announceAnalysisEnd(status: AnalysisStatusResponse): void {
  if (status.error) {
    toast({ variant: "destructive", title: "Analysis failed", description: status.error });
    return;
  }
  if (!status.result) return;
  toast({
    title: status.result.cancelled ? "Analysis stopped" : "Analysis complete",
    description: describeAnalysisResult(status.result),
  });
}

// eslint-disable-next-line react-refresh/only-export-components -- the provider and its hook belong together
export function useBackgroundJobs(): BackgroundJobsContextValue {
  const ctx = useContext(BackgroundJobsContext);
  if (!ctx) {
    throw new Error("useBackgroundJobs must be used within a BackgroundJobsProvider");
  }
  return ctx;
}
