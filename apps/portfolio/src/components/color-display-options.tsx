import { useNavigate } from "@tanstack/react-router";
import { PinDisplayFields } from "@/components/pin-display-fields";
import { OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import {
  type ChartUp,
  type ColorDisplay,
  colorDisplaySearch,
  DEFAULT_COLOR_DISPLAY,
} from "@/lib/color-display";

/** What the Black & white chart's height can stand for, with their labels. */
const CHART_UPS: [ChartUp, string][] = [
  ["contrast", "Contrast"],
  ["vividness", "Vividness"],
];

/**
 * The Color page's display options, behind an eye button like the Map's: the same Grouping, Pin
 * size, counts and darkening options, kept in the URL so a link keeps them. In the Black & white
 * view it also picks what the chart's height stands for.
 */
export function ColorDisplayOptions({ display, mono }: { display: ColorDisplay; mono: boolean }) {
  const navigate = useNavigate({ from: "/color" });
  const change = (next: Partial<ColorDisplay>) =>
    void navigate({
      search: (prev) => ({ ...prev, ...colorDisplaySearch({ ...display, ...next }) }),
      replace: true,
    });
  return (
    <ViewOptionsButton onReset={() => change(DEFAULT_COLOR_DISPLAY)}>
      <PinDisplayFields
        display={display}
        defaultGrouping={DEFAULT_COLOR_DISPLAY.grouping}
        onChange={change}
      />
      {mono && (
        <OptionChoices
          label="Up the chart"
          choices={CHART_UPS}
          value={display.chartUp}
          onChange={(chartUp) => change({ chartUp })}
        />
      )}
    </ViewOptionsButton>
  );
}
