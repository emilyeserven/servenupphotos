import { Link } from "@tanstack/react-router";
import { CircleDot, LayoutGrid } from "lucide-react";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

const LAYOUTS = [
  { wheel: false, label: "Grid", title: "The photos in a grid, sorted", Icon: LayoutGrid },
  {
    wheel: true,
    label: "Wheel",
    title: "The photos on a color wheel: around it by color, out from the middle by vividness",
    Icon: CircleDot,
  },
] as const;

/**
 * Whether the Color page shows its photos in a grid (the default) or on a color wheel, kept in the
 * URL as `?view=wheel` so a link keeps it.
 */
export function ColorLayoutControl({ wheel }: { wheel: boolean }) {
  return (
    <div role="group" aria-label="Show photos as" className={CONTROL_FRAME}>
      {LAYOUTS.map((option) => (
        <Link
          key={option.label}
          from="/color"
          to="/color"
          search={(prev) => ({
            ...prev,
            view: option.wheel ? ("wheel" as const) : undefined,
            photo: undefined,
          })}
          replace
          aria-pressed={wheel === option.wheel}
          title={option.title}
          className={controlButtonClass(wheel === option.wheel)}
        >
          <option.Icon aria-hidden />
          {option.label}
        </Link>
      ))}
    </div>
  );
}
