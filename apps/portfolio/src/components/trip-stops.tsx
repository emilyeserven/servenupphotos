import { ChevronRight, ExternalLink } from "lucide-react";
import type { CasualPhoto, TripStop } from "@/lib/trip-pages";

/** The text's column, lined up with the page's title. */
const NARROW = "mx-auto w-full max-w-5xl px-4 sm:px-6";

/** What each kind of place is called. */
const KIND_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  bar: "Bar",
  shop: "Shop",
  museum: "Museum",
  sight: "Sight",
};

/**
 * The places a day's route stopped at, such as restaurants, each with its casual photos: photos
 * that show only here, never in the Grid or on the Map. A small group, folded until opened, until
 * the stops are worked into the story itself. Nothing for a day with none.
 */
export function TripStops({ stops }: { stops: TripStop[] }) {
  if (stops.length === 0) return null;
  return (
    <details className={`${NARROW} group`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
        Trip Stops ({stops.length})
      </summary>
      <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stops.map((place, i) => (
          <StopCard key={`${place.name}-${i}`} place={place} />
        ))}
      </ul>
    </details>
  );
}

/** One place: its name and kind, its link, its note and its casual photos. */
function StopCard({ place }: { place: TripStop }) {
  return (
    <li className="flex flex-col gap-1 text-sm">
      <StopName place={place} />
      {place.note && <p className="text-xs text-muted-foreground">{place.note}</p>}
      <div className="flex flex-wrap gap-1">
        {place.photos.map((photo) => (
          <CasualImage key={photo.id} photo={photo} place={place.name} />
        ))}
      </div>
    </li>
  );
}

/** The place's name, linking to its outside map when it has one, with its kind beside it. */
function StopName({ place }: { place: TripStop }) {
  const kind = KIND_LABELS[place.kind];
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      {place.link ? (
        <a
          href={place.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          {place.name}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      ) : (
        <span className="font-medium">{place.name}</span>
      )}
      {kind && <span className="text-xs text-muted-foreground">{kind}</span>}
    </p>
  );
}

/** The first of the versions named that the photo has. */
function firstOf(photo: CasualPhoto, names: (keyof NonNullable<CasualPhoto["images"]>)[]) {
  return names.map((name) => photo.images?.[name]).find(Boolean);
}

/** One casual photo, a small square opening its large version in a new tab. */
function CasualImage({ photo, place }: { photo: CasualPhoto; place: string }) {
  const small = firstOf(photo, ["small", "medium", "xsmall"]);
  if (!small) return null;
  return (
    <a
      href={firstOf(photo, ["large", "medium"]) ?? small}
      target="_blank"
      rel="noreferrer"
      className="size-14 overflow-hidden rounded bg-muted"
    >
      <img
        src={small}
        alt={photo.title || `A photo at ${place}`}
        loading="lazy"
        className="size-full object-cover transition-transform hover:scale-105"
      />
    </a>
  );
}
