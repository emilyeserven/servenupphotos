import { type KeyboardEvent, type PointerEvent, useRef } from "react";
import type { Size } from "@/lib/crop";
import {
  type BoxCorner,
  type FaceBox,
  areaName,
  boxText,
  keyedBox,
  movedBox,
  resizedBox,
} from "@/lib/face-boxes";
import { cn } from "@/lib/utils";

// The handles sit just inside the box's corners, so the photo's edge never clips them.
const CORNERS: (BoxCorner & { className: string; label: string })[] = [
  { dx: -1, dy: -1, className: "top-0.5 left-0.5 cursor-nwse-resize", label: "top left" },
  { dx: 1, dy: -1, className: "top-0.5 right-0.5 cursor-nesw-resize", label: "top right" },
  { dx: -1, dy: 1, className: "bottom-0.5 left-0.5 cursor-nesw-resize", label: "bottom left" },
  { dx: 1, dy: 1, className: "right-0.5 bottom-0.5 cursor-nwse-resize", label: "bottom right" },
];

/** Where a box sits on the photo, in percentages of the photo's displayed size. */
function boxStyle(face: FaceBox, photo: Size) {
  return {
    left: `${(face.x / photo.width) * 100}%`,
    top: `${(face.y / photo.height) * 100}%`,
    width: `${(face.width / photo.width) * 100}%`,
    height: `${(face.height / photo.height) * 100}%`,
  };
}

/** What a drag under way started from. */
interface Drag {
  /** The corner being dragged, or none when moving the whole box. */
  corner?: BoxCorner;
  pointerX: number;
  pointerY: number;
  start: FaceBox;
  /** Photo pixels per screen pixel. */
  scale: number;
}

/** face after a drag from `drag` moved by dx, dy screen pixels. */
function dragged(drag: Drag, dx: number, dy: number, photo: Size): FaceBox {
  const [x, y] = [dx * drag.scale, dy * drag.scale];
  return drag.corner
    ? resizedBox(drag.start, drag.corner, x, y, photo)
    : movedBox(drag.start, x, y, photo);
}

/** Moves the box when it's dragged, and resizes it when a corner is. */
function useBoxDrag(
  face: FaceBox,
  photo: Size,
  onSelect: () => void,
  onChange: (face: FaceBox) => void,
) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const start = (event: PointerEvent<HTMLElement>, corner?: BoxCorner) => {
    event.stopPropagation();
    if (!box.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onSelect();
    const scale = face.width / box.current.clientWidth;
    drag.current = { corner, pointerX: event.clientX, pointerY: event.clientY, start: face, scale };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    const current = drag.current;
    if (current)
      onChange(
        dragged(current, event.clientX - current.pointerX, event.clientY - current.pointerY, photo),
      );
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation();
    drag.current = null;
  };
  return { box, start, handlers: { onPointerMove: move, onPointerUp: end, onPointerCancel: end } };
}

interface FaceBoxOverlayProps {
  index: number;
  face: FaceBox;
  photo: Size;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
  onChange: (face: FaceBox) => void;
}

/** One face's box over the preview: drag to move it, drag a corner of the picked one to resize it. */
export function FaceBoxOverlay(props: FaceBoxOverlayProps) {
  if (props.locked) {
    return (
      <div
        aria-hidden
        style={boxStyle(props.face, props.photo)}
        className={boxClass(props.selected, props.face)}
      >
        <BoxNumber index={props.index} face={props.face} />
      </div>
    );
  }
  return <EditableBox {...props} />;
}

/** A face's outline in white, a kept area's in sky blue; solid once picked, round for a circle. */
const OUTLINES = {
  face: { selected: "border-white", idle: "border-white/60" },
  keep: { selected: "border-sky-300", idle: "border-sky-300/70" },
};

function boxClass(selected: boolean, face: FaceBox) {
  const colors = OUTLINES[face.keep ? "keep" : "face"];
  return cn(
    "absolute border-2",
    face.shape === "circle" && "rounded-[50%]",
    selected
      ? `${colors.selected} shadow-[0_0_0_1px_rgb(0_0_0/0.6)]`
      : `${colors.idle} border-dashed`,
  );
}

/** The area's name, as the list below has it. */
function BoxNumber({ index, face }: { index: number; face: FaceBox }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-sm bg-black/60 px-1 text-[10px] font-medium whitespace-nowrap text-white",
        // A kept area's name sits at its bottom, so it doesn't cover the face it overlaps.
        face.keep ? "bottom-0.5" : "top-0.5",
      )}
    >
      {areaName(face, index)}
    </span>
  );
}

function EditableBox({ index, face, photo, selected, onSelect, onChange }: FaceBoxOverlayProps) {
  const { box, start, handlers } = useBoxDrag(face, photo, onSelect, onChange);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = keyedBox(event.key, event.shiftKey, face, photo);
    if (!next) return;
    event.preventDefault();
    onChange(next);
  };
  return (
    <div
      ref={box}
      role="button"
      tabIndex={0}
      aria-label={`${areaName(face, index)}: ${boxText(face)}`}
      aria-pressed={selected}
      onFocus={onSelect}
      onKeyDown={onKeyDown}
      onPointerDown={(event) => start(event)}
      {...handlers}
      style={boxStyle(face, photo)}
      className={cn(
        boxClass(selected, face),
        "focus-visible:ring-ring cursor-move outline-none focus-visible:ring-[3px]",
      )}
    >
      <BoxNumber index={index} face={face} />
      {selected &&
        CORNERS.map((corner) => (
          <span
            key={corner.label}
            aria-hidden
            onPointerDown={(event) => start(event, corner)}
            {...handlers}
            className={cn(
              "absolute size-3 rounded-full border border-black/40 bg-white shadow-sm",
              corner.className,
            )}
          />
        ))}
    </div>
  );
}
