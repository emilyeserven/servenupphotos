import { useNavigate } from "@tanstack/react-router";
import { parseSliderValue, SearchSlider, type SliderRange } from "@/components/search-slider";

/**
 * The vividness a photo can be asked to have at least, from 0 (any photo) up: mean CIELAB chroma,
 * where a gray photo is 0 and a very colorful one is 50 or more.
 */
const VIVID_RANGE: SliderRange = { min: 0, max: 60, step: 5 };

/**
 * A slider for the least vividness a photo needs to show, kept in the URL as `?vivid=` and left
 * out at 0, which shows every photo.
 */
export function VividnessControl({ vivid }: { vivid: number }) {
  const navigate = useNavigate({ from: "/color" });
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
          search: (prev) => ({ ...prev, vivid: value, photo: undefined }),
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
