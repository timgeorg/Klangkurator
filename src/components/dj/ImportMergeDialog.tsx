import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/** One resolvable conflict: local value vs imported, per field. */
export interface Conflict {
  song_id: string;
  song: string;
  field: string;
  local: unknown;
  imported: unknown;
}

export interface ImportSummary {
  matched: number;
  filled: number;
  added: number;
  conflicts: number;
  tags_to_create: number;
  skipped: Record<string, number>;
  skipped_invalid_songs?: string[];
  /** set by apply_import, absent on the preview */
  overwrites_applied?: number;
  tags_created?: number;
  joins_added?: number;
}

interface ImportMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  envelope: object;
  plan: { summary: ImportSummary; conflicts: Conflict[] };
  onImported: () => void;
}

const fmtValue = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "–";
  if (Array.isArray(v)) return v.length === 0 ? "–" : v.join(", ");
  if (typeof v === "number" && !Number.isInteger(v))
    return String(Number(v.toFixed(1)));
  return String(v);
};

/**
 * Import confirmation (issue #10): the merge plan as the preview returned it.
 * Every conflict defaults to NO-overwrite (local value wins, fail-safe) and
 * can be flipped per row; the "apply to all" checkbox flips them at once.
 */
export function ImportMergeDialog({
  open,
  onOpenChange,
  envelope,
  plan,
  onImported,
}: ImportMergeDialogProps) {
  const [overwrites, setOverwrites] = useState<Record<string, boolean>>({});
  const [applyAll, setApplyAll] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setOverwrites({});
      setApplyAll(false);
    }
  }, [open]);

  const setRow = (key: string, value: boolean) =>
    setOverwrites((prev) => ({ ...prev, [key]: value }));

  // Tim's decision (issue #10): a checkbox that applies one answer to every
  // conflict row at once.
  const flipAll = (value: boolean) => {
    setApplyAll(value);
    const next: Record<string, boolean> = {};
    for (const c of plan.conflicts) next[`${c.song_id}|${c.field}`] = value;
    setOverwrites(next);
  };

  const import_ = async () => {
    setBusy(true);
    try {
      const resolutions = plan.conflicts.map((c) => ({
        song_id: c.song_id,
        field: c.field,
        overwrite: overwrites[`${c.song_id}|${c.field}`] ?? false,
      }));
      const result = await api.post<{ valid: boolean; summary: ImportSummary }>(
        "/import",
        { envelope, resolutions },
      );
      const s = result.summary;
      toast({
        title: "Import complete",
        description: `${s.matched} matched · ${s.filled} filled · ${s.added} added · ${s.overwrites_applied ?? 0} overwrites applied${s.tags_created ? ` · ${s.tags_created} tags created` : ""}`,
      });
      onImported();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: "Import failed",
        description: e instanceof Error ? e.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const { summary, conflicts } = plan;
  const skippedEntries = Object.entries(summary.skipped || {});
  const skippedText = [
    ...skippedEntries.map(
      ([k, n]) => `${n} ${k.replace("song_relationships", "relationships")}`,
    ),
    ...(summary.skipped_invalid_songs?.length
      ? [`${summary.skipped_invalid_songs.length} invalid songs`]
      : []),
  ].join(", ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Import library merge</DialogTitle>
          <DialogDescription>
            {summary.matched} matched · {summary.filled} filled · {summary.added}{" "}
            added · {conflicts.length} conflicts
            {summary.tags_to_create > 0 && ` · ${summary.tags_to_create} new tags`}
            {skippedText && ` · skipped: ${skippedText}`}
          </DialogDescription>
        </DialogHeader>

        {conflicts.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
              <Checkbox
                id="apply-all"
                checked={applyAll}
                onCheckedChange={(v) => flipAll(v === true)}
              />
              <Label htmlFor="apply-all" className="text-sm">
                Apply to all conflicts ({conflicts.length})
              </Label>
            </div>
            <ul className="space-y-4">
              {conflicts.map((c) => {
                const key = `${c.song_id}|${c.field}`;
                return (
                  <li key={key} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{c.song}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.field}:{" "}
                          <span className="k-num">{fmtValue(c.local)}</span>
                          {" → "}
                          <span className="k-num">{fmtValue(c.imported)}</span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Label
                          htmlFor={`ov-${key}`}
                          className="text-xs text-muted-foreground"
                        >
                          Overwrite
                        </Label>
                        <Switch
                          id={`ov-${key}`}
                          checked={overwrites[key] ?? false}
                          onCheckedChange={(v) => setRow(key, v === true)}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="flex-1 py-2 text-sm text-muted-foreground">
            No conflicts — everything merges silently (fills only where a local
            value is missing). Confirm to apply.
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button onClick={import_} disabled={busy}>
            {busy ? "Importing…" : conflicts.length > 0 ? "Apply import" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}