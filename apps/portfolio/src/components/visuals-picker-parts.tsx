import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ColorFilter } from "@portfolio/components/color-filter";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { ShareThreshold } from "@portfolio/components/color-match-control";
import { OrientationFilter } from "@portfolio/components/orientation-filter";
import { type PickerInfo, PickerPart } from "@portfolio/components/section-picker";
import { VividnessControl } from "@portfolio/components/vividness-control";
import {
  type ColorFilters,
  countsFor,
  DEFAULT_PERCENT,
  filterByColors,
  matchOf,
  vividEnough,
} from "@portfolio/lib/color-search";
import {
  matchesOrientation,
  ORIENTATION_KEY,
  type Orientation,
  orientationCounts,
} from "@portfolio/lib/orientation";
import type { Photo } from "@portfolio/lib/photos";

/** One section of the Visuals picker: the color, how a photo matches it, vividness or orientation. */
export type VisualSection = "color" | "match" | "vivid" | "orientation";

/** The filters the Visuals picker reads: the color filters and the photo's orientation. */
export type VisualFilters = ColorFilters & { orientation?: string };

/** What the Visuals picker reads, and the photos its counts are out of. */
export interface VisualsPickerProps {
  /** What the other filters leave, before the color and orientation filters. */
  photos: Photo[];
  filters: VisualFilters;
}

/** A section's controls, with its (i) button when it has more to say. */
type PartProps = VisualsPickerProps & { info: PickerInfo };

/** The right side of the Visuals picker: the chosen section's controls. */
export function VisualsPickerPart({ section, ...props }: PartProps & { section: VisualSection }) {
  return PARTS[section](props);
}

/**
 * What each choice of a section does, for the panel its (i) button opens on the right; the
 * sections left out have no (i) button.
 */
export const VISUAL_INFO: Partial<Record<VisualSection, ReactNode>> = {
  match: <MatchChoices />,
  vivid: <VividChoices />,
};

const PARTS: Record<VisualSection, (props: PartProps) => ReactNode> = {
  color: (props) => <ColorPart {...props} />,
  match: (props) => <MatchPart {...props} />,
  vivid: (props) => <VividPart {...props} />,
  orientation: (props) => <OrientationPart {...props} />,
};

/** The swatches, each with how many photos of the chosen orientation it would show. */
function ColorPart({ photos, filters }: VisualsPickerProps) {
  const pool = photos.filter((photo) => matchesOrientation(photo, filters.orientation));
  return (
    <PickerPart intro="Pick a color to show only the photos with much of it. Pick it again to clear it.">
      <ColorFilter
        color={filters.color}
        counts={countsFor(vividEnough(pool, filters), matchOf(filters))}
      />
    </PickerPart>
  );
}

/** How a photo matches the picked color: a list of Largest only and At least…, with its slider. */
function MatchPart({ filters, info }: PartProps) {
  const threshold = matchOf(filters).mode === "threshold";
  const navigate = useNavigate();
  const set = (match: "threshold" | undefined) =>
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({ ...prev, match, photo: undefined }),
      replace: true,
    });
  return (
    <PickerPart intro="How much of the picked color a photo needs to show." info={info}>
      <div role="group" aria-label="How photos match the color" className="-mx-2 flex flex-col">
        <ChoiceRow label="Largest only" on={!threshold} onClick={() => set(undefined)} />
        <ChoiceRow label="At least…" on={threshold} onClick={() => set("threshold")} />
      </div>
      {threshold && (
        <ShareThreshold percent={filters.min ?? DEFAULT_PERCENT} fallback={DEFAULT_PERCENT} />
      )}
    </PickerPart>
  );
}

/** What Largest only and At least… do, behind the Color threshold's (i) button. */
function MatchChoices() {
  return (
    <Choices
      items={[
        [
          "Largest only",
          "The picked color is the biggest share of the photo. A blue sky over a green field shows under whichever covers more.",
        ],
        [
          "At least…",
          "The picked color covers at least the share you set, even when another color is bigger. A photo can show under several colors this way.",
        ],
      ]}
    />
  );
}

/** Which vividness to measure and the least a photo needs, with what each choice does. */
function VividPart({ filters, info }: PartProps) {
  return (
    <PickerPart
      intro="How colorful a photo needs to be, from 0 (every photo, grays too) up to 100. An ordinary colorful photo averages about 20 to 30."
      info={info}
    >
      <VividnessControl vivid={filters.vivid ?? 0} measure={filters.measure ?? "average"} />
    </PickerPart>
  );
}

/** What Average and Peak do, behind the Vividness (i) button. */
function VividChoices() {
  return (
    <Choices
      items={[
        ["Average", "How vivid the whole photo is. Muted photos with a little color score low."],
        [
          "Peak",
          "How vivid its most vivid tenth is, so a gray street with one bright red sign still scores high.",
        ],
      ]}
    />
  );
}

/** The Horizontal, Vertical and Square choices, each counting the photos the color filters leave. */
function OrientationPart({ photos, filters }: VisualsPickerProps) {
  const navigate = useNavigate();
  const set = (orientation: Orientation | undefined) =>
    void navigate({
      to: ".",
      resetScroll: false,
      search: (prev: Record<string, unknown>) => ({ ...prev, [ORIENTATION_KEY]: orientation }),
    });
  return (
    <PickerPart intro="Show only the photos wider than they're tall, taller than they're wide, or square. Pick it again to clear it.">
      <OrientationFilter
        orientation={filters.orientation}
        counts={orientationCounts(filterByColors(photos, filters))}
        onChange={set}
      />
    </PickerPart>
  );
}

/** What each of a control's choices does, as a short list under it. */
function Choices({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-3 text-xs">
      {items.map(([name, text]) => (
        <div key={name}>
          <dt className="font-medium">{name}</dt>
          <dd className="text-muted-foreground">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
