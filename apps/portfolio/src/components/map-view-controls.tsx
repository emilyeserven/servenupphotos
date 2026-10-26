import { Maximize } from "lucide-react";
import type { ReactNode } from "react";

/**
 * A row of controls over the map: `places` (the Places filter), an icon button that goes back to
 * the view that shows every photo, then the other controls.
 */
export function MapViewControls({
  onReset,
  places,
  children,
}: {
  onReset: () => void;
  places: ReactNode;
  /** More controls for the same row, such as the display options and More filters. */
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {places}
      <button
        type="button"
        onClick={onReset}
        title="Zoom out to every photo"
        aria-label="Zoom out to every photo"
        className="inline-flex size-8 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring dark:border-input"
      >
        <Maximize className="size-4" aria-hidden />
      </button>
      {children}
    </div>
  );
}
