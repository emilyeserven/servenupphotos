import { shownImageUrl } from "@/lib/face-json";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useMemo } from "react";
import {
  type InFlightRead,
  photosInFlightQuery,
  type PublishedResponse,
  publishedPhotosQuery,
} from "@/api/photos";
import type { TripVisit } from "@/api/trip-lines";
import { allPhotosEntries } from "@/components/all-photos/all-photos-files";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocalEditsStore } from "@/stores/local-edits";

/** The JSON field marking a casual photo: `true`, or left out when it isn't one. */
const CASUAL = "casual";

/** A photo taken on the day, any kind: on the portfolio, a draft, Undecided or casual. */
interface DayFile {
  id: number;
  path: string;
  name: string;
  imageUrl?: string;
  /** The file's data as read, before the edits waiting for Commit. */
  before: Record<string, unknown>;
}

/** The day a photo file was taken, such as "2026-10-01": its custom date, or else its EXIF one. */
function dayOf(data: unknown): string | undefined {
  const photo = data as { customCreateDate?: unknown; createDate?: unknown };
  const date = [photo.customCreateDate, photo.createDate].find((d) => typeof d === "string");
  return typeof date === "string" ? date.slice(0, 10).replaceAll(":", "-") : undefined;
}

/** The photo files' data as read, by path: the pull request's copy over the base branch's. */
function rawData(published: PublishedResponse, inFlight?: InFlightRead) {
  const files = [...published.files, ...(inFlight?.files ?? [])];
  return new Map(files.map((f) => [f.path, (f.data ?? {}) as Record<string, unknown>]));
}

/**
 * Every photo file taken on day, from the base branch and the pull request with the edits waiting
 * for Commit, so drafts just uploaded are there too; undefined while they're read.
 */
function useDayFiles(day: string): DayFile[] | undefined {
  const published = useQuery(publishedPhotosQuery);
  const inFlight = useQuery(photosInFlightQuery);
  const edits = useLocalEditsStore((s) => s.edits);
  return useMemo(() => {
    if (!published.data || inFlight.isPending) return undefined;
    const raw = rawData(published.data, inFlight.data);
    return allPhotosEntries(published.data, inFlight.data, edits, true)
      .filter((e) => dayOf(e.data) === day)
      .map((e) => ({
        id: (e.data as { id: number }).id,
        path: e.path,
        name: e.name,
        imageUrl: shownImageUrl(e.data, e.imageUrl),
        before: raw.get(e.path) ?? {},
      }));
  }, [published.data, inFlight.data, inFlight.isPending, edits, day]);
}

/** Marks photos casual, or not, as edits waiting for Commit. */
function useSetCasual() {
  const setField = useLocalEditsStore((s) => s.setField);
  return (files: DayFile[], casual: boolean) =>
    setField(
      CASUAL,
      files.map((f) => ({ path: f.path, before: f.before, value: casual ? true : null })),
    );
}

/**
 * Unmarks the casual photos with these IDs taken on day, as edits waiting for Commit, for a place
 * visited being removed, so its photos go back to being ordinary ones.
 */
export function useClearCasual(day: string) {
  const files = useDayFiles(day);
  const setCasual = useSetCasual();
  return (ids: number[] = []) => {
    const gone = (files ?? []).filter((f) => ids.includes(f.id));
    if (gone.length > 0) setCasual(gone, false);
  };
}

interface CasualPhotosProps {
  day: string;
  visit: TripVisit;
  onChange: (visit: TripVisit) => void;
}

/**
 * The casual photos taken at a trip stop, such as the food at a restaurant, and adding more
 * from the photos taken that day. Adding one marks it casual and taking it away unmarks it, as edits
 * waiting for Commit: a casual photo shows only with its place on the day's Trip page, never in the
 * portfolio's Grid or Map, or on a trip line.
 */
export function CasualPhotos({ day, visit, onChange }: CasualPhotosProps) {
  const files = useDayFiles(day);
  const setCasual = useSetCasual();
  const ids = visit.photos ?? [];
  if (!files)
    return <span className="text-muted-foreground text-xs">Reading the day's photos…</span>;
  const byId = new Map(files.map((f) => [f.id, f]));
  const set = (next: number[]) =>
    onChange({ ...visit, photos: next.length > 0 ? next : undefined });
  const add = (f: DayFile) => {
    setCasual([f], true);
    set([...ids, f.id]);
  };
  const remove = (id: number) => {
    const f = byId.get(id);
    if (f) setCasual([f], false);
    set(ids.filter((i) => i !== id));
  };
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {ids.map((id) => (
        <Thumb key={id} file={byId.get(id)} id={id} onRemove={() => remove(id)} />
      ))}
      <AddPhoto choices={files.filter((f) => !ids.includes(f.id))} onAdd={add} />
    </div>
  );
}

/** One casual photo, with a cross that takes it off the place. */
function Thumb({ file, id, onRemove }: { file?: DayFile; id: number; onRemove: () => void }) {
  return (
    <span className="group/thumb bg-muted relative size-14 overflow-hidden rounded-md">
      <ThumbImage file={file} id={id} />
      <button
        type="button"
        title="Take this photo off the stop"
        onClick={onRemove}
        className="bg-background/90 absolute top-0.5 right-0.5 rounded-sm p-0.5 opacity-0 shadow-sm group-hover/thumb:opacity-100 focus-visible:opacity-100"
      >
        <X className="size-3" aria-hidden />
        <span className="sr-only">Take this photo off the stop</span>
      </button>
    </span>
  );
}

/** A casual photo's image, or its name for screen readers while it has none. */
function ThumbImage({ file, id }: { file?: DayFile; id: number }) {
  if (!file) return <span className="sr-only">Photo {id}</span>;
  if (!file.imageUrl) return <span className="sr-only">{file.name}</span>;
  return <img src={file.imageUrl} alt={file.name} className="size-full object-cover" />;
}

/** Picks one of the day's photos to add to the place as a casual photo. */
function AddPhoto({ choices, onAdd }: { choices: DayFile[]; onAdd: (f: DayFile) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ImagePlus aria-hidden />
          Add casual photos
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-80 flex-col gap-2 p-2">
        <p className="text-muted-foreground text-xs">
          Photos taken this day. One added here shows only with this stop on the Trip page.
        </p>
        {choices.length === 0 && <p className="text-sm">No other photos were taken this day.</p>}
        <div className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto">
          {choices.map((f) => (
            <button
              key={f.path}
              type="button"
              title={f.name}
              onClick={() => onAdd(f)}
              className="bg-muted hover:ring-ring aspect-square overflow-hidden rounded-md hover:ring-2"
            >
              {f.imageUrl && (
                <img src={f.imageUrl} alt={f.name} className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
