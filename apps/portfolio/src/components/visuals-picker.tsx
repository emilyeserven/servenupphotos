import { useNavigate } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { useState } from "react";
import {
  FilterPickerButton,
  PickerClear,
  SectionPicker,
} from "@portfolio/components/section-picker";
import {
  type VisualFilters,
  type VisualSection,
  VISUAL_INFO,
  VisualsPickerPart,
  type VisualsPickerProps,
} from "@portfolio/components/visuals-picker-parts";
import { COLOR_FILTER_KEYS, colorFilterCount, DEFAULT_PERCENT } from "@portfolio/lib/color-search";
import { ORIENTATION_KEY } from "@portfolio/lib/orientation";
import { type ColorName, colorLabel, colorSwatch, isShade } from "@portfolio/lib/photo-colors";
import type { OwnFilters } from "@portfolio/components/photo-filters";
import type { Photo } from "@portfolio/lib/photos";
import { cn } from "@portfolio/lib/utils";

/** The URL keys the Visuals picker sets: the color filters and the orientation. */
const VISUAL_FILTER_KEYS = [...COLOR_FILTER_KEYS, ORIENTATION_KEY] as const;

/** How many of the Visuals picker's filters are set: the color, the vividness and the orientation. */
function visualFilterCount(filters: VisualFilters): number {
  return colorFilterCount(filters) + Number(Boolean(filters.orientation));
}

/** What each section of the picker is set to, shown under its name in the left list. */
const SECTIONS: [VisualSection, string, (filters: VisualFilters) => string][] = [
  ["color", "Color", ({ color }) => (color ? colorLabel(color) : "Any")],
  ["match", "Color threshold", matchText],
  ["vivid", "Vividness", vividText],
  ["orientation", "Orientation", orientationText],
];

/** How photos match the color: "Largest only", or a share such as "At least 30%". */
function matchText({ match, min = DEFAULT_PERCENT }: VisualFilters): string {
  return match === "threshold" ? `At least ${min}%` : "Largest only";
}

/** The vividness measure and the least a photo needs, such as "Peak · 40+". */
function vividText({ vivid, measure = "average" }: VisualFilters): string {
  const name = measure === "peak" ? "Peak" : "Average";
  return vivid ? `${name} · ${vivid}+` : `${name} · any`;
}

/** The orientation chosen, such as "Vertical", or "Any". */
function orientationText({ orientation }: VisualFilters): string {
  return orientation ? orientation.charAt(0).toUpperCase() + orientation.slice(1) : "Any";
}

/** The sections the picker opens on, in order: the first one set, or the color. */
const OPEN_ORDER: [VisualSection, (filters: VisualFilters) => unknown][] = [
  ["color", (filters) => filters.color],
  ["vivid", (filters) => filters.vivid],
  ["orientation", (filters) => filters.orientation],
];

/** The section to open the picker on: the first one set, or the color. */
function firstSection(filters: VisualFilters): VisualSection {
  return OPEN_ORDER.find(([, isSet]) => isSet(filters))?.[0] ?? "color";
}

/**
 * The Grid's **Visuals** filter, a button like **When** and **Gear & settings** that opens a
 * picker: a list of Color, Color threshold, Vividness and Orientation on the left, each saying what it's set
 * to, with **Clear visuals** under it, and the chosen one's controls on the right, with what each
 * choice does. The button shows the picked color and how many of its filters are set. `photos` is
 * what the other filters leave, before the color and orientation filters, which the counts are out of.
 */
export function VisualsPicker(props: VisualsPickerProps) {
  return (
    <FilterPickerButton
      Icon={Palette}
      label="Visuals"
      count={visualFilterCount(props.filters)}
      badge={<PickedDot color={props.filters.color} />}
    >
      <PickerBody {...props} />
    </FilterPickerButton>
  );
}

/**
 * The **Visuals** picker as a view's own filters in the filter bar, for the Timeline and the Map:
 * its keys for **Clear filters**, how many of its filters are set, and the picker. `photos` is what
 * the other filters leave, which its counts are out of.
 */
export function visualsOwnFilters(photos: Photo[], filters: VisualFilters): OwnFilters {
  return {
    keys: VISUAL_FILTER_KEYS,
    count: visualFilterCount(filters),
    children: <VisualsPicker photos={photos} filters={filters} />,
  };
}

/** A small dot of the picked color in the button, so it shows while the picker is closed. */
function PickedDot({ color }: { color: ColorName | undefined }) {
  if (!color) return null;
  return (
    <span
      title={colorLabel(color)}
      className={cn("size-3 rounded-full", isShade(color) && "ring-1 ring-border")}
      style={{ backgroundColor: colorSwatch(color) }}
    />
  );
}

/**
 * The sections, opening on the first one set, with **Clear visuals** under them. While the (i)
 * button is on, a section with more to say, such as Color threshold, shows it in a panel to the
 * right, which widens the picker.
 */
function PickerBody(props: VisualsPickerProps) {
  const [section, setSection] = useState<VisualSection>(() => firstSection(props.filters));
  const [infoOpen, setInfoOpen] = useState(false);
  const aside = infoOpen ? VISUAL_INFO[section] : undefined;
  return (
    <SectionPicker
      label="Visual filters"
      sections={SECTIONS.map(([key, label, text]) => ({ key, label, text: text(props.filters) }))}
      chosen={section}
      onChoose={setSection}
      width={aside ? "sm:w-[46rem]" : "sm:w-[32rem]"}
      footer={<ClearVisuals filters={props.filters} />}
      aside={aside}
    >
      <VisualsPickerPart
        section={section}
        info={{ open: infoOpen, onToggle: () => setInfoOpen(!infoOpen) }}
        {...props}
      />
    </SectionPicker>
  );
}

/** An X under the list clearing every visual filter, shown while any is set. */
function ClearVisuals({ filters }: { filters: VisualFilters }) {
  const navigate = useNavigate();
  if (visualFilterCount(filters) === 0) return null;
  const clear = () =>
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        ...Object.fromEntries(VISUAL_FILTER_KEYS.map((key) => [key, undefined])),
      }),
      replace: true,
    });
  return <PickerClear text="Clear visuals" label="Visuals" onClear={clear} />;
}
