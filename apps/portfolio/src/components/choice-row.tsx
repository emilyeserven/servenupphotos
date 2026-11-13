import { Check } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@portfolio/lib/utils";
import { TruncatedText } from "@portfolio/components/truncated-text";

/**
 * A row in a list of choices: a check while it's on, its
 * name, and how many photos it would show. `dimmed` greys it out, for a choice the other filters
 * hide. `icon`, rarely used (see the picker conventions), goes before the name, such as each graph
 * type's. `tag`, such as the Graph type list's "Suggested", is a small mark after the name. Other button props go on the button, so it can be a tooltip's trigger.
 */
export function ChoiceRow({
  label,
  icon,
  tag,
  count,
  depth = 0,
  on,
  dimmed = false,
  onClick,
  ...rest
}: Omit<ComponentProps<"button">, "onClick"> & {
  label: string;
  icon?: ReactNode;
  tag?: string;
  count?: number;
  depth?: number;
  on: boolean;
  dimmed?: boolean;
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
      <TruncatedText text={label} />
      <RowTag text={tag} />
      <span className="ml-auto text-xs text-muted-foreground tabular-nums">{count}</span>
    </button>
  );
}

/** A row's small mark after its name, such as "Suggested"; nothing without one. */
function RowTag({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    <span className="shrink-0 rounded-sm bg-accent px-1.5 py-0.5 text-xs font-medium text-accent-foreground">
      {text}
    </span>
  );
}
