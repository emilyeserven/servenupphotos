import { useId } from "react";
import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import {
  DEFAULT_TIMELINE_DISPLAY,
  THUMB_SIZES,
  TICK_CHOICES,
  type TimelineDisplay,
} from "@/lib/timeline-display";

/**
 * The **Display Options** button at the right of the Timeline's search row that opens its display options: how big the thumbnails
 * are, whether each photo shows its technical info, comment and place, and whether the scrubber
 * marks months or days. Its flyout is wide, with the choices in one column and the checkboxes in
 * another, stacking on a phone.
 */
export function TimelineDisplayOptions({
  display,
  onChange,
}: {
  display: TimelineDisplay;
  onChange: (change: Partial<TimelineDisplay>) => void;
}) {
  const detailsId = useId();
  return (
    <ViewOptionsButton
      label="Display Options"
      labelled
      align="end"
      onReset={() => onChange(DEFAULT_TIMELINE_DISPLAY)}
      contentClassName="w-auto max-w-[calc(100vw-2rem)]"
    >
      <div className="grid gap-4 sm:grid-cols-[auto_auto] sm:gap-8">
        <div className="flex flex-col gap-4">
          <OptionChoices
            label="Thumbnail size"
            choices={THUMB_SIZES}
            value={display.thumbs}
            onChange={(thumbs) => onChange({ thumbs })}
          />
          <OptionChoices
            label="Scrubber ticks"
            choices={TICK_CHOICES}
            value={display.ticks}
            onChange={(ticks) => onChange({ ticks })}
          />
        </div>
        <div className="flex flex-col gap-2" role="group" aria-labelledby={detailsId}>
          <span id={detailsId} className="text-xs font-medium text-muted-foreground">
            Each photo
          </span>
          <OptionCheckbox
            label="Show technical info"
            checked={display.tech}
            onChange={(tech) => onChange({ tech })}
          />
          <OptionCheckbox
            label="Show comments"
            checked={display.comments}
            onChange={(comments) => onChange({ comments })}
          />
          <OptionCheckbox
            label="Show places"
            checked={display.places}
            onChange={(places) => onChange({ places })}
          />
        </div>
      </div>
    </ViewOptionsButton>
  );
}
