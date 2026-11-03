import { HeartIcon } from "lucide-react";
import { type ViewerLikes, likeCounts } from "@/api/viewer-likes";
import type { CombinedData } from "@/api/photos";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";

/** How many of the most liked photos are listed. */
const SHOWN = 30;

/** The saved photos' titles by photo ID, or their file names when they have no title. */
export function photoTitles(data: CombinedData): Map<number, string> {
  const titles = new Map<number, string>();
  for (const photo of shownPhotos(data)) {
    if (typeof photo.id === "number") titles.set(photo.id, photoTitle(photo));
  }
  return titles;
}

function photoTitle(photo: Record<string, unknown>): string {
  const title = typeof photo.title === "string" ? photo.title.trim() : "";
  return title || String(photo.file ?? "Untitled");
}

interface MostLikedProps {
  viewers: ViewerLikes[];
  titles: Map<number, string>;
}

/** The photos with the most likes, summed across everyone who sent a list. */
export function MostLiked({ viewers, titles }: MostLikedProps) {
  const counts = [...likeCounts(viewers)].toSorted(([a, ca], [b, cb]) => cb - ca || a - b);
  const known = counts.filter(([id]) => titles.has(id));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Most liked</CardTitle>
        <CardDescription>
          <LikesSummary
            viewers={viewers}
            photos={known.length}
            missing={counts.length - known.length}
          />
        </CardDescription>
      </CardHeader>
      <CardContent>
        {known.length === 0 ? (
          <p className="text-muted-foreground text-sm">No likes yet.</p>
        ) : (
          <ol className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {known.slice(0, SHOWN).map(([id, count]) => (
              <li key={id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate" title={titles.get(id)}>
                  {titles.get(id)} <span className="text-muted-foreground text-xs">#{id}</span>
                </span>
                <LikeCount count={count} />
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function LikesSummary({
  viewers,
  photos,
  missing,
}: {
  viewers: ViewerLikes[];
  photos: number;
  missing: number;
}) {
  const people = viewers.length === 1 ? "1 person" : `${viewers.length} people`;
  const note =
    missing > 0 ? ` ${missing} liked IDs don't match a saved photo, so they're left out.` : "";
  return (
    <>
      {photos} {photos === 1 ? "photo" : "photos"} liked by {people}, each counted once per person.
      {note}
    </>
  );
}

/** A heart and how many people liked the photo. */
export function LikeCount({ count }: { count: number }) {
  return (
    <span
      className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs"
      title={`${count} ${count === 1 ? "like" : "likes"}`}
    >
      <HeartIcon className="size-3.5 fill-rose-500 text-rose-500" aria-hidden />
      {count}
    </span>
  );
}
