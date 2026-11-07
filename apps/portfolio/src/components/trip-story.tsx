import { AlbumText, RowPhotos } from "@/components/album-rows";
import type { ImagePhoto } from "@/lib/spotlight-zones";
import { dayTitle, type StoryDay } from "@/lib/trip-pages";

/** The text's column, lined up with the page's title. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6";

interface TripStoryProps {
  days: StoryDay[];
  /** Each photo's caption, by its ID. */
  captions: ReadonlyMap<number, string>;
  onOpen: (photo: ImagePhoto) => void;
}

/**
 * A Trip page's days, each under its date: its first paragraph, then its rows of photos side by
 * side with their captions under them, each followed by its paragraph across the page.
 */
export function TripStory({ days, captions, onOpen }: TripStoryProps) {
  return (
    <ol className="flex flex-col gap-16">
      {days.map((day) => (
        <li key={day.day} className="flex flex-col gap-8">
          <h2 className={`${NARROW} text-xl font-semibold tracking-tight`}>{dayTitle(day.day)}</h2>
          <AlbumText text={day.intro} />
          {day.rows.map((row) => (
            <div key={row.photos[0]?.id ?? row.after} className="flex flex-col gap-8">
              <RowPhotos photos={row.photos} captions={captions} onOpen={onOpen} />
              <AlbumText text={row.after} />
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}
