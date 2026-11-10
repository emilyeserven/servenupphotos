import { type PointerEvent, type RefObject, useEffect, useRef, useState } from "react";
import type { Size } from "@/lib/crop";
import { drawPreview, type Loaded } from "@/components/face-pixelation/draw-preview";
import { FaceBoxOverlay } from "@/components/face-pixelation/face-box-overlay";
import { type FaceBox, drawnBox, isBigEnough } from "@/lib/face-boxes";
import { cn } from "@/lib/utils";

/**
 * The photo at src, once loaded. It's loaded without CORS, which is enough to draw it on a canvas:
 * the preview never reads its pixels back, so photos straight from R2 work too.
 */
function useLoadedPhoto(src: string): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    let current = true;
    const image = new Image();
    image.addEventListener("load", () => {
      // Browsers report the size of a photo turned upright from its EXIF orientation.
      if (current)
        setLoaded({ image, photo: { width: image.naturalWidth, height: image.naturalHeight } });
    });
    image.src = src;
    return () => {
      current = false;
    };
  }, [src]);
  return loaded;
}

interface FacePreviewProps {
  src: string;
  faces: FaceBox[];
  /** The face whose box is picked, to move, resize and change. */
  selected: number | null;
  onSelect: (index: number | null) => void;
  onFacesChange: (faces: FaceBox[]) => void;
  /** The photo's size, once it's loaded. */
  onLoad: (photo: Size) => void;
  /** Whether the boxes are drawn over the preview. */
  showBoxes: boolean;
  /** The faces can't change, while saving. */
  locked: boolean;
  /** How tall the photo may be drawn; 28rem unless set, such as taller in full screen. */
  maxHeight?: string;
}

/**
 * The photo as the versions will show it, with every face pixelated, and a box over each face to
 * drag, resize or pick. Dragging anywhere else draws a new box.
 */
export function FacePreview({ src, onLoad, ...props }: FacePreviewProps) {
  const loaded = useLoadedPhoto(src);
  useEffect(() => {
    if (loaded) onLoad(loaded.photo);
  }, [loaded, onLoad]);
  if (!loaded) return <p className="text-muted-foreground text-sm">Loading the photo…</p>;
  return <LoadedPreview loaded={loaded} {...props} />;
}

type LoadedPreviewProps = Omit<FacePreviewProps, "src" | "onLoad"> & { loaded: Loaded };

function LoadedPreview({
  loaded,
  faces,
  selected,
  onSelect,
  onFacesChange,
  showBoxes,
  locked,
  maxHeight = "28rem",
}: LoadedPreviewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (canvas.current) drawPreview(canvas.current, loaded, faces);
  }, [loaded, faces]);
  const draw = useDrawBox(frame, loaded.photo, faces, onFacesChange, onSelect);
  const boxes = showBoxes ? faces : [];

  return (
    <div
      ref={frame}
      className={cn(
        "relative mx-auto w-fit touch-none overflow-hidden rounded-lg border",
        !locked && "cursor-crosshair",
      )}
      {...(locked ? {} : draw)}
    >
      <canvas
        ref={canvas}
        aria-label="Preview of the photo with its faces pixelated"
        role="img"
        className="block max-w-full select-none"
        style={{ maxHeight }}
      />
      {boxes.map((face, index) => (
        <FaceBoxOverlay
          // Boxes have no ids of their own; their place in the list is what the page names them by.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          index={index}
          face={face}
          photo={loaded.photo}
          selected={selected === index}
          locked={locked}
          onSelect={() => onSelect(index)}
          onChange={(next) => onFacesChange(faces.map((f, i) => (i === index ? next : f)))}
        />
      ))}
    </div>
  );
}

/** The photo's pixels per screen pixel in the frame, and where a pointer is on the photo. */
function photoPoint(frame: HTMLElement, photo: Size, event: PointerEvent) {
  const rect = frame.getBoundingClientRect();
  const scale = photo.width / rect.width;
  return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
}

/** Drags on the photo outside every box draw a new box, picked once it's big enough to keep. */
function useDrawBox(
  frame: RefObject<HTMLDivElement | null>,
  photo: Size,
  faces: FaceBox[],
  onFacesChange: (faces: FaceBox[]) => void,
  onSelect: (index: number | null) => void,
) {
  const from = useRef<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const end = () => {
    from.current = null;
    drawing.current = false;
  };
  /** Draws the box from where the drag started to `to`, once it's big enough to keep. */
  const drawTo = (start: { x: number; y: number }, to: { x: number; y: number }) => {
    const box = drawnBox(start, to, photo);
    if (!isBigEnough(box)) return;
    // The first move big enough adds the box; later ones resize it.
    const next = drawing.current ? [...faces.slice(0, -1), box] : [...faces, box];
    drawing.current = true;
    onFacesChange(next);
    onSelect(next.length - 1);
  };
  return {
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => {
      if (!frame.current) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      from.current = photoPoint(frame.current, photo, event);
      onSelect(null);
    },
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => {
      if (from.current && frame.current)
        drawTo(from.current, photoPoint(frame.current, photo, event));
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
}
