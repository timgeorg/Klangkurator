import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Monitor, Moon, Pencil, Plus, Sun, Trash2, X } from "lucide-react";
import { useTheme } from "next-themes";

import { PageHeader } from "@/components/layout/PageHeader";
import { PageSection } from "@/components/layout/PageSection";
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
import { ColorChip } from "@/components/ui/color-chip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { SwatchPicker } from "@/components/ui/swatch-picker";
import { toast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api";
import { useCoverStyle } from "@/lib/appearance";
import { getGenreConfig, saveGenreConfig, type GenreConfig } from "@/lib/genreData";
import { ENTITY_COLORS } from "@/lib/palette";
import { usePlayer } from "@/lib/PlayerContext";
import { storage, type Tag } from "@/lib/storage";

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Editing =
  | { kind: "tag"; tag: Tag | null }
  | { kind: "genre"; genre: GenreConfig | null }
  | { kind: "subgenre"; main: string; sub: string | null };

type PendingDelete =
  | { kind: "tag"; tag: Tag; uses: number }
  | { kind: "genre"; genre: GenreConfig }
  | { kind: "subgenre"; main: string; sub: string };

export default function Settings() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagUses, setTagUses] = useState<Map<string, number>>(new Map());
  const [tagStatus, setTagStatus] = useState<"loading" | "ready" | "error">("loading");
  const [tagError, setTagError] = useState("");
  const [genres, setGenres] = useState<GenreConfig[]>(() => getGenreConfig());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Dialogs keep their subject while they animate closed.
  const [editing, setEditing] = useState<Editing | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [pending, setPending] = useState<PendingDelete | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const loadTags = useCallback(async () => {
    try {
      const [loadedTags, songTags] = await Promise.all([storage.getTags(), storage.getSongTags()]);
      const uses = new Map<string, number>();
      songTags.forEach((st) => uses.set(st.tag_id, (uses.get(st.tag_id) ?? 0) + 1));
      setTags([...loadedTags].sort((a, b) => collator.compare(a.name, b.name)));
      setTagUses(uses);
      setTagStatus("ready");
    } catch (error) {
      setTagError(describeApiError(error));
      setTagStatus("error");
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const updateGenres = (next: GenreConfig[]) => {
    saveGenreConfig(next);
    setGenres(next);
  };

  const edit = (next: Editing) => {
    setEditing(next);
    setEditOpen(true);
  };

  const askDelete = (next: PendingDelete) => {
    setPending(next);
    setConfirmOpen(true);
  };

  const toggleGenre = (name: string, open: boolean) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.add(name);
      else next.delete(name);
      return next;
    });

  /** Returns an error message for the form, or nothing when the save went through. */
  const save = async (target: Editing, name: string, color: string): Promise<string | void> => {
    if (target.kind === "tag") {
      const clash = tags.find((t) => t.id !== target.tag?.id && sameName(t.name, name));
      if (clash) return `The tag “${clash.name}” already exists.`;
      try {
        if (target.tag) await storage.updateTag(target.tag.id, { name, color });
        else await storage.addTag({ name, color });
        await loadTags();
      } catch (error) {
        return `The tag wasn't saved: ${describeApiError(error)}`;
      }
      return;
    }
    if (target.kind === "genre") {
      const clash = genres.find((g) => g.name !== target.genre?.name && sameName(g.name, name));
      if (clash) return `The genre “${clash.name}” already exists.`;
      if (target.genre) {
        const old = target.genre.name;
        updateGenres(genres.map((g) => (g.name === old ? { ...g, name, color } : g)));
        if (expanded.has(old)) {
          toggleGenre(old, false);
          toggleGenre(name, true);
        }
      } else {
        updateGenres([...genres, { name, color, subgenres: [] }]);
      }
      return;
    }
    const main = genres.find((g) => g.name === target.main);
    if (!main) return "That genre no longer exists.";
    const clash = main.subgenres.find((s) => s !== target.sub && sameName(s, name));
    if (clash) return `${target.main} already has “${clash}”.`;
    updateGenres(
      genres.map((g) =>
        g.name !== target.main
          ? g
          : { ...g, subgenres: target.sub ? g.subgenres.map((s) => (s === target.sub ? name : s)) : [...g.subgenres, name] },
      ),
    );
  };

  const confirmDelete = async () => {
    if (!pending) return;
    if (pending.kind === "tag") {
      try {
        await storage.deleteTag(pending.tag.id);
        await loadTags();
      } catch (error) {
        toast({ title: `“${pending.tag.name}” wasn't deleted`, description: describeApiError(error), variant: "destructive" });
      }
    } else if (pending.kind === "genre") {
      updateGenres(genres.filter((g) => g.name !== pending.genre.name));
    } else {
      updateGenres(
        genres.map((g) => (g.name === pending.main ? { ...g, subgenres: g.subgenres.filter((s) => s !== pending.sub) } : g)),
      );
    }
  };

  return (
    <div className="min-h-full">
      <PageHeader title="Settings" />

      <div className="max-w-5xl px-5 pb-20 md:px-8">
        <PageSection id="appearance" title="Appearance" description="How Klangkurator looks. Saved on this computer, for this app.">
          <AppearanceSettings />
        </PageSection>

        <PageSection
          id="tags"
          title="Tags"
          description="Labels for what you hear in a track: elements, vocals, moments. A track can have any number of tags."
          actions={
            <Button variant="outline" size="sm" onClick={() => edit({ kind: "tag", tag: null })}>
              <Plus />
              New tag
            </Button>
          }
        >
          {tagStatus === "loading" ? (
            <div role="status" aria-label="Loading tags" className="space-y-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-6 w-48" />
            </div>
          ) : tagStatus === "error" ? (
            <div role="alert" className="text-[13px]">
              <p className="text-destructive">Tags didn't load: {tagError}.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => loadTags()}>
                Try again
              </Button>
            </div>
          ) : tags.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No tags yet. Tags you create here can be added to any track.</p>
          ) : (
            <ul className="grid gap-x-10 border-t border-border sm:grid-cols-2">
              {tags.map((tag) => {
                const uses = tagUses.get(tag.id) ?? 0;
                return (
                  <li key={tag.id} className="flex h-11 min-w-0 items-center gap-3 border-b border-border">
                    <ColorChip size="md" color={tag.color} label={tag.name} />
                    <span className="k-num shrink-0 text-xs text-muted-foreground">{plural(uses, "track")}</span>
                    <span className="ml-auto flex shrink-0 items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => edit({ kind: "tag", tag })}
                        aria-label={`Edit tag ${tag.name}`}
                        title="Edit"
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => askDelete({ kind: "tag", tag, uses })}
                        aria-label={`Delete tag ${tag.name}`}
                        title="Delete"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 />
                      </Button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </PageSection>

        <PageSection
          id="genres"
          title="Genres"
          description="Each track has one main genre and any of its subgenres. The genre's color is the dot next to it in the library."
          actions={
            <Button variant="outline" size="sm" onClick={() => edit({ kind: "genre", genre: null })}>
              <Plus />
              New genre
            </Button>
          }
        >
          {genres.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">No genres yet.</p>
          ) : (
            <ul className="border-t border-border">
              {genres.map((genre) => {
                const open = expanded.has(genre.name);
                return (
                  <li key={genre.name} className="border-b border-border">
                    <Collapsible open={open} onOpenChange={(next) => toggleGenre(genre.name, next)}>
                      <div className="flex h-11 items-center gap-2">
                        <CollapsibleTrigger className="group -ml-1.5 flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-md pl-1.5 pr-2 text-left transition-colors duration-fast hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <ChevronRight
                            aria-hidden
                            className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-fast group-data-[state=open]:rotate-90"
                          />
                          <span
                            aria-hidden
                            className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                            style={{ backgroundColor: genre.color }}
                          />
                          <span className="truncate text-[13px] font-medium">{genre.name}</span>
                          <span className="k-num shrink-0 text-xs text-muted-foreground">
                            {plural(genre.subgenres.length, "subgenre")}
                          </span>
                        </CollapsibleTrigger>
                        <span className="flex shrink-0 items-center">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => edit({ kind: "genre", genre })}
                            aria-label={`Edit genre ${genre.name}`}
                            title="Edit"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => askDelete({ kind: "genre", genre })}
                            aria-label={`Delete genre ${genre.name}`}
                            title="Delete"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        </span>
                      </div>
                      <CollapsibleContent>
                        <ul aria-label={`${genre.name} subgenres`} className="flex flex-wrap items-center gap-1.5 pb-4 pl-[1.625rem]">
                          {genre.subgenres.map((sub) => (
                            <li key={sub}>
                              <SubgenreChip
                                name={sub}
                                color={genre.color}
                                onRename={() => edit({ kind: "subgenre", main: genre.name, sub })}
                                onDelete={() => askDelete({ kind: "subgenre", main: genre.name, sub })}
                              />
                            </li>
                          ))}
                          <li>
                            <button
                              type="button"
                              onClick={() => edit({ kind: "subgenre", main: genre.name, sub: null })}
                              className="inline-flex h-7 items-center gap-1 rounded-chip border border-dashed border-input px-2.5 text-xs text-muted-foreground transition-colors duration-fast hover:border-foreground/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <Plus className="h-3 w-3" />
                              Add subgenre
                            </button>
                          </li>
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                );
              })}
            </ul>
          )}
        </PageSection>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          {editing && (
            <EditForm
              key={editKey(editing)}
              target={editing}
              onCancel={() => setEditOpen(false)}
              onSave={async (name, color) => {
                const error = await save(editing, name, color);
                if (!error) setEditOpen(false);
                return error;
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          {pending && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{deleteTitle(pending)}</AlertDialogTitle>
                <AlertDialogDescription>{deleteBody(pending)}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmDelete} className={buttonVariants({ variant: "destructive" })}>
                  Delete {pending.kind}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  const [covers, setCovers] = useCoverStyle();
  const { dock, setDock } = usePlayer();
  const themeChoice = theme === "light" ? "paper" : theme === "system" ? "system" : "ink";

  return (
    <div className="divide-y divide-border">
      <SettingRow label="Theme" description="Ink is dark, paper is light; System follows your computer. The side rail stays ink.">
        <SegmentedControl
          label="Theme"
          value={themeChoice}
          onValueChange={(next) => setTheme(next === "paper" ? "light" : next === "system" ? "system" : "dark")}
          options={[
            { value: "ink", label: "Ink", icon: <Moon /> },
            { value: "paper", label: "Paper", icon: <Sun /> },
            { value: "system", label: "System", icon: <Monitor /> },
          ]}
        />
      </SettingRow>
      <SettingRow label="Covers" description="Cover art in black and white or in its original colors.">
        <SegmentedControl
          label="Covers"
          value={covers}
          onValueChange={setCovers}
          options={[
            { value: "editorial", label: "Black and white" },
            { value: "original", label: "Original colors" },
          ]}
        />
      </SettingRow>
      <SettingRow label="Player" description="Where the player sits while a track plays. Windows narrower than 1280 px always use the bar.">
        <SegmentedControl
          label="Player position"
          value={dock}
          onValueChange={setDock}
          options={[
            { value: "panel", label: "Side panel" },
            { value: "bar", label: "Bottom bar" },
          ]}
        />
      </SettingRow>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        {description && <p className="mt-0.5 max-w-[44ch] text-xs leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SubgenreChip({
  name,
  color,
  onRename,
  onDelete,
}: {
  name: string;
  color: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <span className="inline-flex h-7 items-stretch rounded-chip border border-border bg-background/40 text-xs">
      <button
        type="button"
        onClick={onRename}
        aria-label={`Rename subgenre ${name}`}
        title="Rename"
        className="inline-flex items-center gap-1.5 rounded-l-chip pl-2.5 pr-1.5 transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {name}
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete subgenre ${name}`}
        title="Delete"
        className="inline-flex w-6 items-center justify-center rounded-r-chip text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function editKey(target: Editing): string {
  if (target.kind === "tag") return `tag:${target.tag?.id ?? "new"}`;
  if (target.kind === "genre") return `genre:${target.genre?.name ?? "new"}`;
  return `sub:${target.main}:${target.sub ?? "new"}`;
}

function EditForm({
  target,
  onCancel,
  onSave,
}: {
  target: Editing;
  onCancel: () => void;
  onSave: (name: string, color: string) => Promise<string | void>;
}) {
  const initialName =
    target.kind === "tag" ? (target.tag?.name ?? "") : target.kind === "genre" ? (target.genre?.name ?? "") : (target.sub ?? "");
  const initialColor =
    target.kind === "tag"
      ? target.tag?.color
      : target.kind === "genre"
        ? target.genre?.color
        : undefined;
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(() => initialColor ?? ENTITY_COLORS[Math.floor(Math.random() * ENTITY_COLORS.length)].hex);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const isNew = target.kind === "tag" ? !target.tag : target.kind === "genre" ? !target.genre : !target.sub;
  const noun = target.kind;
  const hasColor = target.kind !== "subgenre";

  const copy = useMemo(() => {
    if (target.kind === "tag") {
      return {
        title: isNew ? "New tag" : "Edit tag",
        description: isNew ? "Name it for what you hear, e.g. Piano or Sing-along." : "The change shows on every track with this tag.",
      };
    }
    if (target.kind === "genre") {
      return {
        title: isNew ? "New genre" : "Edit genre",
        description: isNew
          ? "A main genre. Add its subgenres after saving."
          : `Renaming doesn't change tracks that already use “${target.genre?.name}”.`,
      };
    }
    return {
      title: isNew ? "New subgenre" : "Rename subgenre",
      description: isNew ? `A subgenre of ${target.main}.` : `Tracks that already use “${target.sub}” keep that name.`,
    };
  }, [target, isNew]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError(`Give the ${noun} a name.`);
      nameRef.current?.focus();
      return;
    }
    setSaving(true);
    const problem = await onSave(trimmed, color);
    setSaving(false);
    if (problem) {
      setError(problem);
      nameRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <Label htmlFor="entity-name">Name</Label>
        <Input
          id="entity-name"
          ref={nameRef}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError("");
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "entity-name-error" : undefined}
          autoComplete="off"
        />
        {error && (
          <p id="entity-name-error" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      {hasColor && (
        <div className="space-y-2.5">
          <Label id="entity-color">Color</Label>
          <SwatchPicker value={color} onChange={setColor} label={`${noun === "tag" ? "Tag" : "Genre"} color`} />
          <div className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
            Preview
            <ColorChip size="md" color={color} label={name.trim() || "Name"} />
          </div>
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isNew ? `Create ${noun}` : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function deleteTitle(pending: PendingDelete): string {
  if (pending.kind === "tag") return `Delete the tag “${pending.tag.name}”?`;
  if (pending.kind === "genre") return `Delete the genre “${pending.genre.name}”?`;
  return `Delete the subgenre “${pending.sub}”?`;
}

function deleteBody(pending: PendingDelete): string {
  if (pending.kind === "tag") {
    return pending.uses > 0 ? `It's removed from ${plural(pending.uses, "track")}.` : "No track uses it.";
  }
  if (pending.kind === "genre") {
    const subs = pending.genre.subgenres.length;
    return `${pending.genre.name}${subs ? ` and its ${plural(subs, "subgenre")}` : ""} leave the list. Tracks that use them keep the names until you change them.`;
  }
  return `It leaves the ${pending.main} list. Tracks that use it keep the name until you change them.`;
}
