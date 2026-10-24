import { Link } from "@tanstack/react-router";
import type { PinScale } from "@/lib/pin-scale";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

const SIZES = [
  { scale: "small", label: "S", title: "Small previews" },
  { scale: "medium", label: "M", title: "Medium previews" },
  { scale: "large", label: "L", title: "Large previews" },
] as const;

/**
 * How big the photo previews on the color wheel and the Black & white chart are, kept in the URL
 * as `?pins=medium` or `?pins=large` and left out for small. Bigger previews cluster sooner.
 */
export function PinSizeControl({ scale = "small" }: { scale?: PinScale }) {
  return (
    <div role="group" aria-label="Preview size" className={CONTROL_FRAME}>
      <span className="flex items-center px-2 text-sm text-muted-foreground">Previews</span>
      {SIZES.map((option) => (
        <Link
          key={option.scale}
          to="."
          search={(prev: Record<string, unknown>) => ({ ...prev, pins: pinsParam(option.scale) })}
          replace
          aria-pressed={scale === option.scale}
          aria-label={option.title}
          title={option.title}
          className={controlButtonClass(scale === option.scale)}
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** The `?pins=` for a size, left out for small. */
function pinsParam(scale: PinScale): Exclude<PinScale, "small"> | undefined {
  return scale === "small" ? undefined : scale;
}
