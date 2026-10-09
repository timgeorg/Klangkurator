import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/layout/EmptyState";
import { PageHeader, SectionHeader } from "@/components/layout/PageHeader";
import { BlockCard } from "@/components/sets/BlockCard";
import { BlockEditor } from "@/components/sets/BlockEditor";
import { SetCard } from "@/components/sets/SetCard";
import { SetEditor } from "@/components/sets/SetEditor";
import { blockTracks, byPosition, indexById, itemRef, plural, resolveItem } from "@/components/sets/setModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { type Block, type DJSet, type Song, storage } from "@/lib/storage";

interface PendingDelete {
  kind: "set" | "block";
  id: string;
  name: string;
  /** Sets that use the block. */
  usedIn: number;
}

export default function Sets() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [sets, setSets] = useState<DJSet[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState("");

  // Editors and the delete confirmation keep their subject while they animate closed.
  const [setEditor, setSetEditor] = useState<{ open: boolean; set: DJSet | null }>({ open: false, set: null });
  const [blockEditor, setBlockEditor] = useState<{ open: boolean; block: Block | null }>({ open: false, block: null });
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [loadedSongs, loadedBlocks, loadedSets] = await Promise.all([
        storage.getSongs(),
        storage.getBlocks(),
        storage.getSets(),
      ]);
      setSongs(loadedSongs);
      setBlocks(loadedBlocks);
      setSets(loadedSets);
      setStatus("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "unknown error");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const songIndex = useMemo(() => indexById(songs), [songs]);
  const blockIndex = useMemo(() => indexById(blocks), [blocks]);

  const blockUsage = useMemo(() => {
    const usage = new Map<string, number>();
    for (const set of sets) {
      const ids = new Set(set.items.filter((item) => item.type === "block").map(itemRef));
      ids.forEach((id) => usage.set(id, (usage.get(id) ?? 0) + 1));
    }
    return usage;
  }, [sets]);

  const askDelete = (next: PendingDelete) => {
    setPending(next);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!pending) return;
    try {
      if (pending.kind === "set") await storage.deleteSet(pending.id);
      else await storage.deleteBlock(pending.id);
      await load();
    } catch (error) {
      toast({
        title: `“${pending.name}” wasn't deleted`,
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
  };

  const newSet = () => setSetEditor({ open: true, set: null });
  const newBlock = () => setBlockEditor({ open: true, block: null });

  const ready = status === "ready";
  const nothingYet = ready && sets.length === 0 && blocks.length === 0;

  return (
    <div className="min-h-full">
      <PageHeader
        title="Sets"
        meta={ready ? `${plural(sets.length, "set")} · ${plural(blocks.length, "block")}` : undefined}
        actions={
          <Button onClick={newSet} disabled={status !== "ready"}>
            <Plus />
            New set
          </Button>
        }
      />

      {status === "error" ? (
        <EmptyState
          title="Sets didn't load."
          body={`Klangkurator couldn't reach its backend: ${loadError}. Check that the app is running (./run.sh status), then try again.`}
          action={<Button onClick={() => load()}>Try again</Button>}
          arrangement="split"
        />
      ) : status === "loading" ? (
        <div className="max-w-6xl px-5 md:px-8">
          <SetsSkeleton />
        </div>
      ) : nothingYet ? (
        <EmptyState
          title="No sets yet."
          body="A set is the running order for a night: tracks and blocks in the order you plan to play them. A block is two or more tracks that mix well, saved so you can reuse the run in any set."
          action={
            <>
              <Button onClick={newSet}>
                <Plus />
                New set
              </Button>
              <Button variant="outline" onClick={newBlock}>
                <Plus />
                New block
              </Button>
            </>
          }
          arrangement="stack"
        />
      ) : (
        <div className="max-w-6xl px-5 pb-20 md:px-8">
          <section aria-label="Sets" className="[container-type:inline-size]">
            {sets.length === 0 ? (
              <EmptyState
                size="inline"
                arrangement="orbit"
                title="No sets yet."
                body="Arrange tracks and blocks into the running order for a night."
                action={
                  <Button size="sm" onClick={newSet}>
                    <Plus />
                    New set
                  </Button>
                }
                className="mt-8"
              />
            ) : (
              <div className="divide-y divide-border">
                {sets.map((set) => (
                  <SetCard
                    key={set.id}
                    set={set}
                    items={byPosition(set.items).map((item) => resolveItem(item, songIndex, blockIndex))}
                    onOpen={() => setSetEditor({ open: true, set })}
                    onDelete={() => askDelete({ kind: "set", id: set.id, name: set.name, usedIn: 0 })}
                  />
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="blocks-heading" className="mt-6 border-t border-border pt-10 [container-type:inline-size]">
            <SectionHeader
              title={<span id="blocks-heading">Blocks</span>}
              count={blocks.length}
              actions={
                <Button variant="outline" size="sm" onClick={newBlock}>
                  <Plus />
                  New block
                </Button>
              }
            />
            <p className="mt-1.5 max-w-[60ch] text-[13px] text-muted-foreground">
              Runs of two or more tracks that mix well. Add a block to any set as one item.
            </p>
            {blocks.length === 0 ? (
              <EmptyState
                size="inline"
                arrangement="split"
                title="No blocks yet."
                body="Save a run of tracks that mix well, then drop it into any set."
                action={
                  <Button size="sm" variant="outline" onClick={newBlock}>
                    <Plus />
                    New block
                  </Button>
                }
                className="mt-6"
              />
            ) : (
              <div className="mt-4 divide-y divide-border border-t border-border">
                {blocks.map((block) => (
                  <BlockCard
                    key={block.id}
                    block={block}
                    tracks={blockTracks(block, songIndex)}
                    usedIn={blockUsage.get(block.id) ?? 0}
                    onOpen={() => setBlockEditor({ open: true, block })}
                    onDelete={() =>
                      askDelete({ kind: "block", id: block.id, name: block.name, usedIn: blockUsage.get(block.id) ?? 0 })
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <SetEditor
        djSet={setEditor.set}
        open={setEditor.open}
        onOpenChange={(open) => setSetEditor((prev) => ({ ...prev, open }))}
        onSave={load}
        songs={songs}
        blocks={blocks}
      />
      <BlockEditor
        block={blockEditor.block}
        open={blockEditor.open}
        onOpenChange={(open) => setBlockEditor((prev) => ({ ...prev, open }))}
        onSave={load}
        songs={songs}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pending?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "set"
                ? "The set and its running order are removed. Its tracks and blocks stay in your library."
                : pending && pending.usedIn > 0
                  ? `The block is used in ${plural(pending.usedIn, "set")}. Those sets keep its slot, marked as deleted, until you remove it. The tracks stay in your library.`
                  : "The block is removed. Its tracks stay in your library."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>
              Delete {pending?.kind ?? ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SetsSkeleton() {
  return (
    <div role="status" aria-label="Loading sets" className="divide-y divide-border">
      {[0, 1].map((i) => (
        <div key={i} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 py-7 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-8">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-3 pt-1">
            <Skeleton className="h-7 w-2/3 max-w-sm" />
            <Skeleton className="h-4 w-1/2 max-w-xs" />
            <Skeleton className="h-3 w-1/3 max-w-[10rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}
