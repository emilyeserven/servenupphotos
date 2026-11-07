import { exposureShare } from "@portfolio/lib/setting-scales";

/** The size the moving subject is drawn at, the same as the other setting graphics. */
const WIDTH = 56;
const HEIGHT = 40;

/** The moving ball's radius and the line it rolls along. */
const BALL = 5;
const GROUND = HEIGHT - 9;

/** How far the ball travels while the shutter is open, in the graphic's units. */
function travel(share: number): number {
  return share * (WIDTH - 2 * BALL - 14);
}

/** Speed lines trailing behind the ball, as long as the distance it moved. */
function SpeedLines({ start, length }: { start: number; length: number }) {
  if (length < 3) return null;
  return [-3, 0, 3].map((offset) => (
    <line
      key={offset}
      x1={start}
      x2={start + length}
      y1={GROUND - BALL + offset}
      y2={GROUND - BALL + offset}
      className="stroke-foreground/40"
      strokeWidth={0.75}
      strokeLinecap="round"
    />
  ));
}

/**
 * A ball rolling to the right, as a photo at the exposure time catches it: sharp at a fast
 * shutter, and smeared into a fading streak the longer the shutter stays open.
 */
export function MotionGraphic({ value }: { value: string }) {
  const share = exposureShare(value);
  const length = travel(share);
  const start = (WIDTH - length) / 2 - BALL;
  return (
    <svg
      role="img"
      aria-label={
        share < 0.35 ? "A moving ball frozen sharp" : "A moving ball blurred into a streak"
      }
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="shrink-0 text-foreground"
    >
      <line x1={4} x2={WIDTH - 4} y1={GROUND} y2={GROUND} className="stroke-foreground/50" />
      <rect
        x={start}
        y={GROUND - 2 * BALL}
        width={length + 2 * BALL}
        height={2 * BALL}
        rx={BALL}
        className="fill-primary/25"
      />
      <SpeedLines start={start + BALL} length={length} />
      <circle
        cx={start + length + BALL}
        cy={GROUND - BALL}
        r={BALL}
        className="fill-primary stroke-foreground"
        strokeWidth={1}
        opacity={1 - 0.75 * share}
      />
    </svg>
  );
}
