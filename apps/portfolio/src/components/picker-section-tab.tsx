import type { LucideIcon } from "lucide-react";
import { cn } from "@portfolio/lib/utils";

/**
 * A section in a picker's left list, such as Cameras in **Gear & settings**: its name, with what
 * it's set to under it, an icon before the name when it has one, and a dot after it while it's
 * set.
 */
export function SectionTab({
  label,
  text,
  chosen,
  onClick,
  set = false,
  Icon,
}: {
  label: string;
  text: string;
  chosen: boolean;
  onClick: () => void;
  /** Whether the section has a filter set, which shows a dot after its name. */
  set?: boolean;
  Icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={chosen}
      onClick={onClick}
      className={cn(
        "flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        chosen && "bg-background shadow-xs",
      )}
    >
      <span className="flex w-full items-center gap-1.5 font-medium">
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
        {label}
        {set && <span className="ml-auto size-1.5 rounded-full bg-primary" aria-label="(set)" />}
      </span>
      <span className="line-clamp-2 w-full text-xs text-muted-foreground">{text}</span>
    </button>
  );
}
