import { Link } from "@tanstack/react-router";
import { LayoutDashboard, type LucideIcon, Square } from "lucide-react";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** One of the buttons in a `ViewSwitcher`: the `?view=` it picks, its label, tooltip and icon. */
export interface ViewChoice<T extends string> {
  mode: T;
  label: string;
  title: string;
  Icon: LucideIcon;
}

/** The two tile shapes, shared by the Grid and the Lucky page. Square is the default. */
export const TILE_SHAPES: ViewChoice<"square" | "natural">[] = [
  { mode: "square", label: "Square", title: "Square thumbnails", Icon: Square },
  {
    mode: "natural",
    label: "Natural",
    title: "Each photo at its own aspect ratio",
    Icon: LayoutDashboard,
  },
];

/**
 * Buttons to switch how a page shows its photos, kept in the URL as `?view=` so a link keeps the
 * view. The first choice is the default and is left out of the URL.
 */
export function ViewSwitcher<T extends string>({
  choices,
  mode,
}: {
  choices: ViewChoice<T>[];
  mode: T;
}) {
  const fallback = choices[0]?.mode;
  return (
    <div role="group" aria-label="Show photos as" className={CONTROL_FRAME}>
      {choices.map(({ mode: option, label, title, Icon }) => (
        <Link
          key={option}
          to="."
          search={(prev: Record<string, unknown>) => ({
            ...prev,
            // Each page checks its own views; any page's `view` type wouldn't fit the others.
            view: (option === fallback ? undefined : option) as never,
          })}
          replace
          aria-pressed={mode === option}
          title={title}
          className={controlButtonClass(mode === option)}
        >
          <Icon aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}
