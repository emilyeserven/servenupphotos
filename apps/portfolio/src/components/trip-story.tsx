import { AlbumText, type PhotoText, RowPhotos } from "@/components/album-rows";
import { TripStops } from "@/components/trip-stops";
import type { ImagePhoto } from "@/lib/spotlight-zones";
import { dayTitle, type StoryDay } from "@/lib/trip-pages";

/** The text's column, lined up with the page's title. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6";

interface TripStoryProps {
  days: StoryDay[];
  /** Each photo's text and where it goes, by its ID. */
  texts: ReadonlyMap<number, PhotoText>;
  onOpen: (photo: ImagePhoto) => void;
}

/**
 * A Trip page's days, each under its date: its first paragraph, then its rows of photos side by
 * side with their text under or beside them, each followed by the trip stops made after it and its
 * paragraph across the page; then the stops not between two of its photos.
 */
export function TripStory({ days, texts, onOpen }: TripStoryProps) {
  return (
    <ol className="flex flex-col gap-16">
      {days.map((day) => (
        <li key={day.day} className="flex flex-col gap-8">
          <h2 className={`${NARROW} text-xl font-semibold tracking-tight`}>{dayTitle(day.day)}</h2>
          <AlbumText text={day.intro} />
          {day.rows.map((row, i) => (
            <div key={`${day.day}-${i}`} className="flex flex-col gap-8">
              <RowPhotos photos={row.photos} texts={texts} onOpen={onOpen} />
              <TripStops stops={row.stops} />
              <AlbumText text={row.after} />
            </div>
          ))}
          <TripStops stops={day.stops} />
        </li>
      ))}
    </ol>
  );
}
