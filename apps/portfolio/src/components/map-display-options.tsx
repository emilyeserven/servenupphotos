import { PinChoiceFields, PinGroupChecks } from "@/components/pin-display-fields";
import {
  OptionCheckbox,
  OptionChoices,
  OptionGroup,
  ViewOptionsButton,
} from "@/components/view-options-button";
import { DEFAULT_MAP_DISPLAY, type GroupPhotos, type MapDisplay } from "@/lib/map-display";

/** The choices for which photos a group's marker shows, with their labels. */
const GROUP_PHOTOS: [GroupPhotos, string][] = [
  ["added", "Added"],
  ["taken", "Captured"],
];

/**
 * An eye button over the map that opens its display options in a flyout: how readily photos are
 * grouped, how big the pins are, whether groups show their counts, and whether a group's photos
 * are darkened under the count, which of a group's photos it shows, and whether the days' trip lines
 * are drawn, with a light running along them the way they were travelled.
 */
export function MapDisplayOptions({
  display,
  onChange,
}: {
  display: MapDisplay;
  onChange: (change: Partial<MapDisplay>) => void;
}) {
  return (
    // Eye only: the map's floating controls have no room for words.
    <ViewOptionsButton
      iconOnly
      onReset={() => onChange(DEFAULT_MAP_DISPLAY)}
      choices={
        <>
          <PinChoiceFields
            display={display}
            defaultGrouping={DEFAULT_MAP_DISPLAY.grouping}
            onChange={onChange}
          />
          <OptionChoices
            label="Groups show the latest"
            choices={GROUP_PHOTOS}
            value={display.groupPhotos}
            onChange={(groupPhotos) => onChange({ groupPhotos })}
          />
        </>
      }
      checks={
        <>
          <PinGroupChecks display={display} onChange={onChange} />
          <OptionGroup label="Trip lines">
            <OptionCheckbox
              label="Show trip lines"
              checked={display.tripLines}
              onChange={(tripLines) => onChange({ tripLines })}
            />
            {display.tripLines && (
              <OptionCheckbox
                label="Direction of travel"
                checked={display.tripFlow}
                onChange={(tripFlow) => onChange({ tripFlow })}
              />
            )}
          </OptionGroup>
        </>
      }
    />
  );
}
