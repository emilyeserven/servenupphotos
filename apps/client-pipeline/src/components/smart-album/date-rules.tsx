import { allTimelineLabels, type TimelineLabel } from "@portfolio/lib/timeline-labels";
import type { RuleParams } from "@/components/smart-album/rule-params";
import { SingleCombobox } from "@/components/ui/single-combobox";
import { DatePicker } from "@/components/date-picker";

/** The text of a rule, or "" when it isn't set. */
function textRule(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The rules a Smart Album has besides the Grid's filters: a Trip whose days its photos
 * were taken on, and the first and last days, by the clock where each photo was taken.
 */
export function DateRules({ rules, labels }: { rules: RuleParams; labels: TimelineLabel[] }) {
  const set = (key: string, value: string) => rules.set({ [key]: value || undefined });
  const options = allTimelineLabels(labels).map((label) => ({
    value: label.id,
    label: label.name,
    detail: `${label.start} to ${label.end}`,
  }));
  return (
    <div className="grid gap-3 text-sm sm:grid-cols-3">
      <div className="flex flex-col gap-1.5">
        <span id="smart-label" className="font-medium">
          Trip
        </span>
        <SingleCombobox
          aria-labelledby="smart-label"
          options={options}
          value={textRule(rules.draft.label)}
          placeholder="Any day"
          emptyText="No Trips match."
          onChange={(id) => set("label", id)}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Taken on or after</span>
        <DatePicker value={textRule(rules.draft.from)} onChange={(day) => set("from", day)} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Taken on or before</span>
        <DatePicker
          value={textRule(rules.draft.to)}
          min={textRule(rules.draft.from)}
          onChange={(day) => set("to", day)}
        />
      </label>
    </div>
  );
}
