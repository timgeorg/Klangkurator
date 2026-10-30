import { useState } from "react";
import { AlertTriangle, Layers, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api";
import { fileFacts, filesOf } from "@/lib/audioVariants";
import { storage, type Song } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface AudioFilesSectionProps {
  song: Song;
  /** The track changed on the server; the caller reads it again. */
  onChanged: (updated: Song) => void;
}

/**
 * The Files list of a track (issue #65, 18_AUDIO_VARIANTS).
 *
 * The primary is first and is marked. Every other file is a variant with two
 * actions: *Make primary* swaps the paths and keeps every other field, and
 * *Detach from track* takes the file off the track while it stays on disk. The
 * primary cannot be detached: there would be no track to play.
 *
 * The list is read-only for BPM, key, ratings, notes and tags on purpose — a
 * variant carries none of them, so there is nothing per file to edit.
 */
export function AudioFilesSection({ song, onChanged }: AudioFilesSectionProps) {
  const rows = filesOf(song);
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = async (key: string, action: () => Promise<Song>, done: string) => {
    setBusyId(key);
    try {
      const updated = await action();
      onChanged(updated);
      toast({ title: done, description: `“${updated.title}” has been updated.` });
    } catch (error) {
      toast({ title: "That did not work", description: describeApiError(error), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-3" aria-labelledby="files-heading">
      <div className="flex items-baseline gap-2">
        <h3 id="files-heading" className="text-[13px] font-semibold">
          Files
        </h3>
        <span className="k-num text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "file" : "files"}
        </span>
      </div>

      <ul className="divide-y divide-border border-y border-border" data-testid="files-list">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-3" data-primary={row.primary || undefined}>
            <div className="min-w-0 basis-full sm:basis-auto sm:flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                {row.primary ? (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-signal-soft px-1.5 py-px text-[11px] font-medium text-signal-text">
                    <Star className="h-3 w-3" aria-hidden /> Primary
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-px text-[11px] text-muted-foreground">
                    <Layers className="h-3 w-3" aria-hidden /> Variant
                  </span>
                )}
                {row.missing && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-warning">
                    <AlertTriangle className="h-3 w-3" aria-hidden /> Not on this machine
                  </span>
                )}
              </p>
              <p className="k-num mt-1 text-xs text-foreground/80">{fileFacts(row)}</p>
              <p
                className={cn("k-num mt-0.5 text-[11px] [overflow-wrap:anywhere]", row.missing ? "text-warning" : "text-muted-foreground")}
                title={row.file_path}
              >
                {row.file_path}
              </p>
            </div>

            {!row.primary && (
              <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId !== null || row.missing}
                  title={row.missing ? "Attach the file on this machine first" : "Play this file instead"}
                  onClick={() =>
                    run(row.id, () => storage.makeVariantPrimary(song.id, row.id), "Primary file changed")
                  }
                >
                  Make primary
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyId !== null}
                  title="Take this file off the track. The file stays on disk."
                  onClick={() =>
                    run(row.id, () => storage.detachVariant(song.id, row.id), "File detached")
                  }
                >
                  Detach from track
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        One track, one row. Detaching a file takes it off the track and leaves it on disk; the track keeps its
        BPM, key, ratings, notes and tags either way.
      </p>
    </section>
  );
}
