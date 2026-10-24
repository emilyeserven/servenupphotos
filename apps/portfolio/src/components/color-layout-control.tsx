import { Link } from "@tanstack/react-router";
import { CircleDot, LayoutGrid } from "lucide-react";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

const LAYOUTS = [
  {
    wheel: true,
    label: "Wheel",
    title: "The photos on a color wheel: around it by color, out from the middle by vividness",
    Icon: CircleDot,
  },
  { wheel: false, label: "Grid", title: "The photos in a grid, sorted", Icon: LayoutGrid },
] as const;

/**
 * Whether the Color page shows its photos on a color wheel (the default) or in a grid, kept in the
 * URL as `?view=grid` so a link keeps it.
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
            view: option.wheel ? undefined : ("grid" as const),
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
