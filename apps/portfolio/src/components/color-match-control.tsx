import { Link, useNavigate } from "@tanstack/react-router";
import { parseSliderValue, SearchSlider, type SliderRange } from "@/components/search-slider";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** The least a color's share can be set to, the most, and the step between, in percent. */
const SHARE_RANGE: SliderRange = { min: 5, max: 95, step: 5 };

const MODES = [
  { match: undefined, label: "Largest color", title: "Photos whose biggest color is the color" },
  { match: "threshold", label: "At least…", title: "Photos with at least a share of the color" },
] as const;

/**
 * How a photo matches the picked color: its largest color (the default), or at least a share of it
 * set on a slider. Both are kept in the URL, as `?match=threshold` and `?min=`, each left out at
 * its default, so a link keeps them.
 */
export function ColorMatchControl({
  threshold,
  percent,
  fallback,
}: {
  /** Whether the match is by share rather than the largest color. */
  threshold: boolean;
  percent: number;
  /** The share the slider starts at, which the URL leaves out. */
  fallback: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="How photos match the color" className={CONTROL_FRAME}>
        {MODES.map(({ match, label, title }) => (
          <Link
            key={label}
            from="/color"
            to="/color"
            search={(prev) => ({ ...prev, match, photo: undefined })}
            replace
            aria-pressed={threshold === (match === "threshold")}
            title={title}
            className={controlButtonClass(threshold === (match === "threshold"))}
          >
            {label}
          </Link>
        ))}
      </div>
      {threshold && <ShareThreshold percent={percent} fallback={fallback} />}
    </div>
  );
}

/** A slider for how much of a photo the color needs, kept in the URL as `?min=`. */
function ShareThreshold({ percent, fallback }: { percent: number; fallback: number }) {
  const navigate = useNavigate({ from: "/color" });
  return (
    <SearchSlider
      id="share-threshold"
      value={percent}
      range={SHARE_RANGE}
      label={(shown) => (
        <>
          <span className="font-medium text-foreground tabular-nums">{shown}%</span> of the photo
        </>
      )}
      onCommit={(next) => {
        const min = next === fallback ? undefined : next;
        void navigate({ search: (prev) => ({ ...prev, min, photo: undefined }), replace: true });
      }}
    />
  );
}

/** The `?min=` from the URL, when it's a whole percent the slider can set. */
export function parseThreshold(value: unknown): number | undefined {
  return parseSliderValue(value, SHARE_RANGE);
}
