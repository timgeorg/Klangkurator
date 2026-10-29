import { useEffect, useState, type ReactNode } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { loadSettings } from "@/lib/settings";

/**
 * Hold the app until the settings and genres documents have loaded (issue #51).
 *
 * Both are small local reads, so the wait is a frame or two; the skeleton is
 * there for the case where the backend is slow, and it keeps the first paint
 * from showing default columns or the wrong theme and then jumping.
 */
export function SettingsGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSettings()
      .then(() => alive && setReady(true))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  if (ready) return <>{children}</>;
  if (failed) {
    // The app is usable without its preferences; saying so beats a dead screen.
    return (
      <div role="alert" className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-md text-[13px] text-muted-foreground">
          Klangkurator could not read its settings. Is the app running (<code className="k-num">./run.sh status</code>)?
        </p>
      </div>
    );
  }
  return (
    <div aria-busy="true" aria-label="Loading your settings" className="min-h-screen space-y-4 p-8">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
