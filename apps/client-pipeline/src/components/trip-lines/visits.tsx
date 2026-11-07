import { ExternalLink, MapPinPlus, Trash2 } from "lucide-react";
import type { Place } from "@/api/places";
import type { TripVisit, VisitKind } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";
import { VisitRoute } from "@/components/trip-lines/visit-route";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentLists } from "@/lib/group-photos";
import type { TripDay } from "@/lib/trip-days";
import type { GapDraft } from "@/lib/trip-gaps";
import {
  changedVisit,
  placesNear,
  placeVisit,
  VISIT_KINDS,
  webLink,
  withVisit,
} from "@/lib/trip-visits";
import { useCombinedData } from "@/stores/combined-data";

interface VisitsProps {
  day: TripDay;
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
  /** Whether the next map click adds a place. */
  picking: boolean;
  onPicking: (on: boolean) => void;
}

/**
 * The places visited along the route, such as restaurants and museums, with or without a photo:
 * added by clicking the map or from the saved places nearby, each with a kind, a note and a link to
 * it on Google Maps, Naver Map or another map.
 */
export function Visits({ day, draft, onChange, picking, onPicking }: VisitsProps) {
  const visits = draft.visits ?? [];
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Places visited</h3>
      {visits.map((visit, i) => (
        <VisitRow
          key={i}
          visit={visit}
          day={day}
          onChange={(v) => onChange(changedVisit(draft, i, v))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={picking ? "secondary" : "outline"}
          size="sm"
          onClick={() => onPicking(!picking)}
        >
          <MapPinPlus aria-hidden />
          {picking ? "Click the map where it is…" : "Add a place on the map"}
        </Button>
        <SavedPlacePicker day={day} onPick={(v) => onChange(withVisit(draft, v))} />
      </div>
    </div>
  );
}

/** The saved places, from the combined lists. */
export function useSavedPlaces(): Place[] {
  const data = useCombinedData().data;
  return data ? ((currentLists(data).places.data ?? []) as Place[]) : [];
}

/** Adds one of the saved places near the day's photos as a place visited. */
function SavedPlacePicker({ day, onPick }: { day: TripDay; onPick: (v: TripVisit) => void }) {
  const near = placesNear(useSavedPlaces(), day.photos);
  if (near.length === 0) return null;
  return (
    <select
      aria-label="Add a saved place"
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      value=""
      onChange={(e) => onPick(placeVisit(near[+e.target.value]!))}
    >
      <option value="">Add a saved place nearby…</option>
      {near.map((p, i) => (
        <option key={p.id} value={i}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

interface VisitRowProps {
  visit: TripVisit;
  day: TripDay;
  /** Changes the visit, or removes it with null. */
  onChange: (visit: TripVisit | null) => void;
}

/** One place visited: its kind, name, note, map link and spot on the route, and removing it. */
function VisitRow({ visit, day, onChange }: VisitRowProps) {
  const set = (fields: Partial<TripVisit>) => onChange({ ...visit, ...fields });
  const Icon = VISIT_ICONS[visit.kind];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Icon className="text-muted-foreground size-4" aria-hidden />
      <select
        aria-label="Kind of place"
        className="border-input bg-background h-8 rounded-md border px-2 text-sm"
        value={visit.kind}
        onChange={(e) => set({ kind: e.target.value as VisitKind })}
      >
        {VISIT_KINDS.map(({ kind, label }) => (
          <option key={kind} value={kind}>
            {label}
          </option>
        ))}
      </select>
      <Input
        aria-label="Name"
        placeholder="Name (needed)"
        className="h-8 w-48"
        value={visit.name}
        onChange={(e) => set({ name: e.target.value })}
      />
      <Input
        aria-label="Note"
        placeholder="Note"
        className="h-8 w-56"
        value={visit.note ?? ""}
        onChange={(e) => set({ note: e.target.value })}
      />
      <LinkField link={visit.link} onLink={(link) => set({ link })} />
      <VisitRoute photos={day.photos} after={visit.after} onAfter={(after) => set({ after })} />
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        title="Remove"
        onClick={() => onChange(null)}
      >
        <Trash2 className="size-4" aria-hidden />
        <span className="sr-only">Remove</span>
      </Button>
    </div>
  );
}

/** The place's link on an outside map, and a button that opens it once it's a web address. */
function LinkField({ link, onLink }: { link?: string; onLink: (link: string) => void }) {
  return (
    <span className="flex items-center gap-1">
      <Input
        aria-label="Map link"
        placeholder="Google Maps or Naver Map link"
        className="h-8 w-64"
        value={link ?? ""}
        onChange={(e) => onLink(e.target.value)}
      />
      {webLink(link) && (
        <a href={link} target="_blank" rel="noreferrer" title="Open the map link" className="p-1">
          <ExternalLink className="size-4" aria-hidden />
        </a>
      )}
    </span>
  );
}
