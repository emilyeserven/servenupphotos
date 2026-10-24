import { AllSwatch, FilterSwatch } from "@/components/filter-swatch";
import { SHADE_STEPS, shadeStepGray, shadeStepLabel } from "@/lib/shade-steps";

/**
 * The Black & white view's swatches: a step of gray for each tenth of lightness from black to
 * white, to show only the photos that light on average, and one to show them all again, kept in
 * the URL as `?shade=` (0 to 9) so a link keeps it.
 */
export function ShadeStepFilter({
  shade,
  counts,
}: {
  shade: number | undefined;
  /** How many photos each step would show, by step. */
  counts: number[];
}) {
  return (
    <div
      role="group"
      aria-label="Filter by lightness"
      className="flex flex-wrap items-center gap-2"
    >
      <AllSwatch active={shade === undefined} clear={{ shade: undefined }} />
      {SHADE_STEPS.map((step) => (
        <FilterSwatch
          key={step}
          fill={shadeStepGray(step)}
          ringed
          label={shadeStepLabel(step)}
          count={counts[step] ?? 0}
          active={shade === step}
          pick={{ shade: step }}
          clear={{ shade: undefined }}
        />
      ))}
    </div>
  );
}
