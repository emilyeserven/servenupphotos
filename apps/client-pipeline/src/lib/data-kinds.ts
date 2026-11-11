/**
 * Every kind of combined data, photos first: each is a folder of JSON files that Commit combines
 * into one list (see `KIND_INFO`). This is the one list of them in the pipeline's UI; the backend
 * keeps its own in `dataKinds` (apps/be-pipeline/internal/github/kinds.go), and the workflow and
 * `pnpm photos:local` read `scripts/data-kinds.json`. Adding a kind is one entry here and one in
 * `KIND_INFO`.
 */
const COMBINED_KINDS = [
  "photos",
  "albums",
  "tags",
  "genres",
  "places",
  "localizations",
  "metainfo",
  "cameras",
  "lenses",
  "captions",
  "timeline",
  "likes",
  "triplines",
  "graphs",
  "gear",
  "notstored",
  "photobooks",
] as const;

/** A kind of combined data, by its name, which is also its folder in the data folder. */
export type CombinedKind = (typeof COMBINED_KINDS)[number];

/** Every kind but photos, whose files the photo data pull request lists as groups. */
export type GroupKind = Exclude<CombinedKind, "photos">;

/** Every kind but photos, in order. */
export const GROUP_KINDS = COMBINED_KINDS.filter((kind): kind is GroupKind => kind !== "photos");

/** How a kind of combined data is named and stored. */
interface KindInfo {
  /** The combined list Commit builds from the kind's files, in its folder. */
  file: string;
  /** The kind's heading in Photos in Flight. */
  heading: string;
  /** One of the kind's files, as the sync button counts them: "3 albums". */
  pending: string;
}

/** Each kind's combined list and names. */
export const KIND_INFO: Record<CombinedKind, KindInfo> = {
  photos: { file: "ALLPHOTOS.json", heading: "Photos", pending: "image" },
  albums: { file: "ALLALBUMS.json", heading: "Albums", pending: "album" },
  tags: { file: "ALLTAGS.json", heading: "Tags", pending: "tag" },
  genres: { file: "ALLGENRES.json", heading: "Photographic genres", pending: "genre" },
  places: { file: "PLACES.json", heading: "Places", pending: "place" },
  localizations: { file: "LOCALIZATIONS.json", heading: "Localizations", pending: "localization" },
  metainfo: { file: "METAINFO.json", heading: "Metadata groups", pending: "metadata group" },
  cameras: { file: "CAMERAS.json", heading: "Camera overrides", pending: "camera override" },
  lenses: { file: "LENSES.json", heading: "Custom lenses", pending: "custom lens file" },
  captions: { file: "CAPTIONS.json", heading: "Caption templates", pending: "caption template" },
  timeline: { file: "TIMELINE.json", heading: "Trips", pending: "Trip" },
  likes: { file: "LIKES.json", heading: "User likes", pending: "user likes list" },
  triplines: { file: "TRIPLINES.json", heading: "Trip lines", pending: "trip line" },
  graphs: { file: "GRAPHS.json", heading: "Graph presets", pending: "graph preset" },
  gear: { file: "GEAR.json", heading: "Gear pictures", pending: "gear picture" },
  notstored: { file: "NOTSTORED.json", heading: "Not Stored posts", pending: "Not Stored post" },
  photobooks: { file: "PHOTOBOOKS.json", heading: "Photo books", pending: "photo book" },
};

/** An object with value(kind) for each of kinds, by kind. */
export function byKind<K extends CombinedKind, V>(
  kinds: readonly K[],
  value: (kind: K) => V,
): Record<K, V> {
  return Object.fromEntries(kinds.map((kind) => [kind, value(kind)])) as Record<K, V>;
}
