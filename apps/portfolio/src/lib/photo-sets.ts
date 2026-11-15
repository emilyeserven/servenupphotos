import committedSets from "@portfolio/data/sets/SETS.json";
import { localFile } from "@portfolio/lib/localize";

/**
 * A Photo Set from SETS.json, which the pipeline's Photo Sets page saves: photos the map always
 * shows as one marker, however far in or out it's zoomed, rather than splitting them apart or
 * grouping them with the photos around them.
 */
export interface PhotoSet {
  id: string;
  /** How the pipeline lists it and the map's popup titles it, such as "Gyeongbokgung at night". */
  name: string;
  /** Its photos' IDs, in the order the popup shows them; the first is the one on its marker. */
  photos: number[];
}

// Like ALLPHOTOS.local.json, SETS.local.json is git-ignored and only there locally.
/** Every Photo Set. */
export const photoSets: PhotoSet[] =
  localFile(
    import.meta.glob<PhotoSet[]>("../data/sets/SETS.local.json", {
      eager: true,
      import: "default",
    }),
  ) ?? (committedSets as PhotoSet[]);
