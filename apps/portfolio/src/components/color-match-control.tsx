import { useNavigate } from "@tanstack/react-router";
import {
  parseSliderValue,
  SearchSlider,
  type SliderRange,
} from "@portfolio/components/search-slider";

/** The least a color's share can be set to, the most, and the step between, in percent. */
const SHARE_RANGE: SliderRange = { min: 5, max: 95, step: 5 };

/** A slider for how much of a photo the color needs, kept in the URL as `?min=`. */
export function ShareThreshold({ percent, fallback }: { percent: number; fallback: number }) {
  const navigate = useNavigate();
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
        void navigate({
          to: ".",
          resetScroll: false,
          search: (prev: Record<string, unknown>) => ({ ...prev, min, photo: undefined }),
          replace: true,
        });
      }}
    />
  );
}

/** The `?min=` from the URL, when it's a whole percent the slider can set. */
export function parseThreshold(value: unknown): number | undefined {
  return parseSliderValue(value, SHARE_RANGE);
}
