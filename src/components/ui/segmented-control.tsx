import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";

import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  /** Accessible name of the group, e.g. "Theme". */
  label: string;
  className?: string;
}

/**
 * One choice out of a few, shown side by side as pills (a radio group: arrow
 * keys move and select). The chosen pill takes the soft orange of the tabs,
 * since orange marks "this one".
 */
export function SegmentedControl<T extends string>({ value, onValueChange, options, label, className }: SegmentedControlProps<T>) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={(next) => onValueChange(next as T)}
      aria-label={label}
      orientation="horizontal"
      className={cn("inline-flex max-w-full flex-wrap items-center gap-1 rounded-[1.125rem] border border-border p-1", className)}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-chip px-3.5 text-[13px] font-medium text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-signal-soft data-[state=checked]:text-signal-text [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          {option.icon}
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
