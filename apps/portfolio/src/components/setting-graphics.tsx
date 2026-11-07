import { type ReactNode, useId } from "react";
import { MotionGraphic } from "@portfolio/components/motion-graphic";
import type { RangeKey } from "@portfolio/lib/camera-filters";
import {
  apertureOpening,
  backgroundBlur,
  exposureShare,
  grainCount,
  SETTING_NOTES,
  viewAngle,
} from "@portfolio/lib/setting-scales";

/** The size every setting graphic is drawn at. */
const WIDTH = 56;
const HEIGHT = 40;

/** An SVG at the graphics' size, with its own name for screen readers. */
function Graphic({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="shrink-0 text-foreground"
    >
      {children}
    </svg>
  );
}

/** A point on a circle around (cx, cy), `degrees` clockwise from straight up. */
function onCircle(cx: number, cy: number, r: number, degrees: number): string {
  const radians = (degrees * Math.PI) / 180;
  return `${cx + r * Math.sin(radians)} ${cy - r * Math.cos(radians)}`;
}

/** The angle of view at the focal length: a wedge opening up from a small camera. */
function FocalGraphic({ value }: { value: number }) {
  const half = viewAngle(value) / 2;
  const [cx, cy, r] = [WIDTH / 2, HEIGHT - 4, HEIGHT - 8];
  return (
    <Graphic label={`About ${Math.round(half * 2)}° angle of view`}>
      <path
        d={`M ${cx} ${cy} L ${onCircle(cx, cy, r, -half)} A ${r} ${r} 0 0 1 ${onCircle(cx, cy, r, half)} Z`}
        className="fill-primary/15 stroke-primary"
        strokeWidth={1}
      />
      <rect x={cx - 4} y={cy - 2} width={8} height={5} rx={1} className="fill-foreground" />
    </Graphic>
  );
}

/** The aperture at the f-number: a lens ring with an opening that shrinks as the f-number grows. */
function ApertureGraphic({ value }: { value: number }) {
  const [cx, cy, r] = [WIDTH / 2, HEIGHT / 2, HEIGHT / 2 - 3];
  return (
    <Graphic label={`Aperture opening at f/${value}`}>
      <circle cx={cx} cy={cy} r={r} className="fill-foreground/80" />
      <circle
        cx={cx}
        cy={cy}
        r={Math.max(1, r * apertureOpening(value))}
        className="fill-background"
      />
      <circle cx={cx} cy={cy} r={r} className="fill-none stroke-foreground" strokeWidth={1} />
    </Graphic>
  );
}

/**
 * What the aperture does to a photo: a person standing sharp in front of trees and hills that
 * blur more the wider the aperture opens.
 */
