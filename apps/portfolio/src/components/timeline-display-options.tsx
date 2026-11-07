import {
  OptionCheckbox,
  OptionChoices,
  OptionGroup,
  ViewOptionsButton,
} from "@/components/view-options-button";
import {
  DEFAULT_TIMELINE_DISPLAY,
  THUMB_SIZES,
  TICK_CHOICES,
  type TimelineDisplay,
} from "@/lib/timeline-display";

/**
 * The **Display Options** button at the right of the Timeline's search row that opens its display
 * options: how big the thumbnails are and whether the scrubber marks months or days, beside whether
 * each photo shows its technical info, comment and place, and whether each month's trip line maps
 * start open.
 */
export function TimelineDisplayOptions({
  display,
  onChange,
}: {
  display: TimelineDisplay;
  onChange: (change: Partial<TimelineDisplay>) => void;
}) {
  return (
    <ViewOptionsButton
      align="end"
      onReset={() => onChange(DEFAULT_TIMELINE_DISPLAY)}
      choices={
        <>
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
        </>
      }
      checks={
        <>
          <OptionGroup label="Each photo">
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
          </OptionGroup>
          <OptionGroup label="Each month">
            <OptionCheckbox
              label="Open trip line maps"
              checked={display.maps}
              onChange={(maps) => onChange({ maps })}
            />
          </OptionGroup>
        </>
      }
    />
  );
}
