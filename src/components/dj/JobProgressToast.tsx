import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Toast, ToastAction, ToastClose, ToastDescription, ToastTitle } from "@/components/ui/toast";
import { useBackgroundJobs } from "@/lib/BackgroundJobsContext";
import { isImportPage } from "@/lib/jobProgress";

/** The Import page shows the same progress inline, so the toast stays off it. */

interface Shown {
  kind: "scan" | "analysis";
  title: string;
  /** The file name for a scan, the track title for an analysis. */
  item: string;
  /** A scan names the crate its file belongs to. */
  crate: string | null;
  done: number;
  total: number;
  stopping: boolean;
}

/**
 * The scan and the analysis as one progress toast, on every page but Import.
 *
 * It is a single controlled Radix toast rather than a `toast()` call: the
 * regular toasts keep only one at a time (`TOAST_LIMIT`), so a progress toast
 * made that way would be evicted by the next edit's notice (BC-14). Radix
 * portals every `<Toast>` into the shared viewport, so it stacks with them.
 *
 * It closes on X, swipe or Escape, and stays closed for that run: progress
 * and Abort remain on the Import page (BC-4, BC-8). While the toast animates
 * out it holds the last progress it showed, so the exit is not an empty box.
 */
export function JobProgressToast() {
  const { scan, analysis, scanToastClosed, analysisToastClosed, closeScanToast, closeAnalysisToast, abortAnalysis } =
    useBackgroundJobs();
  const { pathname } = useLocation();

  const shown = useMemo<Shown | null>(() => {
    if (scan.running) {
      return {
        kind: "scan",
        title: "Scanning your folder",
        item: scan.currentFile,
        crate: scan.currentCrate || null,
        done: scan.done,
        total: scan.total,
        stopping: false,
      };
    }
    if (analysis.running) {
      return {
        kind: "analysis",
        title: analysis.stopping ? "Stopping after this track…" : "Analyzing BPM and key",
        item: analysis.currentTitle,
        crate: null,
        done: analysis.done,
        total: analysis.total,
        stopping: analysis.stopping,
      };
    }
    return null;
  }, [scan, analysis]);

  // The last thing shown, kept through the exit animation.
  const [held, setHeld] = useState<Shown | null>(shown);
  useEffect(() => {
    if (shown) setHeld(shown);
  }, [shown]);

  const view = shown ?? held;
  if (!view) return null;

  const closed = view.kind === "scan" ? scanToastClosed : analysisToastClosed;
  const open = shown !== null && !isImportPage(pathname) && !closed;

  const handleOpenChange = (next: boolean) => {
    if (next) return;
    if (view.kind === "scan") closeScanToast();
    else closeAnalysisToast();
  };

  return (
    <Toast
      open={open}
      duration={Infinity}
      onOpenChange={handleOpenChange}
      // Radix closes a toast on Escape pressed anywhere; closing this one hides
      // the progress for the whole run, so only its own close button does that.
      onEscapeKeyDown={(event) => event.preventDefault()}
      className="block pr-10"
    >
      <div className="min-w-0 space-y-2">
        <ToastTitle className="flex items-center gap-2">
          {!view.stopping && (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
          )}
          {view.title}
        </ToastTitle>
        <Progress
          value={view.total > 0 ? (view.done / view.total) * 100 : 0}
          aria-label={view.kind === "scan" ? "Scan progress" : "BPM and key analysis progress"}
        />
        <ToastDescription>
          <span className="flex min-w-0 gap-2">
            <span className="k-num shrink-0">
              {view.done} / {view.total}
            </span>
            {view.item && (
              <span className="truncate" title={view.item}>
                {view.item}
                {view.crate && <span className="text-muted-foreground"> · {view.crate}</span>}
              </span>
            )}
          </span>
        </ToastDescription>
      </div>
      {view.kind === "analysis" && (
        <ToastAction
          altText="Abort the BPM and key analysis"
          className="mt-3 [@media(pointer:coarse)]:min-h-11"
          disabled={shown === null || view.stopping}
          onClick={(event) => {
            // ToastAction is a close button under the hood; Abort must not
            // dismiss the toast it is reporting on.
            event.preventDefault();
            abortAnalysis();
          }}
        >
          Abort
        </ToastAction>
      )}
      <ToastClose />
    </Toast>
  );
}
