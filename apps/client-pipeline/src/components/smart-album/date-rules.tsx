import { allTimelineLabels, type TimelineLabel } from "@portfolio/lib/timeline-labels";
import type { RuleParams } from "@/components/smart-album/rule-params";
import { Input } from "@/components/ui/input";
import { SingleCombobox } from "@/components/ui/single-combobox";

/** The text of a rule, or "" when it isn't set. */
function textRule(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The rules a Smart Album has besides the Grid's filters: a timeline label whose days its photos
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
          Timeline label
        </span>
        <SingleCombobox
          aria-labelledby="smart-label"
          options={options}
          value={textRule(rules.draft.label)}
          placeholder="Any day"
          emptyText="No timeline labels match."
          onChange={(id) => set("label", id)}
        />
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Taken on or after</span>
        <Input
          type="date"
          value={textRule(rules.draft.from)}
          onChange={(e) => set("from", e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">Taken on or before</span>
        <Input
          type="date"
          value={textRule(rules.draft.to)}
          min={textRule(rules.draft.from)}
          onChange={(e) => set("to", e.target.value)}
        />
      </label>
    </div>
  );
}
