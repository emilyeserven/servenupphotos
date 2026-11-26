import { CrosshairIcon, GridIcon, HashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { moveStoredKey } from "@portfolio/lib/stored-value";

/** Guides drawn over the square to help compose it. */
export type Overlay = "thirds" | "center" | "grid";

const OVERLAYS: { id: Overlay; label: string; Icon: typeof HashIcon }[] = [
  { id: "thirds", label: "Rule of thirds", Icon: HashIcon },
  { id: "center", label: "Center", Icon: CrosshairIcon },
  { id: "grid", label: "Grid", Icon: GridIcon },
];

/** How many cells a side of the grid overlay has. */
const GRID_CELLS = 6;

/** Where this browser remembers which overlays are on. */
const OVERLAYS_KEY = "pipeline-thumbnail-crop-overlays";
moveStoredKey("thumbnail-crop-overlays", OVERLAYS_KEY);

function storedOverlays(): Overlay[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(OVERLAYS_KEY) ?? "[]");
    return Array.isArray(stored)
      ? OVERLAYS.map(({ id }) => id).filter((id) => stored.includes(id))
      : [];
  } catch {
    return [];
  }
}

/** The overlays turned on, remembered in this browser so the next photo starts with them. */
export function useOverlays() {
  const [overlays, setOverlays] = useState<Overlay[]>(storedOverlays);
  const toggle = (overlay: Overlay) =>
    setOverlays((current) => {
      const next = current.includes(overlay)
        ? current.filter((id) => id !== overlay)
        : [...current, overlay];
      try {
        localStorage.setItem(OVERLAYS_KEY, JSON.stringify(next));
      } catch {
        // Not remembered, but still shown.
      }
      return next;
    });
  return [overlays, toggle] as const;
}

interface OverlayTogglesProps {
  overlays: Overlay[];
  onToggle: (overlay: Overlay) => void;
}

/** Turns each overlay on the square and its preview on or off. */
export function OverlayToggles({ overlays, onToggle }: OverlayTogglesProps) {
  return (
    <div role="group" aria-label="Overlays" className="flex flex-wrap items-center gap-2">
      <span className="text-muted-foreground text-sm">Overlays</span>
      {OVERLAYS.map(({ id, label, Icon }) => {
        const shown = overlays.includes(id);
        return (
          <Button
            key={id}
            variant={shown ? "secondary" : "outline"}
            size="sm"
            aria-pressed={shown}
            onClick={() => onToggle(id)}
          >
            <Icon />
            {label}
          </Button>
        );
      })}
    </div>
  );
}

/** Where each overlay's lines fall, as fractions of the square's side. */
function overlayLines(overlays: Overlay[]) {
  const lines = new Set<number>();
  if (overlays.includes("grid")) {
    for (let i = 1; i < GRID_CELLS; i++) lines.add(i / GRID_CELLS);
  }
  if (overlays.includes("thirds")) {
    lines.add(1 / 3);
    lines.add(2 / 3);
  }
  return lines;
}

/** The overlays' lines, stretched over whatever square they sit in. */
export function CropOverlays({ overlays }: { overlays: Overlay[] }) {
  if (overlays.length === 0) return null;
  const thirds = overlays.includes("thirds");
  // Grid lines are fainter than the thirds, so the thirds stand out when both are on.
  const lines = [...overlayLines(overlays)].map((at) => ({
    at: at * 100,
    strong: thirds && (Math.abs(at - 1 / 3) < 1e-9 || Math.abs(at - 2 / 3) < 1e-9),
  }));
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-0 size-full overflow-visible drop-shadow-[0_0_1px_rgb(0_0_0/0.8)]"
    >
      {lines.map(({ at, strong }) => (
        <g
          key={at}
          stroke="white"
          strokeOpacity={strong ? 0.9 : 0.5}
          strokeWidth={strong ? 1.5 : 1}
          vectorEffect="non-scaling-stroke"
        >
          <line x1={at} y1={0} x2={at} y2={100} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={at} x2={100} y2={at} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
      {overlays.includes("center") && <CenterReticle />}
    </svg>
  );
}

/** The ends of the reticle's four arms, from just outside the middle to past its circle. */
const RETICLE_ARMS = [
  [50, 22, 50, 46],
  [50, 54, 50, 78],
  [22, 50, 46, 50],
  [54, 50, 78, 50],
];

/** The reticle's circle, dot and arms, drawn once as a dark halo and once in white over it. */
function ReticleShape({ halo }: { halo?: boolean }) {
  return (
    <g
      fill="none"
      stroke={halo ? "black" : "white"}
      strokeOpacity={halo ? 0.55 : 0.95}
      strokeWidth={halo ? 4 : 2}
      strokeLinecap="round"
    >
      <circle cx={50} cy={50} r={14} vectorEffect="non-scaling-stroke" />
      <circle cx={50} cy={50} r={0.6} vectorEffect="non-scaling-stroke" />
      {RETICLE_ARMS.map(([x1, y1, x2, y2]) => (
        <line key={`${x1},${y1}`} {...{ x1, y1, x2, y2 }} vectorEffect="non-scaling-stroke" />
      ))}
    </g>
  );
}

/** The Center overlay: a circle round the middle with long crosshair arms, clear on any photo. */
function CenterReticle() {
  return (
    <>
      <ReticleShape halo />
      <ReticleShape />
    </>
  );
}
