import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ColorFilter } from "@portfolio/components/color-filter";
import { ColorMatchControl } from "@portfolio/components/color-match-control";
import { OrientationFilter } from "@portfolio/components/orientation-filter";
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

/** The right side of the Visuals picker: the chosen section's controls. */
export function VisualsPickerPart({
  section,
  ...props
}: VisualsPickerProps & { section: VisualSection }) {
  return PARTS[section](props);
}

const PARTS: Record<VisualSection, (props: VisualsPickerProps) => ReactNode> = {
  color: (props) => <ColorPart {...props} />,
  match: (props) => <MatchPart {...props} />,
  vivid: (props) => <VividPart {...props} />,
  orientation: (props) => <OrientationPart {...props} />,
};

/** The swatches, each with how many photos of the chosen orientation it would show. */
function ColorPart({ photos, filters }: VisualsPickerProps) {
  const pool = photos.filter((photo) => matchesOrientation(photo, filters.orientation));
  return (
    <Part intro="Pick a color to show only the photos with much of it. Pick it again to clear it.">
      <ColorFilter
        color={filters.color}
        counts={countsFor(vividEnough(pool, filters), matchOf(filters))}
      />
    </Part>
  );
}

/** How a photo matches the picked color, with what each choice does. */
function MatchPart({ filters }: VisualsPickerProps) {
  return (
    <Part intro="How much of the picked color a photo needs to show.">
      <ColorMatchControl
        threshold={matchOf(filters).mode === "threshold"}
        percent={filters.min ?? DEFAULT_PERCENT}
        fallback={DEFAULT_PERCENT}
      />
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
    </Part>
  );
}

/** Which vividness to measure and the least a photo needs, with what each choice does. */
function VividPart({ filters }: VisualsPickerProps) {
  return (
    <Part intro="How colorful a photo needs to be, from 0 (every photo, grays too) up to 100. An ordinary colorful photo averages about 20 to 30.">
      <VividnessControl vivid={filters.vivid ?? 0} measure={filters.measure ?? "average"} />
      <Choices
        items={[
          ["Average", "How vivid the whole photo is. Muted photos with a little color score low."],
          [
            "Peak",
            "How vivid its most vivid tenth is, so a gray street with one bright red sign still scores high.",
          ],
        ]}
      />
    </Part>
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
    <Part intro="Show only the photos wider than they're tall, taller than they're wide, or square. Pick it again to clear it.">
      <OrientationFilter
        orientation={filters.orientation}
        counts={orientationCounts(filterByColors(photos, filters))}
        onChange={set}
      />
    </Part>
  );
}

/** A section's controls, with a line saying what it's for. */
function Part({ intro, children }: { intro: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{intro}</p>
      {children}
    </div>
  );
}

/** What each of a control's choices does, as a short list under it. */
function Choices({ items }: { items: [string, string][] }) {
  return (
    <dl className="flex flex-col gap-2 border-t pt-3 text-xs">
      {items.map(([name, text]) => (
        <div key={name}>
          <dt className="font-medium">{name}</dt>
          <dd className="text-muted-foreground">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
