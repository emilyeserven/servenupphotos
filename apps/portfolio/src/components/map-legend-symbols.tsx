import { Image } from "lucide-react";
import type { ReactNode } from "react";
import { areaColors, tripColors } from "@/lib/map-theme";
import { cn } from "@/lib/utils";

/**
 * A marker's sample in the map's key, on a gray tile like the map under it so a pin's white edge
 * shows in light mode too.
 */
function MarkerTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-6 w-8 items-center justify-center rounded-sm bg-neutral-300 dark:bg-neutral-700">
      {children}
    </span>
  );
}

const PIN =
  "flex size-4 items-center justify-center rounded-[3px] shadow-sm shadow-black/30 ring-2";

/** A photo's pin: its square thumbnail with a white edge, faded when its spot is approximate. */
export function PhotoSymbol({ approximate = false }: { approximate?: boolean }) {
  return (
    <MarkerTile>
      <span className={cn(PIN, "bg-muted", approximate ? "ring-white/40" : "ring-white")}>
        <Image className="size-2.5 text-muted-foreground" aria-hidden />
      </span>
    </MarkerTile>
  );
}

/** A group's marker: a round badge of its photos, darkened under its count. */
export function GroupSymbol() {
  return (
    <MarkerTile>
      <span className="flex size-5 items-center justify-center rounded-full bg-neutral-700 text-[0.6rem] font-semibold text-white ring-2 ring-white">
        3
      </span>
    </MarkerTile>
  );
}

/** A photo without resized versions yet: a small light-blue dot. */
export function NoImageSymbol() {
  return (
    <MarkerTile>
      <span className="size-3 rounded-full bg-sky-300 ring-2 ring-white" />
    </MarkerTile>
  );
}

/** A trip line's sample, drawn the size of a marker's tile. */
function LineSample({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 32 24" className="h-6 w-8" aria-hidden>
      {children}
    </svg>
  );
}

/** A walk: a solid blue line. */
export function WalkSymbol({ dark }: { dark: boolean }) {
  return (
    <LineSample>
      <path
        d="M3 17 Q16 3 29 12"
        fill="none"
        stroke={tripColors(dark).walk}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </LineSample>
  );
}

/** Hops along transit lines: a solid line split into the colors of the lines ridden. */
export function RideSymbol({ colors }: { colors: string[] }) {
  const step = 26 / colors.length;
  return (
    <LineSample>
      {colors.map((color, i) => (
        <line
          key={color}
          x1={3 + i * step}
          x2={3 + (i + 1) * step}
          y1={12}
          y2={12}
          stroke={color}
          strokeWidth={3}
        />
      ))}
    </LineSample>
  );
}

/** A hop with no transit line picked: a dashed purple line. */
export function HopSymbol({ dark }: { dark: boolean }) {
  return (
    <LineSample>
      <line
        x1={3}
        x2={29}
        y1={12}
        y2={12}
        stroke={tripColors(dark).hop}
        strokeWidth={2}
        strokeDasharray="4 4"
      />
    </LineSample>
  );
}

/** A place visited: an amber dot with an edge like the map's background. */
export function VisitSymbol({ dark }: { dark: boolean }) {
  const colors = tripColors(dark);
  return (
    <LineSample>
      <circle cx={16} cy={12} r={5} fill={colors.visit} stroke={colors.visitEdge} strokeWidth={2} />
    </LineSample>
  );
}

/** An area: light-blue shading with a dashed edge. */
export function AreaSymbol({ dark }: { dark: boolean }) {
  const colors = areaColors(dark);
  return (
    <LineSample>
      <rect
        x={4}
        y={4}
        width={24}
        height={16}
        rx={3}
        fill={colors.fill}
        fillOpacity={0.22}
        stroke={colors.edge}
        strokeWidth={2}
        strokeDasharray="3 2"
      />
    </LineSample>
  );
}
