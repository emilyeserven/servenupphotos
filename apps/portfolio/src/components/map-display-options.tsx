import { PinDisplayFields } from "@/components/pin-display-fields";
import { OptionChoices, ViewOptionsButton } from "@/components/view-options-button";
import { DEFAULT_MAP_DISPLAY, type GroupPhotos, type MapDisplay } from "@/lib/map-display";

/** The choices for which photos a group's marker shows, with their labels. */
const GROUP_PHOTOS: [GroupPhotos, string][] = [
  ["added", "Added"],
  ["taken", "Captured"],
];

/**
 * An eye button over the map that opens its display options in a flyout: how readily photos are
 * grouped, how big the pins are, whether groups show their counts, and whether a group's photos
 * are darkened under the count, and which of a group's photos it shows.
 */
export function MapDisplayOptions({
  display,
  onChange,
}: {
  display: MapDisplay;
  onChange: (change: Partial<MapDisplay>) => void;
}) {
  return (
    <ViewOptionsButton onReset={() => onChange(DEFAULT_MAP_DISPLAY)}>
      <PinDisplayFields
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
    </ViewOptionsButton>
  );
}
