import { Camera } from "lucide-react";
import { useState } from "react";
import { CameraPickerPart } from "@portfolio/components/camera-picker-parts";
import { RANGE_LABELS, spanText } from "@portfolio/components/camera-ranges";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import {
  FilterPickerButton,
  type PickerSection,
  SectionPicker,
} from "@portfolio/components/section-picker";
import {
  type CameraFilters,
  type EquipmentKey,
  type RangeKey,
} from "@portfolio/lib/camera-filters";
import { equipmentChoices } from "@portfolio/lib/camera-picker";
import { useGraphicsPane } from "@portfolio/lib/use-graphics-pane";
import type { BlockerSource } from "@portfolio/lib/camera-blockers";
import type { ScriptDisplay } from "@portfolio/lib/localize";
import type { Photo } from "@portfolio/lib/photos";

/** One section of the Camera picker: the camera, the lens, or a camera setting. */
export type CameraSection = EquipmentKey | RangeKey;

/** The Camera picker's sections, in the order its list shows them. */
const SECTIONS: [CameraSection, string][] = [
  ["camera", "Cameras"],
  ["lens", "Lenses"],
  ["focalLength", RANGE_LABELS.focalLength],
  ["aperture", RANGE_LABELS.aperture],
  ["exposure", RANGE_LABELS.exposure],
  ["iso", RANGE_LABELS.iso],
];

/** What the Camera picker reads and changes, and the photos its counts are out of. */
export interface CameraPickerProps {
  photos: Photo[];
  filters: CameraFilters;
  /** The view's photos and filters, to say which filters hide a camera or lens choice. */
  source: BlockerSource;
  onChange: (next: CameraFilters) => void;
}

/** What each section's part of the picker gets: the picker's props and the graphics pane's state. */
export interface PickerPartProps extends CameraPickerProps {
  /** Whether the settings' graphics pane is shown, beside each slider. */
  graphics: boolean;
  onGraphics: (on: boolean) => void;
}

/** Whether the section has a filter set: its name or group for the camera and lens. */
function isSet(section: CameraSection, filters: CameraFilters): boolean {
  if (isEquipment(section)) return Boolean(filters[section] ?? filters[`${section}Group`]);
  return Boolean(filters[section]);
}

/** The first section with a filter set, or the cameras when none has one. */
function firstSet(filters: CameraFilters): CameraSection {
  return SECTIONS.find(([section]) => isSet(section, filters))?.[0] ?? "camera";
}

/** How many of the picker's sections have a filter set, for the button's badge. */
function setCount(filters: CameraFilters): number {
  return SECTIONS.filter(([section]) => isSet(section, filters)).length;
}

/**
 * A **Gear & settings** button that opens one picker for the camera filters, the photographer's
 * gear and how each photo was shot, like **When**: a list of
 * Cameras, Lenses, Focal length, Aperture, Exposure and ISO on the left, each saying what it's set
 * to, and the chosen one's choices on the right. Any number of them can be set at once.
 */
export function CameraPicker(props: CameraPickerProps) {
  return (
    <FilterPickerButton Icon={Camera} label="Gear & settings" count={setCount(props.filters)}>
      <PickerBody {...props} />
    </FilterPickerButton>
  );
}

/** The sections and the chosen one's choices, wider while the (i) button's info pane shows. */
function PickerBody(props: CameraPickerProps) {
  const [section, setSection] = useState<CameraSection>(() => firstSet(props.filters));
  const [graphics, setGraphics] = useGraphicsPane();
  return (
    <SectionPicker
      label="Gear and settings"
      sections={useSections(props)}
      chosen={section}
      onChoose={setSection}
      width={graphics ? "sm:w-[46rem]" : "sm:w-[34rem]"}
    >
      <CameraPickerPart section={section} graphics={graphics} onGraphics={setGraphics} {...props} />
    </SectionPicker>
  );
}

/** Whether the section is the camera or the lens, rather than a camera setting. */
function isEquipment(section: CameraSection): section is EquipmentKey {
  return section === "camera" || section === "lens";
}

/** Each section with what it's set to, such as "X-T5" or "f/2 – f/4", or "Any" while it isn't. */
function useSections(props: CameraPickerProps): PickerSection<CameraSection>[] {
  const { script } = useScriptDisplay();
  return SECTIONS.map(([key, label]) => {
    const set = isSet(key, props.filters);
    return { key, label, set, text: set ? setText(key, props, script) : "Any" };
  });
}

/** What a set section is set to, such as "X-T5" or "f/2 – f/4". */
function setText(
  section: CameraSection,
  { photos, filters }: CameraPickerProps,
  script: ScriptDisplay,
): string {
  if (!isEquipment(section)) return spanText(section, filters[section] ?? "");
  return equipmentChoices(section, photos, filters).chosen?.label[script] ?? "Any";
}
