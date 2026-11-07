import { Trash2 } from "lucide-react";
import type { TripFence } from "@/api/trip-lines";
import { AreaSearch } from "@/components/area-search";
import { photoName, squareUrl } from "@/components/group-photo-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoosePhoto, TripDay } from "@/lib/trip-days";
import {
  areaFence,
  changedFence,
  firstSearch,
  toggledPhoto,
  unfenced,
  withFence,
} from "@/lib/trip-fences";
import type { GapDraft } from "@/lib/trip-gaps";
import { cn } from "@/lib/utils";

interface FencesProps {
  day: TripDay;
  draft: GapDraft;
  onChange: (draft: GapDraft) => void;
}

/**
 * The areas the day's photos without an exact spot were taken in, such as a park or a
 * neighbourhood: each found on OpenStreetMap by name or Wikidata ID, holding some of those photos,
 * and shaded on the map. Nothing shows on a day where every photo has an exact spot.
 */
export function Fences({ day, draft, onChange }: FencesProps) {
  const fences = draft.fences ?? [];
  if (day.loose.length + fences.length === 0) return null;
  const left = unfenced(day.loose, fences);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">Areas</h3>
      <FencesNote loose={day.loose.length} left={left.length} />
      {fences.map((fence, i) => (
        <FenceRow
          key={i}
          fence={fence}
          loose={day.loose}
          onChange={(f) => onChange(changedFence(draft, i, f))}
          onToggle={(id) => onChange(toggledPhoto(draft, i, id))}
        />
      ))}
      <AreaSearch
        initial={firstSearch(left)}
        onPick={(area) =>
          onChange(
            withFence(
              draft,
              areaFence(
                area,
                left.map((p) => p.id),
              ),
            ),
          )
        }
      />
    </div>
  );
}

/** How many of the day's photos have no exact spot, and how many aren't in an area yet. */
function FencesNote({ loose, left }: { loose: number; left: number }) {
  return (
    <p className="text-muted-foreground text-xs">
      {loose} photos this day have no exact spot, so the line can't go through them. Put them in the
      area they were taken in, and the map shades it.
      {left > 0 && ` ${left} aren't in an area yet.`}
    </p>
  );
}

interface FenceRowProps {
  fence: TripFence;
  loose: LoosePhoto[];
  /** Changes the fence, or removes it with null. */
  onChange: (fence: TripFence | null) => void;
  /** Puts a photo in this area, or takes it out. */
  onToggle: (id: number) => void;
}

/** One area: its name, the photos in it (click one to put it in or take it out), and removing it. */
function FenceRow({ fence, loose, onChange, onToggle }: FenceRowProps) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Area name"
          className="h-8 w-64"
          value={fence.name}
          onChange={(e) => onChange({ ...fence, name: e.target.value })}
        />
        <span className="text-muted-foreground text-xs">
          {fence.photos.length} photos{fence.osm && ` · OpenStreetMap ${fence.osm}`}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          title="Remove the area"
          onClick={() => onChange(null)}
        >
          <Trash2 className="size-4" aria-hidden />
          <span className="sr-only">Remove the area</span>
        </Button>
      </div>
      <ul className="flex flex-wrap gap-1" aria-label="Photos without an exact spot">
        {loose.map((p) => (
          <li key={p.id}>
            <LooseToggle
              photo={p}
              on={fence.photos.includes(p.id)}
              onClick={() => onToggle(p.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

interface LooseToggleProps {
  photo: LoosePhoto;
  /** Whether it's in the area. */
  on: boolean;
  onClick: () => void;
}

/** A photo without an exact spot, ringed while it's in the area. */
function LooseToggle({ photo, on, onClick }: LooseToggleProps) {
  const url = squareUrl(photo.photo);
  return (
    <button
      type="button"
      aria-pressed={on}
      title={`${photo.time}${photo.place ? ` · ${photo.place.name}` : ""}`}
      onClick={onClick}
      className={cn(
        "bg-muted size-12 overflow-hidden rounded-md border-2",
        on ? "border-purple-600" : "border-transparent opacity-50",
      )}
    >
      {url && <img src={url} alt={photoName(photo.photo)} className="size-full object-cover" />}
    </button>
  );
}
