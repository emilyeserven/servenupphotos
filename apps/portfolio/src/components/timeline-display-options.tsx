import { OptionCheckbox, OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import {
  DEFAULT_TIMELINE_DISPLAY,
  THUMB_SIZES,
  TICK_CHOICES,
  type TimelineDisplay,
} from "@/lib/timeline-display";

/**
 * The eye button in the Timeline's header that opens its display options: how big the thumbnails
 * are, whether each photo shows its technical info, comment and place, and whether the scrubber
 * marks months or days.
 */
export function TimelineDisplayOptions({
  display,
  onChange,
}: {
  display: TimelineDisplay;
  onChange: (change: Partial<TimelineDisplay>) => void;
}) {
  return (
    <ViewOptionsButton onReset={() => onChange(DEFAULT_TIMELINE_DISPLAY)} contentClassName="w-72">
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
      <div className="flex flex-col gap-2">
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
    </ViewOptionsButton>
  );
}
