import type { ReactNode } from "react";
import { type CameraKind, cameraKind, type LensSpecs, lensSpecs } from "@portfolio/lib/gear-kinds";
import { type GearFile, type GearKind, gearFile } from "@portfolio/lib/gear-pictures";

/** A small line drawing at the size of a list row's icon, or `scale` times that. */
function Icon({ children, scale = 1 }: { children: ReactNode; scale?: number }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 28 20"
      width={28 * scale}
      height={20 * scale}
      className="shrink-0 fill-none stroke-current text-muted-foreground"
      strokeWidth={1.3}
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** Each kind of camera's drawing: a body, its lens or screen, and a hump or grip where it has one. */
const CAMERA_DRAWINGS: Record<CameraKind, ReactNode> = {
  dslr: (
    <>
      <path d="M3 7h6l2-3h6l2 3h6v10H3z" />
      <circle cx={14} cy={11.5} r={4} />
      <path d="M3 7v10M7 7v10" />
    </>
  ),
  mirrorless: (
    <>
      <path d="M3 7h7l1.5-2.5h5L18 7h7v9H3z" />
      <circle cx={14} cy={11.5} r={3.3} />
      <circle cx={22} cy={4.5} r={1.2} />
    </>
  ),
  compact: (
    <>
      <rect x={4} y={6} width={20} height={10} rx={1.5} />
      <circle cx={17} cy={11} r={3} />
      <rect x={6} y={8} width={4} height={2} />
    </>
  ),
  phone: (
    <>
      <rect x={9} y={2} width={10} height={16} rx={2} />
      <circle cx={12} cy={5} r={1.2} />
    </>
  ),
};

/**
 * A big picture of a camera or lens for its details: `image` when given, else its own picture
 * from the Gear Pictures page, else a drawing of its kind of camera or of the lens from its name.
 */
export function GearPicture({
  kind,
  name,
  image,
}: {
  kind: GearKind;
  name: string;
  image?: string;
}) {
  const src = image ?? pictureOf(kind, name);
  if (!src) return <GearDrawing kind={kind} name={name} />;
  return (
    <img
      src={src}
      alt={name}
      width={267}
      height={200}
      className="h-[200px] w-[267px] max-w-full rounded-sm object-contain"
    />
  );
}

/**
 * The camera's or lens's sized picture from the Gear Pictures page, or "" when it has none. Only a
 * sized one (cut to 267 × 200 there) is shown, so every picture is the same size.
 */
function pictureOf(kind: GearKind, name: string): string {
  return sizedImage(gearFile(kind, name));
}

/** A gear file's picture when it has been sized, else "". */
function sizedImage(file?: GearFile): string {
  return file?.crop ? file.image : "";
}

/** A big drawing of the lens, from its name, or of the kind of camera it is. */
function GearDrawing({ kind, name }: { kind: GearKind; name: string }) {
  if (kind === "lens") return <LensGraphic specs={lensSpecs(name)} />;
  return <Icon scale={3}>{CAMERA_DRAWINGS[cameraKind(name)]}</Icon>;
}

/**
 * A lens from the side, longer the longer its focal length and with a zoom ring when it zooms,
 * so a 10–18mm wide angle is short and a 55–250mm telephoto long.
 */
function LensGraphic({ specs }: { specs: LensSpecs }) {
  const [low = 50, high = low] = specs.focal ?? [];
  const length = Math.round(14 + Math.min(56, Math.log2(high / 8) * 12));
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${length + 12} 32`}
      width={length + 12}
      height={32}
      className="shrink-0 fill-none stroke-current"
      strokeWidth={1.3}
      strokeLinejoin="round"
    >
      <rect x={1} y={9} width={5} height={14} rx={1} className="fill-current/30" />
      <path d={`M6 6h${length}l4 -3v26l-4 -3H6z`} className="fill-current/15" />
      {high > low && <ZoomRing length={length} />}
      <ellipse cx={length + 10} cy={16} rx={2} ry={13} className="fill-current/40" />
    </svg>
  );
}

/** The ridged zoom ring a zoom lens has, a third of the way along its barrel. */
function ZoomRing({ length }: { length: number }) {
  const [x, width] = [10, Math.max(6, length / 3)];
  return (
    <g>
      <rect x={x} y={6} width={width} height={20} className="fill-current/35" />
      {[0.25, 0.5, 0.75].map((at) => (
        <path key={at} d={`M${x + width * at} 6v20`} />
      ))}
    </g>
  );
}
