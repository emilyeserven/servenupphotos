import committedGear from "@portfolio/data/gear/GEAR.json";
import { localFile } from "@portfolio/lib/localize";

/** What a gear picture is for: a camera or a lens. */
export type GearKind = "camera" | "lens";

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
  /** The picture's link in R2, or "" for none. */
  image: string;
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
