import { ChevronRight, ExternalLink, MapPin } from "lucide-react";
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
 * Trip stops in the story, such as restaurants, each on its own small line between the photos it
 * came between, with its casual photos (photos shown only here, never in the Grid or on the Map)
 * folded under it until opened. Nothing for none.
 */
export function TripStops({ stops }: { stops: TripStop[] }) {
  if (stops.length === 0) return null;
  return (
    <ul className={`${NARROW} flex flex-col gap-2`} aria-label="Trip Stops">
      {stops.map((stop, i) => (
        <StopItem key={`${stop.name}-${i}`} stop={stop} />
      ))}
    </ul>
  );
}

/** One stop: its pin, name and kind, its link, its note and its casual photos. */
function StopItem({ stop }: { stop: TripStop }) {
  return (
    <li className="flex flex-col gap-1 border-l-2 border-muted pl-3 text-sm">
      <StopName stop={stop} />
      {stop.note && <p className="text-xs text-muted-foreground">{stop.note}</p>}
      <StopPhotos stop={stop} />
    </li>
  );
}

/** The stop's name, linking to its outside map when it has one, with its kind beside it. */
function StopName({ stop }: { stop: TripStop }) {
  const kind = KIND_LABELS[stop.kind];
  return (
    <p className="flex flex-wrap items-center gap-x-2">
      <MapPin className="size-3.5 text-muted-foreground" aria-hidden />
      {stop.link ? (
        <a
          href={stop.link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 font-medium hover:underline"
        >
          {stop.name}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        <span className="font-medium">{stop.name}</span>
      )}
      {kind && <span className="text-xs text-muted-foreground">{kind}</span>}
    </p>
  );
}

/** The stop's casual photos, folded until opened; nothing when it has none. */
function StopPhotos({ stop }: { stop: TripStop }) {
  const photos = stop.photos ?? [];
  if (photos.length === 0) return null;
  return (
    <details className="group">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        {photos.length} {photos.length === 1 ? "photo" : "photos"}
      </summary>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {photos.map((photo) => (
          <CasualImage key={photo.id} photo={photo} stop={stop.name} />
        ))}
      </div>
    </details>
  );
}

/** The first of the versions named that the photo has. */
function firstOf(photo: CasualPhoto, names: (keyof NonNullable<CasualPhoto["images"]>)[]) {
  return names.map((name) => photo.images?.[name]).find(Boolean);
}

/** One casual photo, a small square opening its large version in a new tab. */
function CasualImage({ photo, stop }: { photo: CasualPhoto; stop: string }) {
  const small = firstOf(photo, ["small", "medium", "xsmall"]);
  if (!small) return null;
  return (
    <a
      href={firstOf(photo, ["large", "medium"]) ?? small}
      target="_blank"
      rel="noreferrer"
      className="size-16 overflow-hidden rounded bg-muted"
    >
      <img
        src={small}
        alt={photo.title || `A photo at ${stop}`}
        loading="lazy"
        className="size-full object-cover transition-transform hover:scale-105"
      />
    </a>
  );
}
