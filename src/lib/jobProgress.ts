/**
 * Pure rules of the background jobs (REQ-10-SP, REQ-10-AP), kept apart from
 * the provider and the toast so they can be tested without a DOM.
 */

/** Failed status reads in a row before the views stop waiting (~10 s at 500 ms). */
export const POLL_FAILURE_LIMIT = 20;

/** The Import page, in any case and with or without a trailing slash — the router matches all of them. */
export function isImportPage(pathname: string): boolean {
  return pathname.replace(/\/+$/, "").toLowerCase() === "/load-files";
}

/** How a run ended, read from the first status that no longer says `running`. */
export function runEnd(status: {
  finished: boolean;
  error: string | null;
  result: unknown;
}): "finished" | "failed" | "vanished" {
  if (status.error) return "failed";
  if (status.finished && status.result) return "finished";
  // Neither a result nor an error: the backend restarted and the job is gone.
  return "vanished";
}
