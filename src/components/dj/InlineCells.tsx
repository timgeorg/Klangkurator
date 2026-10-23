import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Check, Plus, Star } from "lucide-react";

import { ColorChip } from "@/components/ui/color-chip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { addSubgenre, getGenreConfig, getMainGenreColor, getSubgenresForMainGenre } from "@/lib/genreData";
import type { Song, SongPatch } from "@/lib/storage";
import { isMinorKey, keyName, MUSICAL_KEYS, trackGenre } from "@/lib/trackFormat";
import { cn } from "@/lib/utils";

/** Saves a change to a track at once (optimistic, see SongLibrary). */
export type PatchSong = (songId: string, patch: SongPatch) => void;

/**
 * A value in the table as a button. Hover lays the inline-edit fill behind
 * the whole cell and focus shows the ring; the negative margin keeps the text
 * aligned with the column's header while the fill reaches a little past it.
 */
export const CellButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { align?: "start" | "end" }
>(({ align = "start", className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "-mx-1.5 flex h-7 min-w-0 flex-1 items-center rounded-sm px-1.5 transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent",
      align === "end" ? "justify-end text-right" : "text-left",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
CellButton.displayName = "CellButton";

export function Dash() {
  return <span className="text-muted-foreground">–</span>;
}

// ── Text values: artist, album, BPM, notes ─────────────────

type Parsed = { value: string } | { error: string };
const trimmed = (draft: string): Parsed => ({ value: draft.trim() });

interface TextCellProps {
  /** "Artist": names the field in labels and messages. */
  field: string;
  /** The track's title, for the accessible names. */
  track: string;
  /** The stored value as text, "" when empty. */
  value: string;
  /** What the cell shows at rest. */
  children: React.ReactNode;
  /** Tooltip for the resting value (the full text where the cell truncates). */
  title?: string;
  placeholder?: string;
  /** Notes: a text area where Shift+Enter starts a new line. */
  multiline?: boolean;
  align?: "start" | "end";
  inputMode?: "text" | "decimal";
  /** Extra classes for the resting button and the field (width caps, type). */
  className?: string;
  /** Turns the typed text into the value to save, or says why it can't be saved. */
  parse?: (draft: string) => Parsed;
  /** Called with the new value, only when it differs from the stored one. */
  onCommit: (value: string) => void;
}

/**
 * A text value edited in place: a click (or Enter) swaps it for a field
 * holding the value. Enter or leaving the field saves, Escape restores the old
 * value. Enter on an invalid value keeps the field open and says why; leaving
 * it restores the old value and says why in a toast.
 */
export function TextCell({
  field,
  track,
  value,
  children,
  title,
  placeholder,
  multiline,
  align = "start",
  inputMode,
  className,
  parse = trimmed,
  onCommit,
}: TextCellProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  // An editing session ends once: by Enter, Escape or blur, never twice.
  const session = useRef(false);
  const refocus = useRef(false);
  const editing = draft !== null;

  // Notes open with the caret at the end; short values open selected, ready to retype.
  useLayoutEffect(() => {
    const el = fieldRef.current;
    if (!editing || !el) return;
    el.focus();
    if (multiline) el.setSelectionRange(el.value.length, el.value.length);
    else el.select();
  }, [editing, multiline]);

  // After Enter or Escape, keyboard focus is back on the value.
  useEffect(() => {
    if (editing || !refocus.current) return;
    refocus.current = false;
    buttonRef.current?.focus();
  }, [editing]);

  const start = () => {
    session.current = true;
    setError(null);
    setDraft(value);
  };

  const finish = (focusCell: boolean) => {
    session.current = false;
    refocus.current = focusCell;
    setError(null);
    setDraft(null);
  };

  const commit = (byEnter: boolean) => {
    if (!session.current || draft === null) return;
    if (draft === value) {
      finish(byEnter);
      return;
    }
    const next = parse(draft);
    if ("error" in next) {
      if (byEnter) {
        setError(next.error);
        return;
      }
      toast({ title: `${field} not changed`, description: next.error });
      finish(false);
      return;
    }
    // Compared in the same form, so "127,5" over a stored 127.5 writes nothing.
    const before = parse(value);
    if (next.value !== ("value" in before ? before.value : value)) onCommit(next.value);
    finish(byEnter);
  };

  if (!editing) {
    return (
      <CellButton
        ref={buttonRef}
        align={align}
        onClick={start}
        aria-label={`${field} for ${track}: ${value || "none"}`}
        title={title}
        className={className}
      >
        {children}
      </CellButton>
    );
  }

  const fieldProps = {
    value: draft,
    placeholder,
    "aria-label": `${field} for ${track}`,
    "aria-invalid": error ? true : undefined,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setDraft(e.target.value);
      setError(null);
    },
    onBlur: () => commit(false),
    onKeyDown: (e: React.KeyboardEvent) => {
      // The Enter that confirms an IME composition (Japanese, Chinese) isn't a commit.
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Escape") {
        e.preventDefault();
        finish(true);
      } else if (e.key === "Enter" && !(multiline && e.shiftKey)) {
        e.preventDefault();
        commit(true);
      }
    },
    className: cn(
      "-mx-1.5 h-7 min-w-0 flex-1 rounded-sm border bg-background px-[5px] text-foreground outline-none ring-1 placeholder:text-muted-foreground",
      error ? "border-destructive ring-destructive" : "border-ring ring-ring",
      align === "end" && "text-right",
      className,
    ),
  };

  return (
    <>
      <Tooltip open={error !== null}>
        <TooltipTrigger asChild>
          {multiline ? (
            <textarea
              ref={(el) => (fieldRef.current = el)}
              rows={1}
              {...fieldProps}
              className={cn(fieldProps.className, "resize-none overflow-hidden py-1 leading-tight")}
            />
          ) : (
            <input
              ref={(el) => (fieldRef.current = el)}
              inputMode={inputMode}
              spellCheck={false}
              autoComplete="off"
              {...fieldProps}
            />
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom" align={align === "end" ? "end" : "start"} collisionPadding={8}>
          {error}
        </TooltipContent>
      </Tooltip>
      <span role="alert" className="sr-only">
        {error ?? ""}
      </span>
    </>
  );
}

// ── One value from a list: genre, key ──────────────────────

/**
 * cmdk highlights its first row when it has no value, which reads as "this
 * one". A value that matches no row keeps every row plain until the user
 * types or moves.
 */
const NO_ROW = "\u0000";

/** Scrolls the highlighted row to the middle of its list, not just inside it. */
function centreHighlighted(event: Event) {
  const list = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[cmdk-list]");
  requestAnimationFrame(() => {
    const row = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !row) return;
    const offset = row.getBoundingClientRect().top - list.getBoundingClientRect().top;
    list.scrollTop += offset - (list.clientHeight - row.offsetHeight) / 2;
  });
}

interface Choice {
  value: string;
  /** What the search matches (name, short and long forms). */
  search: string;
  label: React.ReactNode;
  /** The user's colour for the entry (genres). */
  color?: string;
}

interface ChoiceCellProps {
  field: string;
  track: string;
  current: string | undefined;
  /** The entries, built when the list opens. */
  choices: () => Choice[];
  placeholder: string;
  noneLabel: string;
  onChoose: (value: string | null) => void;
  children: React.ReactNode;
}

/**
 * One value from a list: a click opens it with a search field and the current
 * value checked and highlighted. A choice saves and closes the list; the last
 * entry ("No genre") clears the value.
 */
function ChoiceCell({ field, track, current, choices, placeholder, noneLabel, onChoose, children }: ChoiceCellProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const all = open ? choices() : [];
  const shown = q ? all.filter((choice) => choice.search.toLowerCase().includes(q)) : all;

  const choose = (value: string | null) => {
    setOpen(false);
    if (value !== (current ?? null)) onChoose(value);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <CellButton aria-label={`${field} for ${track}: ${current ?? "none"}`}>{children}</CellButton>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="w-60 p-0" onOpenAutoFocus={centreHighlighted}>
        <Command shouldFilter={false} defaultValue={current ?? NO_ROW}>
          <CommandInput placeholder={placeholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>Nothing matches “{search.trim()}”.</CommandEmpty>
            {shown.length > 0 && (
              <CommandGroup>
                {shown.map((choice) => (
                  <CommandItem
                    key={choice.value}
                    value={choice.value}
                    onSelect={() => choose(choice.value)}
                    className={choice.color ? undefined : "pl-3"}
                  >
                    {choice.color && (
                      <span
                        aria-hidden
                        className="mr-2 h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                        style={{ backgroundColor: choice.color }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{choice.label}</span>
                    {choice.value === current && (
                      <>
                        <Check aria-hidden className="ml-2 h-3.5 w-3.5 shrink-0 text-signal-text" />
                        <span className="sr-only"> (current)</span>
                      </>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {current && !q && (
              <CommandGroup className="border-t border-border">
                <CommandItem value={`none:${field}`} onSelect={() => choose(null)} className="pl-3 text-muted-foreground">
                  {noneLabel}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** The genre, chosen from Settings' genres. Subgenres stay when it changes (see 12_TAGS_AND_GENRES). */
export function GenreCell({ song, onPatch }: { song: Song; onPatch: PatchSong }) {
  const genre = trackGenre(song);
  return (
    <ChoiceCell
      field="Genre"
      track={song.title}
      current={genre}
      choices={() => {
        const genres = getGenreConfig();
        // A genre read from the file's tags may not be in Settings' list; it stays on top.
        const list =
          genre && !genres.some((g) => g.name === genre)
            ? [{ name: genre, color: getMainGenreColor(genre) }, ...genres]
            : genres;
        return list.map((g) => ({ value: g.name, search: g.name, label: g.name, color: g.color }));
      }}
      placeholder="Find a genre"
      noneLabel="No genre"
      onChoose={(name) => {
        // The legacy fields follow the main genre, as in the edit dialog.
        const subgenres = song.subgenres ?? [];
        onPatch(
          song.id,
          name
            ? { mainGenre: name, genre: name, genres: [name, ...subgenres] }
            : { mainGenre: null, genre: null, genres: null },
        );
      }}
    >
      {genre ? <ColorChip color={getMainGenreColor(genre)} label={genre} /> : <Dash />}
    </ChoiceCell>
  );
}

/** The key, in the analyser's notation with its full name; a key in another notation stays on top. */
export function KeyCell({ song, onPatch }: { song: Song; onPatch: PatchSong }) {
  const key = song.musical_key;
  return (
    <ChoiceCell
      field="Key"
      track={song.title}
      current={key}
      choices={() =>
        (key && !MUSICAL_KEYS.includes(key) ? [key, ...MUSICAL_KEYS] : MUSICAL_KEYS).map((k) => ({
          value: k,
          search: `${k} ${keyName(k)}`,
          label: (
            <>
              <span className="k-num">{k}</span>
              {keyName(k) !== k && <span className="text-muted-foreground"> · {keyName(k)}</span>}
            </>
          ),
        }))
      }
      placeholder="Find a key"
      noneLabel="No key"
      onChoose={(k) => onPatch(song.id, { musical_key: k })}
    >
      {key ? (
        <span className={cn("k-num text-xs", isMinorKey(key) ? "text-info" : "text-foreground")} title={keyName(key)}>
          {key.replace(" major", "").replace(" minor", "m")}
        </span>
      ) : (
        <span className="k-num text-xs text-muted-foreground">–</span>
      )}
    </ChoiceCell>
  );
}

// ── Subgenres: several values from the genre's list ────────

/**
 * The track's subgenres as a checklist: its own first, then the genre's
 * other subgenres. Each choice saves at once and the list stays open, its
 * entries in place, until Escape or a click outside. A new name is created
 * in the genre's list too.
 */
export function SubgenresCell({ song, onPatch }: { song: Song; onPatch: PatchSong }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<string[]>([]);
  const genre = trackGenre(song);
  const subgenres = song.subgenres ?? [];
  const color = genre ? getMainGenreColor(genre) : undefined;

  const onOpenChange = (next: boolean) => {
    if (next) {
      // The order is fixed when the list opens, so nothing moves under the pointer.
      const known = genre ? getSubgenresForMainGenre(genre) : [];
      setOrder([...subgenres, ...known.filter((s) => !subgenres.includes(s))]);
    }
    setSearch("");
    setOpen(next);
  };

  // A genre read from the file's tags becomes the main genre, shown as before.
  const save = (next: string[]) =>
    onPatch(song.id, genre ? { subgenres: next, mainGenre: genre, genre, genres: [genre, ...next] } : { subgenres: next });

  const toggle = (name: string) => {
    save(subgenres.includes(name) ? subgenres.filter((s) => s !== name) : [...subgenres, name]);
    setSearch("");
  };

  const q = search.trim();
  const shown = order.filter((s) => s.toLowerCase().includes(q.toLowerCase()));
  const canCreate = !!genre && !!q && !order.some((s) => s.toLowerCase() === q.toLowerCase());
  // A genre read from the file's tags that Settings doesn't list has no subgenre list to add to.
  const listed = !!genre && getGenreConfig().some((g) => g.name === genre);

  const create = () => {
    if (!genre || !q) return;
    addSubgenre(genre, q);
    setOrder((prev) => [...prev, q]);
    save([...subgenres, q]);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <CellButton aria-label={`Subgenres for ${song.title}: ${subgenres.join(", ") || "none"}`} title={subgenres.join(", ") || undefined}>
          {subgenres.length > 0 ? (
            <span className="truncate text-muted-foreground">
              {subgenres.slice(0, 3).join(" · ")}
              {subgenres.length > 3 && <span className="k-num text-[11px]"> +{subgenres.length - 3}</span>}
            </span>
          ) : (
            <Dash />
          )}
        </CellButton>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={8} className="w-64 p-0">
        {/* Filtered here, not by cmdk, so the order stays fixed and Create comes last. */}
        <Command shouldFilter={false} defaultValue={subgenres[0] ?? NO_ROW}>
          <CommandInput placeholder={genre ? `${genre} subgenres` : "Subgenres"} value={search} onValueChange={setSearch} />
          <CommandList>
            {!genre && (
              <p className="px-3 pb-1 pt-3 text-xs text-muted-foreground">
                Set a genre first to choose from its subgenres.
              </p>
            )}
            {genre && (
              <CommandEmpty>{q ? "No subgenre matches." : `${genre} has no subgenres yet. Type a name to create one.`}</CommandEmpty>
            )}
            {shown.length > 0 && (
              <CommandGroup heading={genre ?? "On this track"}>
                {shown.map((name) => {
                  const on = subgenres.includes(name);
                  return (
                    <CommandItem key={name} value={name} onSelect={() => toggle(name)}>
                      <span
                        aria-hidden
                        className="mr-2 h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
                        style={{ backgroundColor: color ?? "hsl(var(--muted-foreground))" }}
                      />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <Check aria-hidden className={cn("ml-2 h-3.5 w-3.5 shrink-0 text-signal-text", !on && "invisible")} />
                      <span className="sr-only">{on ? " (on this track)" : ""}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
            {canCreate && (
              <CommandGroup heading="New">
                <CommandItem value={`create:${q}`} onSelect={create}>
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  {listed ? `Create “${q}”` : `Add “${q}” to this track`}
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Ratings: energy, people (bars), rank (stars) ──────────

const STEPS = [1, 2, 3, 4, 5];
const oneDecimal = (n: number) => Math.round(n * 10) / 10;

interface RatingCellProps {
  field: string;
  track: string;
  value: number;
  onChange: (value: number) => void;
  /** Rank: five stars instead of the rising bars. */
  stars?: boolean;
  /** What 0 reads as: "Unrated", "Unranked". */
  emptyText?: string;
}

/**
 * A 0–5 rating as five marks that set it directly. Mouse: hovering previews,
 * a click on a mark sets that whole value, a click on the current one clears
 * it. Keyboard: a slider (arrows ±1, Home, End, 0–5; Enter opens the picker).
 * Touch: a tap opens a picker of 44px targets, since a mark is too narrow for
 * a finger. A decimal from the edit dialog (3.8) shows as its whole marks (3),
 * exact in the tooltip and to screen readers; arrows keep its decimal.
 */
export function RatingCell({ field, track, value, onChange, stars, emptyText = "Unrated" }: RatingCellProps) {
  const v = Math.max(0, Math.min(5, oneDecimal(value || 0)));
  const [hover, setHover] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pointer = useRef("mouse");

  const set = (next: number) => {
    const rating = Math.max(0, Math.min(5, oneDecimal(next)));
    if (rating !== v) onChange(rating);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = v + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = v - 1;
    else if (e.key === "Home" || e.key === "Backspace" || e.key === "Delete") next = 0;
    else if (e.key === "End") next = 5;
    else if (/^[0-5]$/.test(e.key)) next = Number(e.key);
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setPicking(true);
      return;
    }
    if (next === null) return;
    // Arrow keys would otherwise scroll the table.
    e.preventDefault();
    set(next);
  };

  const shown = hover ?? Math.floor(v);
  const clearing = hover !== null && hover === v;
  const valueText = v ? `${v} of 5` : emptyText;

  return (
    <Popover open={picking} onOpenChange={setPicking}>
      <PopoverAnchor asChild>
        <div
          ref={meterRef}
          role="slider"
          tabIndex={0}
          aria-label={`${field} for ${track}`}
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={v}
          aria-valuetext={valueText}
          title={`${field}: ${valueText.toLowerCase()}`}
          onKeyDown={onKeyDown}
          onPointerDown={(e) => {
            pointer.current = e.pointerType;
          }}
          onPointerLeave={() => setHover(null)}
          className="-mx-1.5 flex h-8 cursor-pointer items-stretch rounded-sm px-1.5 transition-colors duration-fast hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STEPS.map((step) => (
            <span
              key={step}
              aria-hidden
              onPointerEnter={(e) => {
                if (e.pointerType !== "touch") setHover(step);
              }}
              onClick={() => {
                if (pointer.current === "touch") {
                  setPicking(true);
                  return;
                }
                set(step === v ? 0 : step);
                // The bar under the pointer now shows the saved value, not a preview of clearing it.
                setHover(null);
              }}
              className={cn("flex justify-center", stars ? "w-[15px] items-center" : "w-2 items-end pb-[9px]")}
            >
              {stars ? (
                <Star
                  strokeWidth={step > shown ? 1.5 : 0}
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-fast",
                    step > shown
                      ? "text-foreground/15"
                      : cn(
                          "fill-current",
                          hover === null ? "text-foreground/80" : clearing ? "text-foreground/35" : "text-foreground",
                        ),
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "w-[3px] rounded-[1px] transition-colors duration-fast",
                    step > shown
                      ? "bg-foreground/15"
                      : hover === null
                        ? "bg-foreground/80"
                        : clearing
                          ? "bg-foreground/35"
                          : "bg-foreground",
                  )}
                  style={{ height: 4 + step * 2 }}
                />
              )}
            </span>
          ))}
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-auto p-1.5"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          pickerRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // A tap or click on another cell already moved focus there; leave it.
          if (!document.activeElement || document.activeElement === document.body) meterRef.current?.focus();
        }}
      >
        <div ref={pickerRef} role="group" aria-label={`${field} for ${track}`} className="flex gap-1">
          {[0, ...STEPS].map((n) => (
            <button
              key={n}
              type="button"
              // A decimal (3.8) marks its whole value, as its bars do.
              aria-pressed={n === Math.floor(v)}
              aria-label={n ? `${n} of 5` : emptyText}
              onClick={() => {
                set(n);
                setPicking(false);
              }}
              className={cn(
                "inline-flex h-11 items-center justify-center rounded-md text-[13px] transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                n ? "k-num w-11" : "mr-1 px-3",
                n === Math.floor(v)
                  ? "bg-signal-soft text-signal-text"
                  : cn(n ? "text-foreground" : "text-muted-foreground", "hover:bg-accent"),
              )}
            >
              {n || emptyText}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Lyrics: opens the lyrics editor ────────────────────────

export function LyricsCell({ song, onOpen }: { song: Song; onOpen: (song: Song) => void }) {
  const lyrics = song.lyrics;
  return (
    <CellButton
      onClick={() => onOpen(song)}
      aria-label={`Lyrics for ${song.title}: ${lyrics ? lyrics.substring(0, 50) : "none"}`}
      title={lyrics ? lyrics.substring(0, 200) + (lyrics.length > 200 ? "…" : "") : "Add lyrics"}
    >
      {lyrics ? (
        <span className="truncate text-xs text-muted-foreground">
          {lyrics.substring(0, 50)}
          {lyrics.length > 50 ? "…" : ""}
        </span>
      ) : (
        <span className="text-xs text-muted-foreground/60">No lyrics</span>
      )}
    </CellButton>
  );
}
