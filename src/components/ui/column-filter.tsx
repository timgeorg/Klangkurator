import React, { useEffect, useState } from "react";
import { Check, ListFilter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FilterOption, FilterType, FilterValue, RangeValue, isFilterActive } from "@/components/dj/libraryTable";
import { cn } from "@/lib/utils";

interface ColumnFilterProps {
  title: string;
  type: FilterType;
  value: FilterValue;
  onChange: (value: FilterValue) => void;
  options?: FilterOption[];
  placeholder?: string;
  min?: number;
  max?: number;
  /** Classes for the trigger button (e.g. reveal-on-hover in table headers). */
  triggerClassName?: string;
}

export function ColumnFilter({
  title,
  type,
  value,
  onChange,
  options = [],
  placeholder,
  min,
  max,
  triggerClassName,
}: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempRange, setTempRange] = useState({ min: "", max: "" });

  // Reset the draft range when the popover opens; empty strings mean "no bound"
  useEffect(() => {
    if (isOpen && type === "range") {
      const range = (value ?? {}) as RangeValue;
      setTempRange({
        min: range.min !== undefined ? String(range.min) : "",
        max: range.max !== undefined ? String(range.max) : "",
      });
    }
  }, [isOpen, type, value]);

  const active = isFilterActive(type, value);

  const clearFilter = () => {
    if (type === "multiselect") {
      onChange([]);
    } else if (type === "range") {
      onChange({});
      setTempRange({ min: "", max: "" });
    } else {
      onChange(null);
    }
  };

  const handleMultiselectChange = (optionValue: string, checked: boolean) => {
    const currentValues = Array.isArray(value) ? value : [];
    onChange(checked ? [...currentValues, optionValue] : currentValues.filter((v) => v !== optionValue));
  };

  const handleRangeApply = () => {
    const newRange: { min?: number; max?: number } = {};
    // Only bounds the user actually entered apply
    if (tempRange.min !== "" && !isNaN(Number(tempRange.min))) newRange.min = Number(tempRange.min);
    if (tempRange.max !== "" && !isNaN(Number(tempRange.max))) newRange.max = Number(tempRange.max);
    onChange(newRange);
    setIsOpen(false);
  };

  const summary = (() => {
    if (!active) return null;
    if (type === "text") return `“${value}”`;
    if (type === "select") return options.find((o) => o.value === value)?.label ?? String(value);
    if (type === "multiselect") return `${(value as string[]).length} selected`;
    if (type === "range") return `${(value as RangeValue).min ?? min} – ${(value as RangeValue).max ?? max}`;
    return null;
  })();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-active={active}
          aria-label={active ? `Filter ${title} (active)` : `Filter ${title}`}
          className={cn(
            "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-[color,background-color,opacity] duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:text-signal-text data-[state=open]:bg-accent",
            triggerClassName,
          )}
        >
          <ListFilter className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[13px] font-semibold">{title}</h4>
            {active && (
              <Button variant="ghost" size="sm" onClick={clearFilter} className="h-7 px-2 text-xs text-muted-foreground">
                <X className="h-3 w-3" />
                Clear
              </Button>
            )}
          </div>

          {summary && <p className="k-num -mt-1 text-xs text-signal-text">{summary}</p>}

          {type === "text" && (
            <Input
              autoFocus
              placeholder={placeholder || `Search ${title.toLowerCase()}…`}
              value={(value as string) || ""}
              onChange={(e) => onChange(e.target.value)}
            />
          )}

          {type === "select" && (
            <div className="space-y-1">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Check className={cn("h-3.5 w-3.5 text-signal-text", value !== option.value && "invisible")} />
                  {option.color && <ColorDot color={option.color} />}
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {type === "multiselect" && (
            <div className="-mx-1 max-h-72 space-y-0.5 overflow-y-auto px-1">
              {options.length === 0 && <p className="py-2 text-[13px] text-muted-foreground">Nothing to filter by yet.</p>}
              {options.map((option) => {
                const isSelected = Array.isArray(value) && value.includes(option.value);
                const id = `${title}-${option.value}`;
                return (
                  <label
                    key={option.value}
                    htmlFor={id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-[13px] hover:bg-accent"
                  >
                    <Checkbox
                      id={id}
                      checked={isSelected}
                      onCheckedChange={(checked) => handleMultiselectChange(option.value, checked as boolean)}
                    />
                    {option.color && <ColorDot color={option.color} />}
                    <span className="truncate">{option.label}</span>
                  </label>
                );
              })}
            </div>
          )}

          {type === "range" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={tempRange.min}
                    onChange={(e) => setTempRange((prev) => ({ ...prev, min: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleRangeApply()}
                    placeholder={min !== undefined ? String(min) : "No min"}
                    className="k-num"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={tempRange.max}
                    onChange={(e) => setTempRange((prev) => ({ ...prev, max: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleRangeApply()}
                    placeholder={max !== undefined ? String(max) : "No max"}
                    className="k-num"
                  />
                </label>
              </div>
              <Button onClick={handleRangeApply} size="sm" className="w-full">
                Apply range
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-foreground/10"
      style={{ backgroundColor: color }}
    />
  );
}
