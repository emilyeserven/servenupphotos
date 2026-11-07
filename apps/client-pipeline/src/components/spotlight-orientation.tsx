import type { SpotlightOrientation } from "@/api/organize";
import { Button } from "@/components/ui/button";

/** The choices for which photos a spotlight spot puts first, with what each does. */
const CHOICES: { value: SpotlightOrientation; label: string; hint: string }[] = [
  {
    value: "screen",
    label: "Match the screen",
    hint: "Portrait photos come first on a phone held upright, landscape photos first on wider screens.",
  },
  {
    value: "none",
    label: "Album order",
    hint: "Every screen shows the photos in the album's order, whatever their shape.",
  },
];

interface SpotlightOrientationPickerProps {
  value: SpotlightOrientation;
  disabled: boolean;
  onPick: (value: SpotlightOrientation) => void;
}

/** Picks whether a spotlight spot puts the photos that fit the screen's shape first. */
export function SpotlightOrientationPicker({
  value,
  disabled,
  onPick,
}: SpotlightOrientationPickerProps) {
  const hint = CHOICES.find((choice) => choice.value === value)?.hint;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="font-medium">Photos first</p>
      <div role="group" aria-label="Photos first" className="flex flex-wrap gap-2">
        {CHOICES.map((choice) => (
          <Button
            key={choice.value}
            size="sm"
            variant={choice.value === value ? "default" : "outline"}
            aria-pressed={choice.value === value}
            disabled={disabled}
            onClick={() => onPick(choice.value)}
          >
            {choice.label}
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  );
}
