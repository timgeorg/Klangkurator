import { useRef } from "react";
import { ArrowDown, ArrowUp, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface OrderRow {
  key: string;
  /** Plain name for button labels: "Move Feng Shui up". */
  name: string;
  /** 40px cover or colour tile. */
  art: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Mono data on the right: BPM, key, length. */
  meta?: React.ReactNode;
  /** A deleted track or block that still holds its slot. */
  missing?: boolean;
}

interface RunningOrderListProps {
  rows: OrderRow[];
  onMove: (index: number, delta: -1 | 1) => void;
  onRemove: (index: number) => void;
  /** What sits between row i and row i + 1: the transition. */
  renderTransition: (index: number) => React.ReactNode;
}

/**
 * An editable running order: numbered rows joined by a hairline, each
 * transition between two rows carrying its note. Rows move with buttons that
 * keep focus where the row went.
 */
export function RunningOrderList({ rows, onMove, onRemove, renderTransition }: RunningOrderListProps) {
  const listRef = useRef<HTMLOListElement>(null);

  const focusSoon = (...keys: string[]) =>
    requestAnimationFrame(() => {
      for (const key of keys) {
        const el = listRef.current?.querySelector<HTMLButtonElement>(`[data-focus-key="${CSS.escape(key)}"]`);
        if (el && !el.disabled) {
          el.focus();
          return;
        }
      }
    });

  const move = (index: number, delta: -1 | 1) => {
    const key = rows[index].key;
    onMove(index, delta);
    focusSoon(`${key}:${delta < 0 ? "up" : "down"}`, `${key}:${delta < 0 ? "down" : "up"}`);
  };

  const remove = (index: number) => {
    const next = rows[index + 1] ?? rows[index - 1];
    onRemove(index);
    if (next) focusSoon(`${next.key}:remove`);
  };

  return (
    <ol ref={listRef} aria-label="Running order">
      {rows.map((row, index) => (
        <li key={row.key}>
          <div className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md py-1.5 pr-1 transition-colors duration-fast focus-within:bg-accent/60 hover:bg-accent/60 sm:grid-cols-[1.75rem_2.5rem_minmax(0,1fr)_auto_auto]">
            <span className="k-num text-center text-xs text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            {row.art}
            <div className="min-w-0">
              <p
                className={cn(
                  "line-clamp-2 text-[13px] font-medium [overflow-wrap:anywhere]",
                  row.missing && "font-normal italic text-muted-foreground",
                )}
              >
                {row.title}
              </p>
              {row.subtitle && <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>}
            </div>
            <span className="k-num hidden whitespace-nowrap text-xs text-muted-foreground sm:block">{row.meta}</span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                data-focus-key={`${row.key}:up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Move ${row.name} up`}
                title="Move up"
              >
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                data-focus-key={`${row.key}:down`}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${row.name} down`}
                title="Move down"
              >
                <ArrowDown />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                data-focus-key={`${row.key}:remove`}
                onClick={() => remove(index)}
                aria-label={`Remove ${row.name}`}
                title="Remove"
                className="text-muted-foreground hover:text-destructive"
              >
                <X />
              </Button>
            </div>
          </div>
          {index < rows.length - 1 && renderTransition(index)}
        </li>
      ))}
    </ol>
  );
}

interface TransitionProps {
  from: string;
  to: string;
  note: string;
  onNoteChange: (note: string) => void;
  /** Extra controls after the note (alternatives). */
  actions?: React.ReactNode;
  /** Shown under the note (the list of alternatives). */
  children?: React.ReactNode;
}

/** The space between two rows: the hairline that joins them and the note on how to mix across. */
export function Transition({ from, to, note, onNoteChange, actions, children }: TransitionProps) {
  return (
    <div className="grid grid-cols-[1.75rem_2.5rem_minmax(0,1fr)] gap-x-3">
      <span aria-hidden className="mx-auto w-px bg-border" />
      <span aria-hidden />
      <div className="min-w-0 py-1">
        <div className="flex items-center gap-1.5">
          <Input
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Transition note"
            aria-label={`Transition from ${from} to ${to}`}
            className="h-8 border-dashed bg-transparent font-serif text-sm italic placeholder:font-sans placeholder:text-[13px] placeholder:not-italic"
          />
          {actions}
        </div>
        {children}
      </div>
    </div>
  );
}
