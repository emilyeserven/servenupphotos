import { AddRowButton, RemoveRowButton } from "@/components/caption-templates/row-buttons";
import { SectionTitle } from "@/components/section-title";
import { Input } from "@/components/ui/input";
import type { PlaceReplacement } from "@/lib/caption-place-form";
import { count } from "@portfolio/lib/words";

interface PlaceReplacementsProps {
  replacements: PlaceReplacement[];
  /** What each photo's place name is before the exceptions, to count the photos each one changes. */
  names: string[];
  onChange: (replacements: PlaceReplacement[]) => void;
}

/**
 * The place name builder's **Exceptions**: text in a place name swapped for other text, such as
 * "United States of America" for "USA", each with how many photos' place names it changes.
 */
export function PlaceReplacements({ replacements, names, onChange }: PlaceReplacementsProps) {
  const change = (i: number, part: Partial<PlaceReplacement>) =>
    onChange(replacements.map((r, j) => (j === i ? { ...r, ...part } : r)));
  return (
    <div className="flex flex-col gap-2">
      <SectionTitle>Exceptions</SectionTitle>
      <p className="text-muted-foreground text-xs">
        Text in the place name these forms make is swapped for other text, in order, such as United
        States of America for USA.
      </p>
      {replacements.map((r, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <Input
            className="w-56"
            value={r.from}
            placeholder="United States of America"
            aria-label="Text to replace"
            onChange={(e) => change(i, { from: e.target.value })}
          />
          <span className="text-muted-foreground text-sm">becomes</span>
          <Input
            className="w-40"
            value={r.to}
            placeholder="USA"
            aria-label="Replacement"
            onChange={(e) => change(i, { to: e.target.value })}
          />
          <span className="text-muted-foreground text-xs">
            {r.from ? `In ${count(names.filter((n) => n.includes(r.from)).length, "photo")}` : ""}
          </span>
          <RemoveRowButton
            label="Remove this exception"
            onClick={() => onChange(replacements.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <AddRowButton
        label="Add an exception"
        onClick={() => onChange([...replacements, { from: "", to: "" }])}
      />
    </div>
  );
}
