import { GearInfo } from "@portfolio/components/gear-info";
import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";

/** What each equipment list's info pane says while no camera or lens by name is pointed at or chosen. */
const EMPTY_TEXT: Record<EquipmentKey, string> = {
  camera: "Point at a camera to see more about it.",
  lens: "Point at a lens to see more about it.",
};

/** Each pane's name for screen readers. */
const PANE_LABELS: Record<EquipmentKey, string> = {
  camera: "About the camera",
  lens: "About the lens",
};

/**
 * The Cameras' or Lenses' info pane, in the picker's panel to the right of the list while (i) is
 * on: the details of the camera or lens pointed at, or else the chosen one. A group, such as a
 * brand, has none.
 */
export function EquipmentInfoPane({
  equipment,
  option,
}: {
  equipment: EquipmentKey;
  /** The choice pointed at, or else the chosen one. */
  option?: FilterOption;
}) {
  return (
    <aside aria-label={PANE_LABELS[equipment]} className="flex flex-col">
      <PaneContent equipment={equipment} option={option} />
    </aside>
  );
}

/** A camera's or lens's details, when the option is one by name, or else a note saying to point at one. */
function PaneContent({ equipment, option }: { equipment: EquipmentKey; option?: FilterOption }) {
  if (option?.key !== equipment) {
    return <p className="text-xs text-muted-foreground">{EMPTY_TEXT[equipment]}</p>;
  }
  return <GearInfo kind={equipment} name={option.value} />;
}
