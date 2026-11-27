import { Input } from "@/components/ui/input";
import {
  PRESET_SIZES,
  type PrintChoice,
  type PrintFit,
  type PrintSize,
  type PrintUnit,
  presetOf,
} from "@/lib/print-quality";
import { printChoice } from "@/stores/printing";
import { CONTROL_FRAME, controlButtonClass, SELECT_CLASS } from "@portfolio/lib/segmented-control";

const CUSTOM = "custom";

const FITS: { value: PrintFit; label: string }[] = [
  { value: "fill", label: "Crop to fill" },
  { value: "fit", label: "Fit whole photo" },
];

const UNITS: PrintUnit[] = ["in", "cm"];

/**
 * Picks the print size to check at, a common size or a custom one in inches or centimeters, and
 * whether the photo is cropped to fill the paper or fits on it whole. The choice is kept in this
 * browser and shared by both Printing pages.
 */
export function PrintSizePicker() {
  const choice = printChoice.use();
  const set = (change: Partial<PrintChoice>) => printChoice.set({ ...choice, ...change });
  const setSize = (change: Partial<PrintSize>) => set({ size: { ...choice.size, ...change } });
  const preset = presetOf(choice.size);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Print size</span>
        <select
          className={SELECT_CLASS}
          value={preset ? preset.label : CUSTOM}
          onChange={(event) => {
            const picked = PRESET_SIZES.find((p) => p.label === event.target.value);
            if (picked) setSize({ width: picked.width, height: picked.height, unit: picked.unit });
          }}
        >
          {PRESET_SIZES.map((p) => (
            <option key={p.label} value={p.label}>
              {p.label}
            </option>
          ))}
          <option value={CUSTOM}>Custom</option>
        </select>
      </label>
      <div className="flex items-end gap-2">
        <LengthField
          label="Width"
          value={choice.size.width}
          onChange={(width) => setSize({ width })}
        />
        <span className="text-muted-foreground pb-1.5">×</span>
        <LengthField
          label="Height"
          value={choice.size.height}
          onChange={(height) => setSize({ height })}
        />
      </div>
      <div className={CONTROL_FRAME} role="group" aria-label="Unit">
        {UNITS.map((unit) => (
          <button
            key={unit}
            type="button"
            aria-pressed={choice.size.unit === unit}
            className={controlButtonClass(choice.size.unit === unit)}
            onClick={() => setSize({ unit })}
          >
            {unit}
          </button>
        ))}
      </div>
      <div className={CONTROL_FRAME} role="group" aria-label="How the photo meets the paper">
        {FITS.map((fit) => (
          <button
            key={fit.value}
            type="button"
            aria-pressed={choice.fit === fit.value}
            className={controlButtonClass(choice.fit === fit.value)}
            onClick={() => set({ fit: fit.value })}
          >
            {fit.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LengthField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        className="h-8 w-20"
        value={value > 0 ? value : ""}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}
