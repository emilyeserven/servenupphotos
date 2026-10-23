import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A small X button clearing one filter, set inside that filter's border, to the right of its
 * chosen value. `label` names the filter for screen readers, such as "Clear Lens".
 */
export function ClearFilterButton({
  label,
  onClear,
  className,
}: {
  label: string;
  onClear: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={`Clear ${label}`}
      title={`Clear ${label}`}
      onClick={onClear}
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <X className="size-3.5" aria-hidden />
    </button>
  );
}
