import { tripColors, useIsDark } from "@portfolio/lib/map-theme";
import { useQuery } from "@tanstack/react-query";
import { basemapQuery, type TripLine } from "@/api/trip-lines";
import { lineFeatures } from "@/components/trip-lines/route-geometry";
import type { TripPhoto } from "@/lib/trip-days";
import { orderedPhotos } from "@/lib/trip-order";
import { type PlacedTile, type PreviewBox, previewBox } from "@/lib/preview-tiles";

/** The preview's size in its own units; it stretches to its card's width. */
const WIDTH = 240;
const HEIGHT = 120;
const PAD = 10;

/** How a line of a mode is drawn: its color and whether it's dashed. */
function strokeOf(mode: string, colour: string, onLine: boolean, dark: boolean) {
  const colors = tripColors(dark);
  if (mode === "walk") return { stroke: colors.walk };
  if (mode === "car") return { stroke: colors.drive, strokeDasharray: "6 3" };
  return onLine ? { stroke: colour } : { stroke: colour, strokeDasharray: "3 3" };
}

interface LinePreviewProps {
  photos: TripPhoto[];
  /** The day's line; left out, only its photos are drawn, such as for a day with no line yet. */
  line?: TripLine;
  /** A short note over the drawing's corner, such as why there's no line. */
  note?: string;
}

/**
 * A small drawing of a day's line as its file has it, in the map's colors, with its photos as white
 * dots, over a few of the map's basemap tiles (`lib/preview-tiles.ts`) rather than a whole map, so a
 * list of days draws quickly; with no CARTO_KEY in the repo's .env, over a plain background. A day
 * with no line shows where its photos are.
 */
export function LinePreview({ photos, line, note }: LinePreviewProps) {
  const dark = useIsDark();
  const { ordered, lines, points } = drawingOf(photos, line);
  const key = useQuery(basemapQuery).data?.cartoKey ?? "";
  const { at, tiles } = previewBox(points, [WIDTH, HEIGHT, PAD], { dark, key });
  return (
    <span className="bg-muted/50 relative block aspect-[2/1] w-full overflow-hidden rounded-md">
      <BasemapTiles tiles={tiles} />
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="absolute inset-0 size-full"
        role="img"
        aria-label={line ? "The day's line" : "Where the day's photos are"}
      >
        {lines.map((l, i) => (
          <polyline
            key={i}
            points={l.geometry.coordinates.map(([lng, lat]) => at(lng, lat).join(",")).join(" ")}
            fill="none"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            {...strokeOf(l.properties.mode, l.properties.colour, l.properties.onLine, dark)}
          />
        ))}
        <PhotoDots photos={ordered} at={at} />
      </svg>
      <PreviewNote note={note} />
    </span>
  );
}

/** The day's photos in the line's order, its lines (none without one), and every point drawn. */
function drawingOf(photos: TripPhoto[], line?: TripLine) {
  const ordered = orderedPhotos(photos, line?.order);
  const lines = line ? lineFeatures(line.segments, ordered).features : [];
  const points = [
    ...ordered.map((p): [number, number] => [p.longitude, p.latitude]),
    ...lines.flatMap((l) => l.geometry.coordinates),
  ];
  return { ordered, lines, points };
}

/** The day's photos as white dots with a dark edge, so they show on either basemap. */
function PhotoDots({ photos, at }: { photos: TripPhoto[]; at: PreviewBox["at"] }) {
  return photos.map((p) => {
    const [x, y] = at(p.longitude, p.latitude);
    return <circle key={p.id} cx={x} cy={y} r={3} fill="white" stroke="#171717" strokeWidth={1} />;
  });
}

/** A short note over the drawing's corner, if there is one. */
function PreviewNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <span className="bg-background/85 text-muted-foreground absolute bottom-1 left-1 rounded px-1.5 py-0.5 text-[11px]">
      {note}
    </span>
  );
}

/** The basemap tiles under the drawing, each hidden when it can't be loaded. */
function BasemapTiles({ tiles }: { tiles: PlacedTile[] }) {
  return tiles.map((t) => (
    <img
      key={t.url}
      src={t.url}
      alt=""
      loading="lazy"
      className="absolute max-w-none opacity-80"
      style={{
        left: `${(t.x / WIDTH) * 100}%`,
        top: `${(t.y / HEIGHT) * 100}%`,
        width: `${(t.size / WIDTH) * 100}%`,
        height: `${(t.size / HEIGHT) * 100}%`,
      }}
      onError={(e) => (e.currentTarget.style.visibility = "hidden")}
    />
  ));
}
