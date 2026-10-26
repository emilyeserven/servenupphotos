import { PinDisplayFields } from "@/components/pin-display-fields";
import { ViewOptionsButton } from "@/components/view-options-button";
import { DEFAULT_MAP_DISPLAY, type MapDisplay } from "@/lib/map-display";

/**
 * An eye button over the map that opens its display options in a flyout: how readily photos are
 * grouped, how big the pins are, whether groups show their counts, and whether a group's photos
 * are darkened under the count.
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
    </ViewOptionsButton>
  );
}
