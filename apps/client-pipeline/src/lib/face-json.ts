import { type FaceBox, roundedBox, withFacesMark } from "@/lib/face-boxes";
import { FACES } from "@/lib/photo-fields";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const NUMBERS = ["x", "y", "width", "height", "blocks"] as const;

/** One area as the photo JSON has it, or undefined when it isn't one. */
function areaFromJson(value: unknown): FaceBox | undefined {
  if (!isRecord(value) || NUMBERS.some((key) => typeof value[key] !== "number")) return undefined;
  const area = value as unknown as FaceBox;
  return roundedBox({
    ...area,
    shape: area.shape === "circle" ? "circle" : undefined,
    edge: area.edge === "blocks" ? "blocks" : undefined,
    rotation: typeof area.rotation === "number" ? area.rotation : undefined,
    keep: area.keep === true,
  });
}

/**
 * The pixelated areas saved in a photo's JSON, or undefined when it has none saved there (a photo
 * pixelated before they were, whose areas are only in R2). Anything that isn't an area is skipped.
 */
export function facesFromJson(data: Record<string, unknown>): FaceBox[] | undefined {
  const value = data[FACES];
  if (!Array.isArray(value)) return undefined;
  return value.map(areaFromJson).filter((area) => area !== undefined);
}

/** data with its pixelated areas set to faces, as the backend takes them; left out when there are none. */
export function withFaces(
  data: Record<string, unknown>,
  faces: FaceBox[],
): Record<string, unknown> {
  const { [FACES]: _old, ...rest } = data;
  return faces.length === 0 ? rest : { ...rest, [FACES]: faces.map(roundedBox) };
}

/**
 * data after its versions were remade with faces pixelated (none stops pixelating): its areas set to
 * faces, to edit them again later, and every version's URL marked with mark, so browsers and
 * Cloudflare fetch the remade versions.
 */
export function withPixelatedFaces(
  data: Record<string, unknown>,
  faces: FaceBox[],
  mark: string,
): Record<string, unknown> {
  const images = withFacesMark(data.images as Record<string, unknown> | undefined, mark);
  return withFaces({ ...data, images }, faces);
}

/** The largest versions first, whichever the photo has, to show in place of its original. */
const SHOWN_VERSIONS = ["xlarge", "large", "medium"] as const;

/**
 * The URL of the photo's largest version once its faces have been pixelated (its URL carries the
 * `faces=` mark), to show instead of the original, which never is; undefined before that.
 */
export function pixelatedVersionUrl(data: unknown): string | undefined {
  const images = isRecord(data) ? data.images : undefined;
  if (typeof images !== "object" || images === null) return undefined;
  const urls = images as Record<string, unknown>;
  return SHOWN_VERSIONS.map((name) => urls[name]).find(
    (url): url is string => typeof url === "string" && /[?&]faces=/.test(url),
  );
}

/**
 * The image to show for a photo: its largest pixelated version once its faces have been pixelated,
 * or else original, so a photo with hidden faces never shows them.
 */
export function shownImageUrl(data: unknown, original: string): string;
export function shownImageUrl(data: unknown, original: string | undefined): string | undefined;
export function shownImageUrl(data: unknown, original: string | undefined): string | undefined {
  return pixelatedVersionUrl(data) ?? original;
}

/**
 * The areas to pixelate again on a photo's replaced image: the ones its JSON saves when the new
 * image is the same size as the old, or none when it isn't, since they'd be in the wrong places.
 */
export function facesToReapply(saved: Record<string, unknown>, sameSize: boolean): FaceBox[] {
  return sameSize ? (facesFromJson(saved) ?? []) : [];
}

/**
 * A replaced image's JSON with faces pixelated again on its versions (their areas saved and URLs
 * marked with mark), or with the saved areas dropped when there are none to reapply.
 */
export function withReappliedFaces(
  data: Record<string, unknown>,
  faces: FaceBox[],
  mark: string,
): Record<string, unknown> {
  return faces.length > 0 ? withPixelatedFaces(data, faces, mark) : withFaces(data, []);
}
