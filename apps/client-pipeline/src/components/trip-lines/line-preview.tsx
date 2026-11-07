import { tripColors, useIsDark } from "@portfolio/lib/map-theme";
import type { TripLine } from "@/api/trip-lines";
import { lineFeatures } from "@/components/trip-lines/route-geometry";
import type { TripPhoto } from "@/lib/trip-days";
import { orderedPhotos } from "@/lib/trip-order";

/** The preview's size in its own units; it stretches to its card's width. */
const WIDTH = 240;
const HEIGHT = 120;
const PAD = 10;

/** Turns a longitude and latitude into a spot on the preview. */
type Project = (lng: number, lat: number) => [number, number];

/**
 * A spot on the preview for each longitude and latitude, fitting the points in with the same scale
 * both ways (narrowed east to west by the latitude, as on the map), north up.
 */
function projection(points: [number, number][]): Project {
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  const [west, east, south, north] = [
    Math.min(...lngs),
    Math.max(...lngs),
    Math.min(...lats),
    Math.max(...lats),
  ];
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const span = Math.max((east - west) * squeeze, north - south, 1e-6);
  const scale = Math.min((WIDTH - PAD * 2) / span, (HEIGHT - PAD * 2) / span);
  const [x0, y0] = [
    (WIDTH - (east - west) * squeeze * scale) / 2,
    (HEIGHT - (north - south) * scale) / 2,
  ];
  return (lng, lat) => [x0 + (lng - west) * squeeze * scale, y0 + (north - lat) * scale];
}

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
 * A small drawing of a day's line as its file has it, in the map's colors, with its photos as dots; no
 * basemap, so a list of days draws quickly.
 */
export function LinePreview({ photos, line }: LinePreviewProps) {
  const dark = useIsDark();
  const ordered = orderedPhotos(photos, line.order);
  const lines = lineFeatures(line.segments, ordered).features;
  const points = [
    ...ordered.map((p): [number, number] => [p.longitude, p.latitude]),
    ...lines.flatMap((l) => l.geometry.coordinates),
  ];
  const at = projection(points);
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="bg-muted/50 h-auto w-full rounded-md"
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
  );
}
