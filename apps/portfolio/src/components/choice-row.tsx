import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@portfolio/lib/utils";

/**
 * A row in a list of choices: a check while it's on, an optional little graphic (`icon`), its
 * name, and how many photos it would show. `dimmed` greys it out, for a choice the other filters
 * hide. Other button props go on the button, so it can be a tooltip's trigger.
 */
export function ChoiceRow({
  label,
  count,
  depth = 0,
  on,
  dimmed = false,
  icon,
  onClick,
  ...rest
}: Omit<ComponentProps<"button">, "onClick"> & {
  label: string;
  count?: number;
  depth?: number;
  on: boolean;
  dimmed?: boolean;
  icon?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      {...rest}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      style={{ paddingLeft: `${0.5 + depth}rem` }}
      className={cn(
        "flex items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent",
        on && "font-medium",
        dimmed && "text-muted-foreground/70",
      )}
    >
      <Check aria-hidden className={cn("size-4 shrink-0", !on && "invisible")} />
      {icon}
      <span className="truncate">{label}</span>
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}
