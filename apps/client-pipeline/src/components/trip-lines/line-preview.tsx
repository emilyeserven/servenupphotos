import { tripColors, useIsDark } from "@portfolio/lib/map-theme";
import { useQuery } from "@tanstack/react-query";
import { basemapQuery, type TripLine } from "@/api/trip-lines";
import { lineFeatures } from "@/components/trip-lines/route-geometry";
import type { TripPhoto } from "@/lib/trip-days";
import { orderedPhotos } from "@/lib/trip-order";
import { previewBox } from "@/lib/preview-tiles";

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
  line: TripLine;
}

/**
 * A small drawing of a day's line as its file has it, in the map's colors, with its photos as dots,
 * over a few of the map's basemap tiles (`lib/preview-tiles.ts`) rather than a whole map, so a list
 * of days draws quickly; with no CARTO_KEY in the repo's .env, over a plain background.
 */
export function LinePreview({ photos, line }: LinePreviewProps) {
  const dark = useIsDark();
  const ordered = orderedPhotos(photos, line.order);
  const lines = lineFeatures(line.segments, ordered).features;
  const points = [
    ...ordered.map((p): [number, number] => [p.longitude, p.latitude]),
    ...lines.flatMap((l) => l.geometry.coordinates),
  ];
  const key = useQuery(basemapQuery).data?.cartoKey ?? "";
  const { at, tiles } = previewBox(points, [WIDTH, HEIGHT, PAD], { dark, key });
  return (
    <span className="bg-muted/50 relative block aspect-[2/1] w-full overflow-hidden rounded-md">
      {tiles.map((t) => (
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
      ))}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="absolute inset-0 size-full"
        role="img"
        aria-label="The day's line"
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
        {ordered.map((p) => {
          const [x, y] = at(p.longitude, p.latitude);
          return <circle key={p.id} cx={x} cy={y} r={2.5} className="fill-foreground" />;
        })}
      </svg>
    </span>
  );
}
