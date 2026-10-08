import React, { useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

import { ColumnFilter } from "@/components/ui/column-filter";
import { COLUMN_DEFINITIONS, UseColumnConfigReturn } from "@/hooks/useColumnConfig";
import { cn } from "@/lib/utils";

import {
  FILTER_CONFIG,
  FilterOptions,
  FilterState,
  FilterValue,
  NUMERIC_COLUMNS,
  SortState,
  isFilterActive,
} from "./libraryTable";

interface SongTableHeaderProps {
  columnConfig: UseColumnConfigReturn;
  filters: FilterState;
  filterOptions: FilterOptions;
  onFilterChange: (key: keyof FilterState, value: FilterValue) => void;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
}

interface DropIndicator {
  columnId: string;
  side: "left" | "right";
}

export function SongTableHeader({
  columnConfig,
  filters,
  filterOptions,
  onFilterChange,
  sort,
  onSortChange,
}: SongTableHeaderProps) {
  const { visibleColumns, gridTemplate, startResize, columnOrder, moveColumn } = columnConfig;

  // PF-15: insert-before drag & drop reordering
  const dragColumnRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  const handleResizeStart = (columnId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startResize(columnId, e.clientX);
  };

  const clearDragState = () => {
    dragColumnRef.current = null;
    setDraggingId(null);
    setDropIndicator(null);
  };

  const getDropSide = (e: React.DragEvent<HTMLDivElement>): "left" | "right" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX < rect.left + rect.width / 2 ? "left" : "right";
  };

  const handleDragStart = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    dragColumnRef.current = columnId;
    setDraggingId(columnId);
    e.dataTransfer.effectAllowed = "move";
    // setData is required for Firefox to start the drag at all
    e.dataTransfer.setData("text/plain", columnId);
  };

  const handleDragOver = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    const fromId = dragColumnRef.current;
    if (!fromId || fromId === columnId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const side = getDropSide(e);
    setDropIndicator((prev) => (prev && prev.columnId === columnId && prev.side === side ? prev : { columnId, side }));
  };

  const handleDrop = (columnId: string) => (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const fromId = dragColumnRef.current;
    const side = getDropSide(e);
    clearDragState();
    if (!fromId || fromId === columnId) return;

    // Indexes are computed against columnOrder (what moveColumn splices),
    // not visibleColumns: hidden columns would shift the positions otherwise.
    const fromIndex = columnOrder.indexOf(fromId);
    const hoverIndex = columnOrder.indexOf(columnId);
    if (fromIndex === -1 || hoverIndex === -1) return;

    // Insert-before semantics: left half lands before the hovered column, right half after.
    const desiredIndex = side === "left" ? hoverIndex : hoverIndex + 1;
    // moveColumn splices OUT first: moving right (fromIndex < desiredIndex)
    // shifts the insertion slot left by one, so compensate.
    const toIndex = fromIndex < desiredIndex ? desiredIndex - 1 : desiredIndex;
    if (toIndex === fromIndex) return;

    moveColumn(fromIndex, toIndex);
  };

  const cycleSort = (columnId: string) => {
    if (!sort || sort.column !== columnId) onSortChange({ column: columnId, dir: "asc" });
    else if (sort.dir === "asc") onSortChange({ column: columnId, dir: "desc" });
    else onSortChange(null);
  };

  const renderLabel = (columnId: string) => {
    const def = COLUMN_DEFINITIONS[columnId];
    const label = def?.label || columnId;

    if (columnId === "play") return <span className="k-num w-full text-center">#</span>;
    if (columnId === "cover") return <span className="sr-only">Cover</span>;

    if (!def?.sortable) return <span className="truncate">{label}</span>;

    const sorted = sort?.column === columnId ? sort.dir : null;
    return (
      <button
        type="button"
        onClick={() => cycleSort(columnId)}
        title={`Sort by ${label}`}
        className={cn(
          "inline-flex min-w-0 items-center gap-1 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sorted && "text-foreground",
          NUMERIC_COLUMNS.has(columnId) && "flex-row-reverse",
        )}
      >
        <span className="truncate">{label}</span>
        {sorted === "asc" && <ArrowUp className="h-3 w-3 shrink-0 text-signal-text" aria-hidden />}
        {sorted === "desc" && <ArrowDown className="h-3 w-3 shrink-0 text-signal-text" aria-hidden />}
      </button>
    );
  };

  return (
    <div role="rowgroup" className="k-ground sticky top-0 z-10 border-b border-border">
      <div
        role="row"
        className="grid h-9 items-center gap-2 px-3 text-xs font-medium text-muted-foreground"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        {visibleColumns.map((columnId) => {
          const isPlayColumn = columnId === "play";
          const def = COLUMN_DEFINITIONS[columnId];
          const filterConfig = FILTER_CONFIG[columnId as keyof FilterState];
          const filterValue = filterConfig ? filters[columnId as keyof FilterState] : undefined;
          const filterOn = filterConfig ? isFilterActive(filterConfig.type, filterValue) : false;
          const sorted = sort?.column === columnId ? sort.dir : null;
          return (
            <div
              key={columnId}
              role="columnheader"
              aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
              draggable={!isPlayColumn}
              onDragStart={isPlayColumn ? undefined : handleDragStart(columnId)}
              onDragEnd={isPlayColumn ? undefined : clearDragState}
              onDragOver={isPlayColumn ? undefined : handleDragOver(columnId)}
              onDrop={isPlayColumn ? undefined : handleDrop(columnId)}
              className={cn(
                "group/head relative flex h-full min-w-0 items-center gap-1",
                NUMERIC_COLUMNS.has(columnId) && "justify-end",
                !isPlayColumn && "cursor-grab",
                draggingId === columnId && "cursor-grabbing opacity-50",
              )}
            >
              {dropIndicator?.columnId === columnId && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-1.5 w-0.5 rounded-full bg-signal",
                    dropIndicator.side === "left" ? "-left-[5px]" : "-right-[5px]",
                  )}
                />
              )}
              {renderLabel(columnId)}
              {filterConfig && (
                <ColumnFilter
                  title={def?.label || columnId}
                  type={filterConfig.type}
                  value={filterValue}
                  onChange={(value) => onFilterChange(columnId as keyof FilterState, value)}
                  placeholder={filterConfig.placeholder}
                  min={filterConfig.min}
                  max={filterConfig.max}
                  options={filterConfig.optionsKey ? filterOptions[filterConfig.optionsKey] : undefined}
                  triggerClassName={cn(
                    "opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100",
                    filterOn && "opacity-100",
                  )}
                />
              )}
              <ResizeHandle onMouseDown={(e) => handleResizeStart(columnId, e)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="group/resize absolute -right-[5px] top-0 flex h-full w-2 cursor-col-resize justify-center"
      onMouseDown={onMouseDown}
      title="Drag to resize column"
      aria-hidden
    >
      <span className="h-full w-px bg-transparent transition-colors group-hover/head:bg-border group-hover/resize:bg-signal" />
    </div>
  );
}
