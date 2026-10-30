import { useEffect, useState } from "react";
import { Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api";
import { octaveApart } from "@/lib/audioVariants";
import { storage, Song, type BpmRange, type ReanalyzeResult } from "@/lib/storage";
import { BPM_RANGE, formatBpm, keyName } from "@/lib/trackFormat";

interface ReanalyzeDialogProps {
  song: Song | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A run finished; the table and this page should read the song again. */
  onSave: (updatedSong: Song) => void;
}

/** Both bounds must be numbers in BPM_RANGE and min must be below max — or neither. */
function readRange(low: string, high: string): BpmRange | null | string {
  const l = low.trim();
  const h = high.trim();
  if (!l && !h) return null;
  if (!l || !h) return "A BPM range needs both bounds. Leave both empty to re-analyze without one.";
  const min = Number(l.replace(",", "."));
  const max = Number(h.replace(",", "."));
  if (!Number.isFinite(min) || !Number.isFinite(max)) return "A BPM bound must be a number.";
  if (min < BPM_RANGE.min || min > BPM_RANGE.max || max < BPM_RANGE.min || max > BPM_RANGE.max) {
    return `BPM bounds go from ${BPM_RANGE.min} to ${BPM_RANGE.max}.`;
  }
  if (min >= max) return "The low bound must be below the high bound.";
  return { min, max };
}

const fieldText = (song: Song, field: "bpm" | "musical_key") =>
  field === "bpm" ? formatBpm(song.bpm) : song.musical_key ? `${song.musical_key} · ${keyName(song.musical_key)}` : "–";

/**
 * The primary's tempo beside a variant's own reading, when they disagree.
 *
 * Issue #65 (AC-13, AC-14): the ticket's fault was one recording read 132.0 from
 * its `.wav` and 66.3 from its `.mp3`. Averages hide that; the app shows both
 * numbers and offers the double/halve repair as a BPM range, which the user then
 * runs — it never picks a value itself.
 */
function OctaveReport({ song, result }: { song: Song; result: ReanalyzeResult | null }) {
  const primary = result?.primary_bpm ?? song.bpm ?? null;
  const variant = result?.variant_bpm ?? song.audio_variants?.find((v) => v.bpm_reading && v.bpm_reading !== song.bpm)?.bpm_reading ?? null;
  const apart = result?.octave_disagreement ?? octaveApart(primary, variant);
  if (!apart || !primary || !variant) return null;
  return (
    <div className="space-y-1 rounded-md border border-warning/50 bg-warning/5 px-4 py-3 text-[13px]" role="status">
      <p className="text-warning">
        A file of this track reads a different tempo:
      </p>
      <p>
        primary <span className="k-num">{formatBpm(primary)}</span> / variant{" "}
        <span className="k-num">{formatBpm(variant)}</span>
      </p>
      <p className="text-muted-foreground">
        One octave apart — the same music, one metrical level off. The stored BPM is the primary's and is
        unchanged. To repair it, re-analyze within{" "}
        <span className="k-num">
          {formatBpm(Math.round(primary * 0.9))}–{formatBpm(Math.round(primary * 1.1))}
        </span>{" "}
        and compare before and after; nothing is picked for you.
      </p>
    </div>
  );
}

/**
 * Re-analyze one track's BPM and key (issue #6, PF-79).
 *
 * Unlike the library-wide job this runs on a track that already has values — it
 * is the repair path for a wrong BPM. The optional BPM range is a hint: it
 * biases the detector toward the window. When the result cannot sit inside the
 * range, the stored BPM is kept and this dialog says so; nothing is overwritten
 * silently. Key is re-detected in the same run, range or not.
 *
 * There is no Cancel: the write lands on a successful run, so offering to undo
 * it would be a lie. Close it is.
 */
export function ReanalyzeDialog({ song, open, onOpenChange, onSave }: ReanalyzeDialogProps) {
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReanalyzeResult | null>(null);
  // The stored values at the moment the run started. `song` refreshes after a
  // run (onSave), so without this the "before" half of before → after is lost.
  const [before, setBefore] = useState<{ bpm?: number; musical_key?: string } | null>(null);

  // A fresh open starts clean; the stored values are read live from `song`.
  useEffect(() => {
    if (open) {
      setLow("");
      setHigh("");
      setError(null);
      setResult(null);
      setBefore(null);
      setRunning(false);
    }
  }, [open]);

  if (!song) return null;

  const handleRun = async () => {
    const range = readRange(low, high);
    if (typeof range === "string") {
      setError(range);
      return;
    }
    setError(null);
    setBefore({ bpm: song.bpm, musical_key: song.musical_key });
    setRunning(true);
    try {
      const res = await storage.reanalyzeSong(song.id, range ?? undefined);
      setResult(res);
      const updated = await storage.getSong(song.id);
      if (updated) onSave(updated);
      if (res.bpm === null) {
        toast({
          variant: "destructive",
          title: "Nothing detected",
          description: `The tempo could not be read from “${song.title}”. Its stored BPM is unchanged.`,
        });
      } else if (res.bpm_fit) {
        toast({
          title: "Re-analyzed",
          description: `“${song.title}” now reads ${formatBpm(res.bpm)} BPM, ${res.musical_key || "no key"}.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Stored BPM kept",
          description:
            `The detector read ${formatBpm(res.bpm)} BPM, outside the range you gave — “${song.title}” keeps its stored BPM.` +
            (res.applied.musical_key !== undefined ? ` Its key was re-detected to ${res.musical_key || "none"}.` : ""),
        });
      }
    } catch (e) {
      setError(describeApiError(e));
    } finally {
      setRunning(false);
    }
  };

  // `result.applied` is the truth about what was written, independent of the
  // parent refreshing `song` after onSave.
  const wrote = result ? result.applied.bpm !== undefined || result.applied.musical_key !== undefined : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Re-analyze BPM and key</DialogTitle>
          <DialogDescription className="truncate">
            {song.title} — {song.artist}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-4 rounded-md border border-border px-4 py-3">
          <div className="min-w-0">
            <dt className="k-label text-muted-foreground">BPM now</dt>
            <dd className="k-num mt-1 text-[15px]">{formatBpm(song.bpm)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="k-label text-muted-foreground">Key now</dt>
            <dd className="k-num mt-1 truncate text-[15px]" title={song.musical_key || undefined}>
              {fieldText(song, "musical_key")}
            </dd>
          </div>
        </dl>

        <div className="space-y-2">
          <Label htmlFor="bpm-low">BPM range (optional)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="bpm-low"
              inputMode="decimal"
              className="k-num"
              placeholder={String(BPM_RANGE.min)}
              value={low}
              onChange={(e) => setLow(e.target.value)}
              aria-label="Lowest expected BPM"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              id="bpm-high"
              inputMode="decimal"
              className="k-num"
              placeholder={String(BPM_RANGE.max)}
              value={high}
              onChange={(e) => setHigh(e.target.value)}
              aria-label="Highest expected BPM"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            A hint for a first pass that read the tempo wrong — for example 165 to 185 for a 174 track
            detected as 117. It steers the detector; it cannot force a value the audio does not support.
          </p>
        </div>

        <OctaveReport song={song} result={result} />

        {result && (
          <div className={result.bpm === null || !result.bpm_fit ? "text-[13px] text-warning" : "text-[13px]"} role="status">
            {result.bpm === null ? (
              <>
                The tempo could not be detected in this file. Nothing was changed
                {result.musical_key ? ` except the key (${result.musical_key})` : ""}.
              </>
            ) : result.bpm_fit ? (
              <>
                BPM <span className="k-num">{formatBpm(before?.bpm)}</span> →{" "}
                <span className="k-num">{formatBpm(result.bpm)}</span>, key{" "}
                <span className="k-num">{before?.musical_key || "–"}</span> →{" "}
                <span className="k-num">{result.musical_key || "–"}</span>
                {wrote ? " — saved." : " — the stored values were already correct."}
              </>
            ) : (
              <>
                Detected <span className="k-num">{formatBpm(result.bpm)}</span> BPM, outside the range you gave.
                The stored BPM is unchanged (<span className="k-num">{formatBpm(before?.bpm)}</span>).
                {result.applied.musical_key !== undefined && (
                  <> The key was re-detected: <span className="k-num">{before?.musical_key || "–"}</span> →{" "}
                  <span className="k-num">{result.musical_key || "–"}</span>.</>
                )}
              </>
            )}
          </div>
        )}

        {error && (
          <p className="text-[13px] text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Close
          </Button>
          <Button onClick={handleRun} disabled={running} aria-busy={running}>
            <Wand2 />
            {running ? "Analyzing…" : "Re-analyze"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