function DepthGraphic({ value }: { value: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Graphic label={`Background blur at f/${value}`}>
      <defs>
        <clipPath id={`frame${id}`}>
          <rect x={6} y={3} width={WIDTH - 12} height={HEIGHT - 6} rx={3} />
        </clipPath>
        <filter id={`blur${id}`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={backgroundBlur(value)} />
        </filter>
      </defs>
      <g clipPath={`url(#frame${id})`}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="fill-muted" />
        <g filter={`url(#blur${id})`}>
          <circle cx={14} cy={10} r={3.5} className="fill-foreground/25" />
          <path d="M 0 30 Q 14 18 28 28 T 56 24 V 40 H 0 Z" className="fill-foreground/30" />
          <path d="M 12 29 L 16 15 L 20 29 Z" className="fill-foreground/55" />
          <path d="M 38 27 L 43 12 L 48 27 Z" className="fill-foreground/55" />
        </g>
        <circle cx={27} cy={20} r={3.5} className="fill-foreground" />
        <path d="M 21 37 Q 21 25 27 25 Q 33 25 33 37 Z" className="fill-foreground" />
      </g>
      <rect
        x={6}
        y={3}
        width={WIDTH - 12}
        height={HEIGHT - 6}
        rx={3}
        className="fill-none stroke-foreground"
        strokeWidth={1}
      />
    </Graphic>
  );
}

/**
 * The exposure time: a dial filled further the longer the shutter stays open, with a moving ball
 * beside it showing how sharp or blurred it comes out.
 */
function ExposureGraphic({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1">
      <ExposureDial value={value} />
      <MotionGraphic value={value} />
    </div>
  );
}

/** A dial filled further the longer the shutter stays open. */
function ExposureDial({ value }: { value: string }) {
  const share = exposureShare(value);
  const [cx, cy, r] = [WIDTH / 2, HEIGHT / 2, HEIGHT / 2 - 3];
  const degrees = Math.max(4, share * 359.9);
  return (
    <Graphic label={`Shutter open for ${value}s`}>
      <circle cx={cx} cy={cy} r={r} className="fill-muted stroke-foreground" strokeWidth={1} />
      <path
        d={`M ${cx} ${cy} L ${onCircle(cx, cy, r, 0)} A ${r} ${r} 0 ${degrees > 180 ? 1 : 0} 1 ${onCircle(cx, cy, r, degrees)} Z`}
        className="fill-primary/60"
      />
      <circle cx={cx} cy={cy} r={1.5} className="fill-foreground" />
    </Graphic>
  );
}

/** A spot from 0 to 1 that's the same for the same grain, so the noise doesn't jump around. */
function spot(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** The ISO: a small scene with grains of noise sprinkled over it, more the higher it goes. */
function IsoGraphic({ value }: { value: number }) {
  const grains = Array.from({ length: grainCount(value) }, (_, index) => index);
  return (
    <Graphic label={`Noise at ISO ${value}`}>
      <rect
        x={6}
        y={3}
        width={WIDTH - 12}
        height={HEIGHT - 6}
        rx={3}
        className="fill-muted stroke-foreground"
        strokeWidth={1}
      />
      <circle cx={WIDTH - 18} cy={13} r={5} className="fill-primary/40" />
      {grains.map((index) => (
        <circle
          key={index}
          cx={8 + spot(index + 1) * (WIDTH - 16)}
          cy={5 + spot(index + 101) * (HEIGHT - 10)}
          r={0.9}
          className="fill-foreground/70"
        />
      ))}
    </Graphic>
  );
}

/** Each setting's graphic for one of its values, as the photos write it. */
const GRAPHICS: Record<RangeKey, (value: string) => ReactNode> = {
  focalLength: (value) => <FocalGraphic value={Number(value)} />,
  aperture: (value) => (
    <div className="flex items-center gap-1">
      <ApertureGraphic value={Number(value)} />
      <DepthGraphic value={Number(value)} />
    </div>
  ),
  exposure: (value) => <ExposureGraphic value={value} />,
  iso: (value) => <IsoGraphic value={Number(value)} />,
};

/** One end of the range: its graphic over what it means and its value. */
function End({
  setting,
  value,
  note,
  text,
}: {
  setting: RangeKey;
  value: string;
  note: string;
  text: string;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      {GRAPHICS[setting](value)}
      <span className="text-xs font-medium">{text}</span>
      <span className="text-[0.7rem] text-muted-foreground">{note}</span>
    </div>
  );
}

/**
 * Little graphics of what the slider's low and high ends look like in a photo, such as the angle
 * of view at 18mm and at 135mm, with a sentence explaining the setting. `low` and `high` are the
 * ends as the photos have them, and `write` writes each one as a photographer does.
 */
export function SettingIllustration({
  setting,
  low,
  high,
  write,
}: {
  setting: RangeKey;
  low: string | undefined;
  high: string | undefined;
  write: (value: string) => string;
}) {
  const note = SETTING_NOTES[setting];
  return (
    <div className="flex flex-col gap-3">
      {low !== undefined && high !== undefined && (
        <div className="flex items-start justify-around gap-2 sm:flex-col sm:items-center">
          <End setting={setting} value={low} note={note.low} text={write(low)} />
          {high !== low && (
            <End setting={setting} value={high} note={note.high} text={write(high)} />
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground">{note.text}</p>
    </div>
  );
}
