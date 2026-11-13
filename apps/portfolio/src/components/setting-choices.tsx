import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One of the picks in a `SettingChoices` row. */
export interface SettingOption<T> {
  value: T;
  label: string;
  /** An icon before the label, such as the sun for the Light theme. */
  Icon?: LucideIcon;
}

interface SettingChoicesProps<T extends string> {
  /** The name read out for the row; or else `labelledBy`, the ID of a heading that names it. */
  label?: string;
  labelledBy?: string;
  className?: string;
  options: SettingOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A row of buttons on the Settings page that picks one of the options, like radio buttons. */
export function SettingChoices<T extends string>({
  label,
  labelledBy,
  className,
  options,
  value,
  onChange,
}: SettingChoicesProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-labelledby={labelledBy}
      className={cn("flex rounded-md border bg-muted/50 p-0.5", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-1.5 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
            value === option.value && "bg-background text-foreground shadow-xs",
          )}
        >
          {option.Icon && <option.Icon className="size-4" aria-hidden />}
          {option.label}
        </button>
      ))}
    </div>
  );
}
