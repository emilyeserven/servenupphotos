import { GearPicture } from "@portfolio/components/gear-graphics";
import {
  type CameraKind,
  cameraKind,
  cameraUse,
  lensSpecs,
  lensUse,
} from "@portfolio/lib/gear-kinds";
import { type GearKind, gearFile } from "@portfolio/lib/gear-pictures";
import { photos as allPhotos } from "@portfolio/lib/photos";

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

/** What each kind of camera is called in its details. */
const CAMERA_KIND_NAMES: Record<CameraKind, string> = {
  dslr: "DSLR",
  mirrorless: "Mirrorless",
  compact: "Compact",
  phone: "Phone",
};

/** When the photos were taken, from the first month to the last. */
function takenText(first: Date | undefined, last: Date | undefined): string | undefined {
  return first && last ? `${MONTH.format(first)} – ${MONTH.format(last)}` : undefined;
}

/** A list of names, or nothing when it's empty. */
function listText(names: string[]): string | undefined {
  return names.join(", ") || undefined;
}

/** A lens's focal length and largest aperture, from its name. */
function specRows(name: string): Detail[] {
  const { focal, aperture } = lensSpecs(name);
  return [
    ["Focal length", focal && rangeText(focal, (mm) => `${mm}mm`)],
    ["Kind", focal && lensKind(focal)],
    ["Widest aperture", aperture && rangeText(aperture, (f) => `f/${f}`)],
  ];
}

/** The focal length a lens was used at most, such as "35mm". */
function favoriteText(focal: number | undefined): string | undefined {
  return focal === undefined ? undefined : `${focal}mm`;
}

/** A lens's specs from its name, and how the photos used it. */
function lensRows(name: string): Detail[] {
  const use = lensUse(allPhotos, name);
  return [
    ...specRows(name),
    ["Photos", String(use.count)],
    ["Used on", listText(use.cameras)],
    ["Most used at", favoriteText(use.favoriteFocal)],
    ["Taken", takenText(use.first, use.last)],
  ];
}

/** A camera's kind, from its name, and how the photos used it. */
function cameraRows(name: string): Detail[] {
  const use = cameraUse(allPhotos, name);
  return [
    ["Kind", CAMERA_KIND_NAMES[cameraKind(name)]],
    ["Photos", String(use.count)],
    ["Taken", takenText(use.first, use.last)],
  ];
}

/**
 * A camera's or lens's details, for the Gear & settings info panel: its picture (its own from the
 * Gear Pictures page, or a drawing of it), its name and description, what its name says about it,
 * and how the portfolio's photos used it.
 */
export function GearInfo({ kind, name }: { kind: GearKind; name: string }) {
  const description = gearFile(kind, name)?.description;
  const rows = kind === "lens" ? lensRows(name) : cameraRows(name);
  return (
    <div className="flex flex-col gap-2 text-xs">
      <GearPicture kind={kind} name={name} />
      <span className="text-sm font-medium break-words">{name}</span>
      {description && <p className="text-muted-foreground">{description}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {withValues(rows).map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
