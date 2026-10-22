import type {
  AllPhotosCheck,
  AllPhotosMatch,
  AllPhotosSource,
  CombinedData,
  CombinedFile,
  CombinedFiles,
  InFlightRead,
  InFlightResponse,
  PhotoIdentity,
} from "@/api/photos";
import type { SocialCalendar, SocialCalendarRead } from "@/api/publish";

/** What the combined data store has for a page: the lists once read, or why they aren't. */
export interface CombinedView {
  data?: CombinedData;
  /** Why they couldn't be read, when they couldn't. */
  error?: Error;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byKey([a]: [string, unknown], [b]: [string, unknown]): number {
  return a.localeCompare(b, "en");
}

/** value as JSON with every object's keys sorted, so equal data compares equal whatever its order. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    isPlainObject(v) ? Object.fromEntries(Object.entries(v).toSorted(byKey)) : v,
  );
}

/** The file's entries as canonical JSON; undefined when it couldn't be read. */
function entrySet(file: CombinedFile): ReadonlySet<string> | undefined {
  return file.data && new Set(file.data.map(canonicalJson));
}

/**
 * Whether data equals one of entries, ignoring key order, as the backend compared them; null when
 * either couldn't be read.
 */
function inEntries(entries: ReadonlySet<string> | undefined, data: unknown): boolean | null {
  if (!entries || data === undefined) return null;
  return entries.has(canonicalJson(data));
}

/** What to show for a combined file the store hasn't read, or couldn't. */
function unread(path: string, view: CombinedView): CombinedFile {
  const error = view.error
    ? `Couldn't read it: ${view.error.message}`
    : "Still reading it from GitHub.";
  return { path, found: true, count: 0, error };
}

/** The store's copy of a combined file; not found when the store has none at that ref. */
function combinedFile(
  files: CombinedFiles | null | undefined,
  kind: keyof CombinedFiles,
  path: string,
  view: CombinedView,
): CombinedFile {
  if (!view.data) return unread(path, view);
  return files?.[kind] ?? { path, found: false, count: 0 };
}

/** The pull request's album or tag files, each checked against its combined file. */
function checkedGroups(read: InFlightRead["albums"], all: CombinedFile) {
  const entries = entrySet(all);
  return {
    ...read,
    all,
    files: read.files.map((file) => ({ ...file, inAll: inEntries(entries, file.data) })),
  };
}

/**
 * The pull request's files checked against the combined lists at its head, as the store last read
 * them. A file is unchecked (null) while they aren't read or when either couldn't be read.
 */
export function withCombined(read: InFlightRead, view: CombinedView): InFlightResponse {
  const root = read.folder.replace(/\/photos$/, "");
  // With no pull request, there's nothing at its head to compare with.
  const head = read.pullRequest ? view.data?.head : null;
  const file = (kind: keyof CombinedFiles, name: string) =>
    combinedFile(head, kind, `${root}/${kind}/${name}`, view);

  const allPhotos = file("photos", "ALLPHOTOS.json");
  const photoEntries = entrySet(allPhotos);
  return {
    ...read,
    allPhotos,
    files: read.files.map((f) => ({ ...f, inAllPhotos: inEntries(photoEntries, f.data) })),
    albums: checkedGroups(read.albums, file("albums", "ALLALBUMS.json")),
    tags: checkedGroups(read.tags, file("tags", "ALLTAGS.json")),
    places: checkedGroups(read.places, file("places", "PLACES.json")),
    localizations: checkedGroups(read.localizations, file("localizations", "LOCALIZATIONS.json")),
  };
}

/** A field of an entry that's null when it's missing. */
function orNull(value: unknown): string | null {
  return (value ?? null) as string | null;
}

/** entry's PhotoIdentity, or undefined when it has no file name. */
function identityOf(entry: unknown): PhotoIdentity | undefined {
  if (!isPlainObject(entry) || typeof entry.file !== "string") return undefined;
  return {
    file: entry.file.trim(),
    gpsPosition: orNull(entry.gpsPosition),
    createDate: orNull(entry.createDate),
  };
}

/** Whether entry is a photo with photo's file name, GPS position and creation date. */
function sameIdentity(entry: unknown, photo: PhotoIdentity): boolean {
  const e = identityOf(entry);
  return (
    e?.file === photo.file.trim() &&
    e.gpsPosition === photo.gpsPosition &&
    e.createDate === photo.createDate
  );
}

/** The entries of ALLPHOTOS.json on the base branch, as the store has it. */
function basePhotos(view: CombinedView): unknown[] {
  return view.data?.base.photos.data ?? [];
}

/** The calendar's photos, each marked in flight or not from ALLPHOTOS.json on the base branch. */
export function withBaseAllPhotos(read: SocialCalendarRead, view: CombinedView): SocialCalendar {
  const entries = basePhotos(view);
  return {
    ...read,
    allPhotos: combinedFile(view.data?.base, "photos", `${read.folder}/ALLPHOTOS.json`, view),
    photos: read.photos.map((photo) => ({
      ...photo,
      inAllPhotos: entries.some((entry) => sameIdentity(entry, photo)),
    })),
  };
}

/** ALLPHOTOS.json on the base branch as a place the check looked. */
function baseSource(view: CombinedView): AllPhotosSource {
  const base = view.data?.base;
  if (!base)
    return { label: "the base branch", fileUrl: "", found: true, error: view.error?.message };
  const { fileUrl = "", found, error } = base.photos;
  return { label: base.branch, fileUrl, found, error };
}

/** What the backend's check of the pull request's files found, or why it couldn't run. */
interface PullRequestCheck {
  check?: Omit<AllPhotosCheck, "path">;
  error?: Error;
}

function pullRequestSources({ check, error }: PullRequestCheck): AllPhotosSource[] {
  if (!error) return check?.sources ?? [];
  const label = "the photo data pull request";
  return [{ label, fileUrl: "", found: true, error: error.message }];
}

/** The matches from both places, each entry listed once, the base branch's first. */
function uniqueMatches(matches: AllPhotosMatch[]): AllPhotosMatch[] {
  const seen = new Set<string>();
  return matches.filter((match) => {
    const key = canonicalJson(match.entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * The photo looked for in ALLPHOTOS.json on the base branch, from the store, and in the pull
 * request's files, from the backend's check, with whatever couldn't be checked as a source error.
 */
export function allPhotosCheck(
  photo: PhotoIdentity,
  view: CombinedView,
  pullRequest: PullRequestCheck,
): AllPhotosCheck {
  const source = baseSource(view);
  const onBase = basePhotos(view)
    .filter((entry) => sameIdentity(entry, photo))
    .map((entry) => ({ source: source.label, fileUrl: source.fileUrl, entry }));
  return {
    path: view.data?.base.photos.path ?? "ALLPHOTOS.json",
    sources: [source, ...pullRequestSources(pullRequest)],
    matches: uniqueMatches([...onBase, ...(pullRequest.check?.matches ?? [])]),
  };
}
