import type { ImagePhoto, SpotlightZone } from "@/lib/spotlight-zones";

/**
 * One spotlight zone's photos as a strip, in their order, each at its own shape and scrolling
 * sideways when they don't fit. Clicking one opens it.
 */
export function SpotlightStrip({
  zone,
  photos,
  onOpen,
}: {
  zone: SpotlightZone;
  photos: ImagePhoto[];
  onOpen: (photo: ImagePhoto) => void;
}) {
  return (
    <section aria-labelledby={`zone-${zone.id}`} className="flex flex-col gap-3">
      <div>
        <h2 id={`zone-${zone.id}`} className="text-xl font-semibold tracking-tight">
          {zone.label}
        </h2>
        <p className="text-sm text-muted-foreground">
          {zone.description} {photos.length} {photos.length === 1 ? "photo" : "photos"}.
        </p>
      </div>
      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos are picked for it yet.</p>
      ) : (
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6">
          {photos.map((photo) => (
            <li key={photo.id} className="shrink-0 snap-start">
              <StripPhoto photo={photo} onOpen={() => onOpen(photo)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A photo in the strip, as tall as the strip and as wide as its shape makes it. */
function StripPhoto({ photo, onOpen }: { photo: ImagePhoto; onOpen: () => void }) {
  const { width, height, small, srcSet } = photo.image;
  return (
    <button
      type="button"
      title={photo.title}
      aria-label={`Show ${photo.title}`}
      onClick={onOpen}
      className="block h-48 cursor-zoom-in overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-64"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <img
        src={small}
        srcSet={srcSet}
        sizes="(min-width: 640px) 400px, 300px"
        alt=""
        loading="lazy"
        className="size-full object-cover"
      />
    </button>
  );
}
