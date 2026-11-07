import type { ReactElement } from "react";
import { ChoiceRow } from "@portfolio/components/choice-row";
import { CameraGraphic, LensGraphic } from "@portfolio/components/gear-graphics";
import { useScriptDisplay } from "@portfolio/components/script-display-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@portfolio/components/ui/tooltip";
import type { EquipmentKey } from "@portfolio/lib/camera-filters";
import type { FilterOption } from "@portfolio/lib/filter-options";
import { lensSpecs, lensUse } from "@portfolio/lib/gear-kinds";
import { photos as allPhotos } from "@portfolio/lib/photos";

/** What a hidden choice's hover says hides it, such as "Hidden by Aperture or Lens". */
function blockedText(blockedBy: string[]): string {
  if (blockedBy.length === 0) return "Hidden by the other filters together";
  return `Hidden by ${new Intl.ListFormat("en", { type: "disjunction" }).format(blockedBy)}`;
}

/** What a choice is: a camera by name, a lens by name, or a group of either. */
type RowKind = "camera" | "lens" | "group";

/** The kind of row a choice gets: only a camera or lens by name gets a picture or details. */
function rowKind(equipment: EquipmentKey, option: FilterOption): RowKind {
  return option.key === equipment ? equipment : "group";
}

/**
 * One camera or lens choice, in the Script Display's writing: a camera by name with a little
 * drawing of its kind, and a lens by name with its details on hover, to the right. `blockedBy`
 * names the filters hiding it, when it's a hidden one: it's dimmed and its hover says so.
 */
export function EquipmentRow({
  equipment,
  option,
  on,
  blockedBy,
  onClick,
}: {
  equipment: EquipmentKey;
  option: FilterOption;
  on: boolean;
  blockedBy?: string[];
  onClick: (on: boolean) => void;
}) {
  const { script } = useScriptDisplay();
  const kind = rowKind(equipment, option);
  const row = (
    <ChoiceRow
      label={option.label[script]}
      count={option.count}
      depth={option.depth}
      on={on}
      dimmed={blockedBy !== undefined}
      icon={kind === "camera" ? <CameraGraphic name={option.value} /> : undefined}
      onClick={() => onClick(on)}
    />
  );
  return (
    <RowDetails kind={kind} name={option.value} blockedBy={blockedBy}>
      {row}
    </RowDetails>
  );
}

/**
 * The row with its hover, to the right: a lens's details and what hides a hidden choice; the row
 * alone when there's neither.
 */
function RowDetails({
  kind,
  name,
  blockedBy,
  children,
}: {
  kind: RowKind;
  name: string;
  blockedBy?: string[];
  children: ReactElement;
}) {
  if (kind !== "lens" && !blockedBy) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="flex max-w-64 flex-col gap-2 p-3">
        <DetailsContent kind={kind} name={name} blockedBy={blockedBy} />
      </TooltipContent>
    </Tooltip>
  );
}

/** What a row's hover holds: a lens's details, then what hides it when it's a hidden choice. */
function DetailsContent({
  kind,
  name,
  blockedBy,
}: {
  kind: RowKind;
  name: string;
  blockedBy?: string[];
}) {
  return (
    <>
      {kind === "lens" && <LensInfo name={name} />}
      {blockedBy && <span className="font-medium">{blockedText(blockedBy)}</span>}
    </>
  );
}

/** A range as "low–high", or the one value when the ends are the same. */
function rangeText([low, high]: [number, number], write: (value: number) => string): string {
  return low === high ? write(low) : `${write(low)}–${write(high)}`;
}

/** A month and year, such as "Mar 2024". */
const MONTH = new Intl.DateTimeFormat("en", { month: "short", year: "numeric" });

/** A row of the details, left out while it has no value. */
type Detail = [string, string | undefined];

/** The details that have a value. */
function withValues(details: Detail[]): [string, string][] {
  return details.filter((detail): detail is [string, string] => detail[1] !== undefined);
}

/** Whether a lens with the focal lengths is a prime or a zoom. */
function lensKind([low, high]: [number, number]): string {
  return low === high ? "Prime" : "Zoom";
}

/** A lens's focal length and largest aperture, from its name, as label and value pairs. */
function specRows(name: string): Detail[] {
  const { focal, aperture } = lensSpecs(name);
  return [
    ["Focal length", focal && rangeText(focal, (mm) => `${mm}mm`)],
    ["Kind", focal && lensKind(focal)],
    ["Widest aperture", aperture && rangeText(aperture, (f) => `f/${f}`)],
  ];
}

/** When the photos were taken, from the first month to the last. */
function takenText(first: Date | undefined, last: Date | undefined): string | undefined {
  return first && last ? `${MONTH.format(first)} – ${MONTH.format(last)}` : undefined;
}

/** How the portfolio's photos used the lens, as label and value pairs. */
function useRows(name: string): Detail[] {
  const use = lensUse(allPhotos, name);
  return [
    ["Photos", String(use.count)],
    ["Used on", use.cameras.join(", ") || undefined],
    ["Most used at", use.favoriteFocal === undefined ? undefined : `${use.favoriteFocal}mm`],
    ["Taken", takenText(use.first, use.last)],
  ];
}

/**
 * A lens's details: a drawing of it, its focal length and largest aperture from its name, and how
 * the portfolio's photos used it.
 */
function LensInfo({ name }: { name: string }) {
  return (
    <>
      <span className="font-medium">{name}</span>
      <LensGraphic specs={lensSpecs(name)} />
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {withValues([...specRows(name), ...useRows(name)]).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="opacity-70">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
