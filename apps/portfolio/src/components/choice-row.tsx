import { Check } from "lucide-react";
import { cn } from "@portfolio/lib/utils";

/** A row in a list of choices: a check while it's on, its name, and how many photos it would show. */
export function ChoiceRow({
  label,
  count,
  depth = 0,
  on,
  onClick,
}: {
  label: string;
  count?: number;
  depth?: number;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth}rem` }}
      className={cn(
        "flex items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        on && "font-medium",
      )}
    >
      <Check aria-hidden className={cn("size-4 shrink-0", !on && "invisible")} />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
