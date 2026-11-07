import committedGear from "@portfolio/data/gear/GEAR.json";
import { localFile } from "@portfolio/lib/localize";

/** What a gear picture is for: a camera or a lens. */
export type GearKind = "camera" | "lens";

/**
 * The part of a gear picture's original that its crop shows, as fractions of the original's width
 * and height. It may reach past the original's edges, which the crop fills with `fill`.
 */
export interface GearCrop {
  x: number;
  y: number;
  width: number;
  height: number;
  /** What fills the crop around and behind the picture: white, or transparent when missing. */
  fill?: "white";
}

/** A box in a gear picture, as fractions of its width and height. */
export interface GearBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A gear picture file from GEAR.json, which the pipeline's Gear Pictures page saves: a picture
 * and a few words for one camera or lens, shown in place of the Gear & settings filter's drawing
 * of that kind of camera or lens.
 */
export interface GearFile {
  id: string;
  kind: GearKind;
  /** The camera or lens exactly as the photos name it, such as "Fujifilm X-T5". */
  name: string;
  /** The link in R2 of the picture's crop, the version shown, 200px tall; or "" for none. */
  image: string;
  /** The link in R2 of the picture as uploaded, which `image` was cropped from, if there is one. */
  original?: string;
  /** The part of `original` that `image` shows, if there's an original. */
  crop?: GearCrop;
  /** The box around the camera or lens in `original`, found when it was uploaded, which crops fit to. */
  subject?: GearBox;
  /** A few words about it, or "". */
  description: string;
}

// Like ALLPHOTOS.local.json, GEAR.local.json is git-ignored and only there locally.
const gear: GearFile[] =
  localFile(
    import.meta.glob<GearFile[]>("../data/gear/GEAR.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedGear as GearFile[]);

/** The picture file for the camera or lens with the name, ignoring case, if it has one. */
export function gearFile(kind: GearKind, name: string): GearFile | undefined {
  const want = name.toLowerCase();
  return gear.find((file) => file.kind === kind && file.name.toLowerCase() === want);
}
