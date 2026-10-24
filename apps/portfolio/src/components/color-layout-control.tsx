import { Link } from "@tanstack/react-router";
import { CircleDot, Contrast, LayoutGrid } from "lucide-react";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** How the Color page shows its photos: on the color wheel (left out of the URL), the black-to-white spectrum, or a grid. */
export type ColorLayout = "wheel" | "mono" | "grid";

const LAYOUTS = [
  {
    layout: "wheel",
    label: "Wheel",
    title:
      "The color photos on a color wheel: around it by color, out from the middle by vividness",
    Icon: CircleDot,
  },
  {
    layout: "mono",
    label: "Black & white",
    title: "The black and white photos along a spectrum from black to white",
    Icon: Contrast,
  },
  { layout: "grid", label: "Grid", title: "Every photo in a grid, sorted", Icon: LayoutGrid },
] as const;

/**
 * Whether the Color page shows its photos on a color wheel (the default), black and white ones
 * along a spectrum from black to white, or every photo in a grid, kept in the URL as
 * `?view=mono` or `?view=grid` so a link keeps it.
 */
export function ColorLayoutControl({ layout }: { layout: ColorLayout }) {
  return (
    <div role="group" aria-label="Show photos as" className={CONTROL_FRAME}>
      {LAYOUTS.map((option) => (
        <Link
          key={option.layout}
          from="/color"
          to="/color"
          search={(prev) => ({ ...prev, view: viewParam(option.layout), photo: undefined })}
          replace
          aria-pressed={layout === option.layout}
          title={option.title}
          className={controlButtonClass(layout === option.layout)}
        >
          <option.Icon aria-hidden />
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** The `?view=` for a layout, left out for the wheel. */
function viewParam(layout: ColorLayout): Exclude<ColorLayout, "wheel"> | undefined {
  return layout === "wheel" ? undefined : layout;
}
