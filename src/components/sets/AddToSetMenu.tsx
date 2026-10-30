import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ListPlus } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import { addSongToItems, setHasSong } from "@/lib/setItems";
import { storage, type DJSet } from "@/lib/storage";
import { cn } from "@/lib/utils";

interface AddToSetMenuProps {
  /** The song to add, by id, and its title for the accessible name and the notice. */
  songId: string;
  songTitle: string;
  /** The trigger, so the row and the song page can present their own button. */
  children: React.ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Add one song to a set without leaving the page.
 *
 * The list is read on open, so it is always the current order; selecting a set
 * appends the song to that set's running order and saves with `items` alone, so
 * the name, notes, phases and everything else stay as they were.
 */
export function AddToSetMenu({
  songId,
  songTitle,
  children,
  align = "start",
}: AddToSetMenuProps) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<DJSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);

  // The trigger is a plain element from the caller; remember it so focus can go
  // back after a pick, which Escape already does on its own.
  const rememberTrigger = useCallback((node: HTMLElement | null) => {
    triggerRef.current = node?.closest("button") ?? node;
  }, []);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    storage
      .getSets()
      .then((found) => {
        if (alive) setSets(found);
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const shown = q
    ? sets.filter((set) => set.name.toLowerCase().includes(q))
    : sets;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setQuery("");
  };

  const pick = async (set: DJSet) => {
    const items = addSongToItems(set.items ?? [], songId);
    if (!items) {
      // The menu greys this set out, so this is a race with another tab.
      onOpenChange(false);
      return;
    }
    onOpenChange(false);
    try {
      await storage.updateSet(set.id, { items });
      toast({ title: `Added to “${set.name}”`, description: songTitle });
    } catch (error) {
      toast({
        title: `“${set.name}” wasn't updated`,
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    }
    triggerRef.current?.focus();
  };

  return (
    <Popover modal open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild ref={rememberTrigger}>
        {children}
      </PopoverTrigger>
      <PopoverContent
        align={align}
        aria-label="Add to set"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Filter sets"
          />
          <CommandList className="max-h-[min(22rem,50vh)] py-1">
            <CommandEmpty>
              {failed ? (
                "The sets could not be read."
              ) : loading ? (
                "Reading the sets…"
              ) : sets.length === 0 ? (
                <>
                  No sets yet — create one on the{" "}
                  <Link
                    to="/sets"
                    onClick={() => onOpenChange(false)}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Sets page
                  </Link>
                  .
                </>
              ) : (
                `No set matches “${query.trim()}”.`
              )}
            </CommandEmpty>

            {shown.length > 0 && (
              <CommandGroup>
                {shown.map((set) => {
                  const holds = setHasSong(set.items ?? [], set.phases, songId);
                  const tracks = (set.items ?? []).filter(
                    (i) => i.type === "song",
                  ).length;
                  return (
                    <CommandItem
                      key={set.id}
                      value={set.id}
                      disabled={holds}
                      onSelect={() => void pick(set)}
                      aria-label={
                        holds
                          ? `${set.name}, already contains this song`
                          : `Add to ${set.name}`
                      }
                      className="gap-3 data-[disabled=true]:opacity-100 data-[disabled=true]:text-muted-foreground [@media(pointer:coarse)]:min-h-11"
                    >
                      {/* The set's own colour, as the Sets page shows it. */}
                      <span
                        aria-hidden="true"
                        className="h-3 w-3 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: set.color }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {set.name}
                      </span>
                      <span className="k-num shrink-0 text-[11px] text-muted-foreground">
                        {tracks} {tracks === 1 ? "track" : "tracks"}
                      </span>
                      {/* The slot is always there, so the mono count keeps one right
                          edge whether or not the row carries the tick. The item
                          already says "already contains this song", so the mark is
                          decoration to a screen reader. */}
                      <span
                        aria-hidden="true"
                        className="flex h-4 w-4 shrink-0 items-center justify-center"
                      >
                        {holds && (
                          <Check className="h-4 w-4 text-signal-text" />
                        )}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The row's trigger: a third icon action beside Play and Edit, with the same
 * hover-and-focus reveal and the accessible name the acceptance names.
 *
 * `asChild` on the popover clones this element and hands it `onClick`,
 * `aria-expanded` and a ref, so the props must be forwarded; the row's own click
 * is stopped first, or picking the action would also open the song dialog.
 */
export const AddToSetButton = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button"> & { songTitle: string }
>(function AddToSetButton({ songTitle, className, onClick, ...rest }, ref) {
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      aria-label={`Add ${songTitle} to a set`}
      title="Add to set"
      // AC-15 asks for a 44 px target. The height carries it; the width stays
      // 24 px so three actions fit the 84 px `#` column instead of bleeding into
      // the cover.
      className={cn(className, "[@media(pointer:coarse)]:h-11")}
    >
      <ListPlus className="h-3.5 w-3.5" />
    </button>
  );
});
