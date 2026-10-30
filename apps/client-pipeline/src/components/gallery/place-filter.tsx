import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { LocateFixedIcon, LocateIcon, LocateOffIcon, MapPinIcon, XIcon } from "lucide-react";
import type { PublishedFile } from "@/api/photos";
import { type Place, placesQuery, readEntries, savedPlaces } from "@/api/places";
import { FilterToggle, type ToggleChoices } from "@/components/photo-filters";
import type { CombinedPhoto } from "@/lib/group-photos";
import { type PhotoGpsSource, photoGpsSource } from "@/lib/place-gps";
import { editedData } from "@/lib/undecided";
import { cn } from "@/lib/utils";
import { type LocalEdit, useLocalEditsStore } from "@/stores/local-edits";

/**
 * Where the photos with the Gallery's place get their spot on the map: their own GPS position, a
 * place's, or none.
 */
export type PlaceGpsChoice = PhotoGpsSource["kind"];

/** The Gallery's place filter, as kept in the URL. */
export interface PlaceSearch {
  /** The ID of the place whose photos are shown, such as `gyeongbokgung-palace`; every photo when left out. */
  placeId?: string;
  /** Which of the place's photos are shown by where their GPS position comes from; all when left out. */
  placeGps?: PlaceGpsChoice;
}

const PLACE_GPS_CHOICES: ToggleChoices<PlaceGpsChoice> = [
  [undefined, "Any"],
  ["own", "Own"],
  ["place", "From a place"],
  ["none", "None"],
];

function isPlaceGps(value: unknown): value is PlaceGpsChoice {
  return value === "own" || value === "place" || value === "none";
}

/** The Gallery's `?placeId=` and `?placeGps=` search params, leaving out anything else. */
export function parsePlaceSearch(search: Record<string, unknown>): PlaceSearch {
  const { placeId, placeGps } = search;
  return {
    placeId: typeof placeId === "string" && placeId ? placeId : undefined,
    placeGps: isPlaceGps(placeGps) ? placeGps : undefined,
  };
}

/** The photo's JSON with the local edits made, or undefined when it couldn't be read. */
function editedPhoto(file: PublishedFile, edits: Record<string, LocalEdit>) {
  const data = editedData(file, edits);
  return typeof data === "object" && data !== null ? (data as CombinedPhoto) : undefined;
}

/** Whether the photo lists the place, and its GPS position comes from where `gps` says. */
function passes(photo: CombinedPhoto | undefined, filter: PlaceSearch, places: Place[]): boolean {
  if (!photo || !savedPlaces(photo.places).some(({ id }) => id === filter.placeId)) return false;
  return !filter.placeGps || photoGpsSource(photo, places).kind === filter.placeGps;
}

/**
 * The Gallery's place filter, kept in the URL: the place chosen on the Places page, the places, and
 * the files it lets through with the local edits made. Every file passes when no place is chosen.
 */
export function usePlaceFilter() {
  const search = useSearch({ from: "/gallery", select: parsePlaceSearch });
  const places = readEntries(useQuery(placesQuery).data?.places);
  const edits = useLocalEditsStore((s) => s.edits);
  return {
    ...search,
    place: places.find((place) => place.id === search.placeId),
    places,
    apply: (files: PublishedFile[]): PublishedFile[] =>
      search.placeId
        ? files.filter((file) => passes(editedPhoto(file, edits), search, places))
        : files,
  };
}

/**
 * The place chosen, with a button that shows every photo again, and the Coordinates filter for its
 * photos; nothing when no place is chosen.
 */
export function PlaceFilterToggles({ filter }: { filter: ReturnType<typeof usePlaceFilter> }) {
  const navigate = useNavigate({ from: "/gallery" });
  const set = (next: PlaceSearch) =>
    void navigate({ search: (prev) => ({ ...prev, ...next }), replace: true, resetScroll: false });
  if (!filter.placeId) return null;
  return (
    <>
      <PlaceChip
        name={filter.place?.name ?? filter.placeId}
        onClear={() => set({ placeId: undefined, placeGps: undefined })}
      />
      <FilterToggle
        label="Coordinates"
        choice={filter.placeGps}
        choices={PLACE_GPS_CHOICES}
        onChange={(placeGps) => set({ placeGps })}
      />
    </>
  );
}

/** The place whose photos are shown, with an X that shows every photo again. */
function PlaceChip({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-muted-foreground text-xs">Place</span>
      <span className="bg-secondary text-secondary-foreground flex items-center gap-1 rounded-md border py-0.5 pr-0.5 pl-2 text-xs font-medium">
        <MapPinIcon className="size-3.5" aria-hidden />
        {name}
        <button
          type="button"
          aria-label={`Show photos from every place, not only ${name}`}
          title="Show every place"
          onClick={onClear}
          className="hover:bg-background focus-visible:ring-ring rounded p-0.5 outline-none focus-visible:ring-2"
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
      </span>
    </div>
  );
}

/** What each source of a photo's GPS position looks like on its tile. */
function markOf(source: PhotoGpsSource) {
  if (source.kind === "own") {
    return {
      Icon: LocateFixedIcon,
      text: "Own GPS position",
      title: "Goes on the map at its own GPS position (EXIF or custom), not its place's.",
      className: "text-emerald-700 dark:text-emerald-400",
    };
  }
  if (source.kind === "place") {
    const exact = source.place.exactLocation ? " (exact location)" : "";
    return {
      Icon: LocateIcon,
      text: `GPS from ${source.place.name}${exact}`,
      title: `Has no GPS position of its own, so it goes on the map at ${source.place.name}'s.`,
      className: "text-sky-700 dark:text-sky-400",
    };
  }
  return {
    Icon: LocateOffIcon,
    text: "Not on the map",
    title: "Has no GPS position of its own, and none of its places has one.",
    className: "text-amber-700 dark:text-amber-400",
  };
}

/**
 * While the Gallery shows a place's photos, where the photo's spot on the map comes from: its own
 * GPS position, or the place's (or another of its places') it inherits.
 */
export function PlaceGpsMark({ file }: { file: PublishedFile }) {
  const filter = usePlaceFilter();
  const edits = useLocalEditsStore((s) => s.edits);
  const photo = editedPhoto(file, edits);
  if (!filter.placeId || !photo) return null;
  const { Icon, text, title, className } = markOf(photoGpsSource(photo, filter.places));
  return (
    <p className={cn("flex w-fit items-center gap-1 text-xs", className)} title={title}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{text}</span>
    </p>
  );
}
