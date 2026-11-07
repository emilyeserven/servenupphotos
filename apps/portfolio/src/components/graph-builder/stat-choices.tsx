import { ChoiceRow } from "@portfolio/components/choice-row";
import { statsBySection } from "@portfolio/components/graph-builder/graph-field";

/**
 * The stats to pick from in a graph picker, under the sections they're in, such as Gear: the one
 * picked checked, the ones in `leaveOut` left out, and first `none` (such as "Nothing") when given,
 * which picks "".
 */
export function StatChoices({
  value,
  leaveOut = [],
  none,
  onPick,
}: {
  value: string;
  leaveOut?: string[];
  none?: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      {none && <ChoiceRow label={none} on={value === ""} onClick={() => onPick("")} />}
      {statsBySection().map(([section, stats]) => (
        <div key={section} role="group" aria-label={section} className="flex flex-col">
          <span className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
            {section}
          </span>
          {stats
            .filter((stat) => !leaveOut.includes(stat.id))
            .map((stat) => (
              <ChoiceRow
                key={stat.id}
                label={stat.label}
                on={value === stat.id}
                onClick={() => onPick(stat.id)}
              />
            ))}
        </div>
      ))}
    </>
  );
}
