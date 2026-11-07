import { Camera, ChevronDown, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { CameraPickerPart } from "@portfolio/components/camera-picker-parts";
import { RANGE_LABELS, spanText } from "@portfolio/components/camera-ranges";
import { FilterCount } from "@portfolio/components/photo-filters";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { Button } from "@portfolio/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@portfolio/components/ui/popover";
import {
  type CameraFilters,
  type EquipmentKey,
  type RangeKey,
} from "@portfolio/lib/camera-filters";
import { equipmentChoices } from "@portfolio/lib/camera-picker";
import type { BlockerSource } from "@portfolio/lib/camera-blockers";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";

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
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="font-normal">
          <Camera className="text-muted-foreground" aria-hidden />
          Gear & settings
          <FilterCount count={setCount(props.filters)} />
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-[min(34rem,calc(100vw-2rem))] p-0"
      >
        <PickerBody {...props} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * The list of sections on the left and the chosen section's choices on the right. On phones the
 * list folds up above the choices instead, behind a button naming the chosen section.
 */
function PickerBody(props: CameraPickerProps) {
  const [section, setSection] = useState<CameraSection>(() => firstSet(props.filters));
  const [listOpen, setListOpen] = useState(false);
  const choose = (next: CameraSection) => {
    setSection(next);
    setListOpen(false);
  };
  return (
    <div className="flex max-h-[min(28rem,calc(var(--radix-popover-content-available-height)-1rem))] flex-col sm:flex-row">
      <ListToggle
        section={section}
        open={listOpen}
        onClick={() => setListOpen(!listOpen)}
        {...props}
      />
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Gear and settings"
        className={cn(
          "flex shrink-0 flex-col gap-0.5 overflow-y-auto border-b bg-muted/40 p-1 sm:w-40 sm:border-r sm:border-b-0",
          !listOpen && "max-sm:hidden",
        )}
      >
        {SECTIONS.map(([key, label]) => (
          <SectionTab
            key={key}
            section={key}
            label={label}
            chosen={section === key}
            onClick={() => choose(key)}
            {...props}
          />
        ))}
      </div>
      <div role="tabpanel" className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
        <CameraPickerPart section={section} {...props} />
      </div>
    </div>
  );
}

/** The section's name, as the left list shows it. */
function sectionLabel(section: CameraSection): string {
  return SECTIONS.find(([key]) => key === section)?.[1] ?? "";
}

/**
 * On phones only, the button that opens and closes the list of sections, naming the chosen one
 * and what it's set to.
 */
function ListToggle({
  section,
  open,
  onClick,
  ...props
}: CameraPickerProps & { section: CameraSection; open: boolean; onClick: () => void }) {
  const setText = useSetText(section, props);
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-left text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:hidden"
    >
      <span className="font-medium">{sectionLabel(section)}</span>
      <span className="truncate text-xs text-muted-foreground">{setText ?? "Any"}</span>
      <ChevronDown
        aria-hidden
        className={cn("ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
      />
    </button>
  );
}

/** Whether the section is the camera or the lens, rather than a camera setting. */
function isEquipment(section: CameraSection): section is EquipmentKey {
  return section === "camera" || section === "lens";
}

/** What a section is set to, such as "X-T5" or "f/2 – f/4", or undefined while it isn't. */
function useSetText(section: CameraSection, { photos, filters }: CameraPickerProps) {
  const { script } = useScriptDisplay();
  if (!isSet(section, filters)) return undefined;
  if (isEquipment(section)) return equipmentChoices(section, photos, filters).chosen?.label[script];
  return spanText(section, filters[section] ?? "");
}

/** A section in the left list: its name, with what it's set to under it and a dot while it's set. */
function SectionTab({
  section,
  label,
  chosen,
  onClick,
  ...props
}: CameraPickerProps & {
  section: CameraSection;
  label: string;
  chosen: boolean;
  onClick: () => void;
}) {
  const setText = useSetText(section, props);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={chosen}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start rounded-sm px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50",
        chosen && "bg-background shadow-xs",
      )}
    >
      <span className="flex w-full items-center gap-1.5 font-medium">
        {label}
        {setText !== undefined && (
          <span className="ml-auto size-1.5 rounded-full bg-primary" aria-label="(set)" />
        )}
      </span>
      <span className="w-full truncate text-xs text-muted-foreground">{setText ?? "Any"}</span>
    </button>
  );
}
