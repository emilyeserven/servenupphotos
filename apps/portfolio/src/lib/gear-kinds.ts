import type { Photo } from "@portfolio/lib/photos";

/** The kinds of camera the Cameras list draws a little picture of. */
export type CameraKind = "dslr" | "mirrorless" | "compact" | "phone";

/** Words in a camera's model name that tell its kind, checked in order; mirrorless when none match. */
const CAMERA_KINDS: [RegExp, CameraKind][] = [
  [/iphone|pixel|galaxy|phone/i, "phone"],
  [/x100|powershot|coolpix|ricoh gr|rx100|compact/i, "compact"],
  [/eos r\d*\b|eos m\d*\b/i, "mirrorless"],
  [/\beos\b|\bd\d{2,4}\b|dslr|rebel|kiss/i, "dslr"],
];

/** The kind of camera a model name is, such as "dslr" for "Canon EOS 80D". */
export function cameraKind(name: string): CameraKind {
  return CAMERA_KINDS.find(([pattern]) => pattern.test(name))?.[1] ?? "mirrorless";
}

/** A lens's focal length and largest aperture, read from its model name, each a range or one value. */
export interface LensSpecs {
  /** The shortest and longest focal length in mm; the same for a prime lens. */
  focal?: [number, number];
  /** The largest aperture at the shortest and the longest focal length, as f-numbers. */
  aperture?: [number, number];
}

/** The first range like "18-135" or one value like "50" the pattern finds, and where it ends. */
function findRange(
  pattern: RegExp,
  text: string,
): { range: [number, number]; end: number } | undefined {
  const match = pattern.exec(text);
  if (!match) return undefined;
  const [whole, low = "", high = low] = match;
  return { range: [Number(low), Number(high)], end: match.index + whole.length };
}

const FOCAL = /(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*mm/i;
const APERTURE = /f\s*\/?\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/i;

/**
 * A lens's specs, read from its model name, such as 18–135mm and f/3.5–5.6 from
 * "XF18-135mmF3.5-5.6R LM OIS WR". The aperture is only read after the focal length, so the "F" of
 * "EF50mm" isn't taken for one.
 */
export function lensSpecs(name: string): LensSpecs {
  const focal = findRange(FOCAL, name);
  if (!focal) return {};
  return { focal: focal.range, aperture: findRange(APERTURE, name.slice(focal.end))?.range };
}

/** What the portfolio's photos taken with a lens say about it. */
export interface LensUse {
  count: number;
  /** The cameras it was used on, most photos first. */
  cameras: string[];
  /** The focal length it was used at most, in mm. */
  favoriteFocal?: number;
  first?: Date;
  last?: Date;
}

/** The values, most common first. */
function byCount<T>(values: T[]): T[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].toSorted((a, b) => b[1] - a[1]).map(([value]) => value);
}

/** How the portfolio's photos used the lens: how many, on which cameras, at what, and when. */
export function lensUse(photos: Photo[], name: string): LensUse {
  const taken = photos.filter((photo) => photo.lens === name);
  const times = taken.map((photo) => photo.takenAt.getTime());
  const focals = taken.flatMap((photo) => photo.settings.focalLength ?? []);
  return {
    count: taken.length,
    cameras: byCount(taken.map((photo) => photo.camera)),
    favoriteFocal: byCount(focals)[0],
    first: times.length > 0 ? new Date(Math.min(...times)) : undefined,
    last: times.length > 0 ? new Date(Math.max(...times)) : undefined,
  };
}
