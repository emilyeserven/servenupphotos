import type { ReactNode } from "react";
import { type CameraKind, cameraKind, type LensSpecs } from "@portfolio/lib/gear-kinds";

/** A small line drawing at the size of a list row's icon. */
function Icon({ children, width = 28 }: { children: ReactNode; width?: number }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} 20`}
      width={width}
      height={20}
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

/** A little drawing of the kind of camera a model is, such as a DSLR for "Canon EOS 80D". */
export function CameraGraphic({ name }: { name: string }) {
  return <Icon>{CAMERA_DRAWINGS[cameraKind(name)]}</Icon>;
}

/**
 * A lens from the side, longer the longer its focal length and with a zoom ring when it zooms,
 * so a 10–18mm wide angle is short and a 55–250mm telephoto long.
 */
export function LensGraphic({ specs }: { specs: LensSpecs }) {
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
