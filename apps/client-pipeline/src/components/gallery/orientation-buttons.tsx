import { useNavigate, useSearch } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ORIENTATION_KEY, ORIENTATIONS, type Orientation } from "@portfolio/lib/orientation";

/** Each choice's name: any orientation, then each one. */
const CHOICES: [Orientation | undefined, string][] = [
  [undefined, "All"],
  ...ORIENTATIONS.map((o): [Orientation, string] => [o, o[0]!.toUpperCase() + o.slice(1)]),
];

/**
 * A quick **Orientation** filter as a row of buttons: All, Horizontal, Vertical, Square. It sets
 * the same `?orientation=` the Grid filters' Visuals picker does, so the two always agree.
 */
export function OrientationButtons() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const value = search[ORIENTATION_KEY];
  const set = (orientation: Orientation | undefined) =>
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({ ...prev, [ORIENTATION_KEY]: orientation }),
    });
  return (
    <div role="radiogroup" aria-label="Orientation" className="flex flex-wrap gap-1">
      {CHOICES.map(([orientation, label]) => (
        <Button
          key={label}
          size="sm"
          role="radio"
          aria-checked={orientation === value}
          variant={orientation === value ? "secondary" : "outline"}
          onClick={() => set(orientation)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
