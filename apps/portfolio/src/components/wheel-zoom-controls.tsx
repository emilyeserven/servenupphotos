import { Maximize2, Minus, Plus } from "lucide-react";
import { MAX_ZOOM, WHOLE_WHEEL, type WheelView, ZOOM_STEP, zoomAt } from "@/lib/use-wheel-zoom";
import { cn } from "@/lib/utils";

const BUTTON_CLASS =
  "flex size-8 items-center justify-center text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent [&_svg]:size-4";

/**
 * The buttons that zoom the color wheel (or Black & white chart) in and out around the middle of
 * the view, and back to all of it; wholeLabel names that last one, such as "Show the whole wheel".
 */
export function WheelZoomControls({
  view,
  onChange,
  wholeLabel,
  className,
}: {
  view: WheelView;
  onChange: (view: WheelView) => void;
  wholeLabel: string;
  className?: string;
}) {
  const whole = view.zoom === 1;
  return (
    <div
      role="group"
      aria-label="Zoom"
      className={cn(
        "flex flex-col divide-y overflow-hidden rounded-md border bg-background/90 shadow-sm backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Zoom in"
        title="Zoom in"
        disabled={view.zoom >= MAX_ZOOM}
        onClick={() => onChange(zoomAt(view, ZOOM_STEP))}
        className={BUTTON_CLASS}
      >
        <Plus aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        title="Zoom out"
        disabled={whole}
        onClick={() => onChange(zoomAt(view, 1 / ZOOM_STEP))}
        className={BUTTON_CLASS}
      >
        <Minus aria-hidden />
      </button>
      <button
        type="button"
        aria-label={wholeLabel}
        title={wholeLabel}
        disabled={whole}
        onClick={() => onChange(WHOLE_WHEEL)}
        className={BUTTON_CLASS}
      >
        <Maximize2 aria-hidden />
      </button>
    </div>
  );
}
