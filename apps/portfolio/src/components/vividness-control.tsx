import { Link, useNavigate } from "@tanstack/react-router";
import { parseSliderValue, SearchSlider, type SliderRange } from "@/components/search-slider";
import type { VividMeasure } from "@/lib/color-sort";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/**
 * The vividness a photo can be asked to have at least, from 0 (any photo) up, in CIELAB chroma:
 * a gray photo is 0, an ordinary colorful one's average is about 20 to 30, and the most vivid
 * reds and oranges peak above 100.
 */
const VIVID_RANGE: SliderRange = { min: 0, max: 100, step: 5 };

const MEASURES = [
  { measure: "average", label: "Average", title: "How vivid the photo is on average" },
  { measure: "peak", label: "Peak", title: "How vivid the photo's most vivid tenth is" },
] as const;

/**
 * Which vividness the page sorts and filters by, average (the default) or peak, kept in the URL as
 * `?measure=peak`, and a slider for the least of it a photo needs to show, kept as `?vivid=` and
 * left out at 0, which shows every photo.
 */
export function VividnessControl({ vivid, measure }: { vivid: number; measure: VividMeasure }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div role="group" aria-label="Vividness measure" className={CONTROL_FRAME}>
        {MEASURES.map((option) => (
          <Link
            key={option.measure}
            to="."
            search={(prev) => ({
              ...prev,
              measure: option.measure === "peak" ? option.measure : undefined,
              photo: undefined,
            })}
            replace
            aria-pressed={measure === option.measure}
            title={option.title}
            className={controlButtonClass(measure === option.measure)}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <VividnessSlider vivid={vivid} />
    </div>
  );
}

/** The slider for the least vividness a photo needs to show. */
function VividnessSlider({ vivid }: { vivid: number }) {
  const navigate = useNavigate();
  return (
    <SearchSlider
      id="vividness-threshold"
      value={vivid}
      range={VIVID_RANGE}
      label={(shown) => (
        <>
          Vividness at least{" "}
          <span className="font-medium text-foreground tabular-nums">{shown}</span>
        </>
      )}
      onCommit={(next) => {
        const value = next === 0 ? undefined : next;
        void navigate({
          to: ".",
          search: (prev: Record<string, unknown>) => ({ ...prev, vivid: value, photo: undefined }),
          replace: true,
        });
      }}
    />
  );
}

/** The `?vivid=` from the URL, when it's one the slider can set. */
export function parseVividness(value: unknown): number | undefined {
  return parseSliderValue(value, VIVID_RANGE);
}
