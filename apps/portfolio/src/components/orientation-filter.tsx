import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import { ClearFilterButton } from "@portfolio/components/clear-filter-button";
import { CONTROL_FRAME, controlButtonClass } from "@portfolio/lib/segmented-control";
import { ORIENTATIONS, type Orientation } from "@portfolio/lib/orientation";

/** Each orientation's name and its rectangle icon. */
const ORIENTATION = {
  horizontal: { label: "Horizontal", Icon: RectangleHorizontal },
  vertical: { label: "Vertical", Icon: RectangleVertical },
} as const;

/** The orientation chosen, as the filter's top line names it, or "Any" when none is. */
function chosenText(orientation: string | undefined): string {
  return ORIENTATION[orientation as Orientation]?.label ?? "Any";
}

/**
 * The **Orientation** filter, beside the camera sliders and boxed like them: a horizontal and a
 * vertical rectangle button, each with how many of the photos the other filters leave have that
 * orientation. Clicking the chosen one again, or the X, clears it.
 */
export function OrientationFilter({
  orientation,
  counts,
  onChange,
}: {
  orientation: string | undefined;
  counts: Record<Orientation, number>;
  onChange: (orientation: Orientation | undefined) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Orientation"
      className="flex flex-col gap-2 rounded-md border px-3 py-2"
    >
      <div className="flex h-5 items-center gap-2 text-xs">
        <span className="font-medium whitespace-nowrap text-muted-foreground">Orientation</span>
        <span className="ml-auto whitespace-nowrap">{chosenText(orientation)}</span>
        {orientation && (
          <ClearFilterButton
            label="Orientation"
            onClear={() => onChange(undefined)}
            className="-mr-1"
          />
        )}
      </div>
      <div className={CONTROL_FRAME}>
        {ORIENTATIONS.map((value) => {
          const { label, Icon } = ORIENTATION[value];
          const active = orientation === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              aria-label={label}
              title={label}
              onClick={() => onChange(active ? undefined : value)}
              className={controlButtonClass(active)}
            >
              <Icon aria-hidden />
              <span className="tabular-nums">{counts[value]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
