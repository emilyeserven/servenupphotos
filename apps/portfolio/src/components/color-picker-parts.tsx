import type { ReactNode } from "react";
import { ColorFilter } from "@portfolio/components/color-filter";
import { ColorMatchControl } from "@portfolio/components/color-match-control";
import { VividnessControl } from "@portfolio/components/vividness-control";
import {
  type ColorFilters,
  countsFor,
  DEFAULT_PERCENT,
  matchOf,
  vividEnough,
} from "@portfolio/lib/color-search";
import type { Photo } from "@portfolio/lib/photos";

/** One section of the Colors picker: the color, how a photo matches it, or the least vividness. */
export type ColorSection = "color" | "match" | "vivid";

/** What the Colors picker reads, and the photos its counts are out of. */
export interface ColorPickerProps {
  photos: Photo[];
  filters: ColorFilters;
}

/** The right side of the Colors picker: the chosen section's controls. */
export function ColorPickerPart({
  section,
  ...props
}: ColorPickerProps & { section: ColorSection }) {
  return PARTS[section](props);
}

const PARTS: Record<ColorSection, (props: ColorPickerProps) => ReactNode> = {
  color: (props) => <ColorPart {...props} />,
  match: (props) => <MatchPart {...props} />,
  vivid: (props) => <VividPart {...props} />,
};

/** The swatches, each with how many photos it would show. */
function ColorPart({ photos, filters }: ColorPickerProps) {
  return (
    <Part intro="Pick a color to show only the photos with much of it. Pick it again to clear it.">
      <ColorFilter
        color={filters.color}
        counts={countsFor(vividEnough(photos, filters), matchOf(filters))}
      />
    </Part>
  );
}

/** How a photo matches the picked color, with what each choice does. */
function MatchPart({ filters }: ColorPickerProps) {
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
            "Largest color",
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
function VividPart({ filters }: ColorPickerProps) {
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

/** A section's controls, with a line under its name saying what it's for. */
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
