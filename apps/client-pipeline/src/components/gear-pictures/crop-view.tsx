import { type PointerEvent, useRef, useState } from "react";
import type { GearCrop, GearFile } from "@portfolio/lib/gear-pictures";
import { Busy, SaveNote } from "@/components/entry-buttons";
import { CropLimitFields, CropLimitLines } from "@/components/gear-pictures/crop-limits";
import type { GearPictureEditor } from "@/components/gear-pictures/use-gear-picture";
import { Button } from "@/components/ui/button";
import { cropStyle, moveCrop, sameCrop, wholeCrop, zoomCrop, zoomOf } from "@/lib/gear-crop";

/** A gear picture file that has an original and a crop, which can be shown over another's. */
type CroppedFile = GearFile & { original: string; crop: GearCrop };

/** The other cameras' or lenses' files with a crop, to line this one up with. */
export function croppedFiles(files: GearFile[]): CroppedFile[] {
  return files.filter((file): file is CroppedFile => Boolean(file.original && file.crop));
}

/** A checkerboard, so a transparent background shows as one. */
const CHECKER = {
  backgroundImage: "conic-gradient(#e5e5e5 25%, #fff 0 50%, #e5e5e5 0 75%, #fff 0)",
  backgroundSize: "16px 16px",
};

/**
 * Lines up the picture's crop: a frame the shape of the crop the portfolio shows, which the
 * picture is dragged around in and zoomed with a slider, with the other cameras' or lenses' crops
 * drawn over it, faint, so every picture can be given the same size and place. **Cut crop** makes
 * the 200px-tall crop in R2.
 */
export function CropView({ editor, others }: { editor: GearPictureEditor; others: CroppedFile[] }) {
  const [overlay, setOverlay] = useState(0.3);
  const [size, setSize] = useState<[number, number]>();
  const { picture } = editor;
  if (!picture.original) return null;
  return (
    <section aria-label="Crop" className="flex flex-col gap-2 text-sm">
      <span className="font-medium">Crop</span>
      <p className="text-muted-foreground text-xs">
        Drag the picture to move it, and zoom with the slider: zoom out to give it room, filled with
        white or left transparent. {othersText(others.length)}
      </p>
      <CropFrame
        editor={editor}
        others={others}
        overlay={overlay}
        onSize={(w, h) => setSize([w, h])}
      />
      <CropControls editor={editor} size={size} overlay={overlay} onOverlay={setOverlay} />
      <CropLimitFields />
    </section>
  );
}

/** What the note says about the other crops drawn over the picture. */
function othersText(count: number): string {
  if (count === 0)
    return "Once other pictures have crops, they show over it, faint, to line up with.";
  const which = count === 1 ? "The other crop shows" : `The other ${count} crops show`;
  return `${which} over it, faint, so you can give every picture the same size and place.`;
}

/** The frame's background: white when the crop is filled with white, else a checkerboard. */
function backgroundOf(crop?: GearCrop) {
  return crop?.fill === "white" ? { background: "#fff" } : CHECKER;
}

interface CropFrameProps {
  editor: GearPictureEditor;
  others: CroppedFile[];
  overlay: number;
  onSize: (width: number, height: number) => void;
}

/** The crop's frame: the picture placed by its crop, the others over it, and center lines. */
function CropFrame({ editor, others, overlay, onSize }: CropFrameProps) {
  const { picture, setCrop } = editor;
  const drag = useDrag(picture.crop, setCrop);
  return (
    <div
      {...drag}
      className="relative aspect-[267/200] w-full max-w-[534px] cursor-grab touch-none overflow-hidden rounded-md border select-none active:cursor-grabbing"
      style={backgroundOf(picture.crop)}
    >
      <img
        src={picture.original}
        alt=""
        draggable={false}
        style={picture.crop ? cropStyle(picture.crop) : { visibility: "hidden" }}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          onSize(w, h);
          if (!picture.crop) setCrop(wholeCrop(w, h));
        }}
      />
      {others.map((file) => (
        <img
          key={file.id}
          src={file.original}
          alt=""
          draggable={false}
          className="pointer-events-none"
          style={{ ...cropStyle(file.crop), opacity: overlay }}
        />
      ))}
      <CenterLines />
      <CropLimitLines />
    </div>
  );
}

/** Dashed lines across the frame's middle, to line pictures up by. */
function CenterLines() {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 left-1/2 border-l border-dashed border-sky-500/60" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-sky-500/60" />
    </>
  );
}

/** Pointer handlers that move the crop as the picture is dragged around the frame. */
function useDrag(crop: GearCrop | undefined, setCrop: (crop: GearCrop) => void) {
  const last = useRef<{ x: number; y: number }>(undefined);
  return {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      last.current = { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (!last.current || !crop) return;
      const box = e.currentTarget.getBoundingClientRect();
      setCrop(
        moveCrop(
          crop,
          (e.clientX - last.current.x) / box.width,
          (e.clientY - last.current.y) / box.height,
        ),
      );
      last.current = { x: e.clientX, y: e.clientY };
    },
    onPointerUp: () => {
      last.current = undefined;
    },
  };
}

interface CropControlsProps {
  editor: GearPictureEditor;
  size?: [number, number];
  overlay: number;
  onOverlay: (overlay: number) => void;
}

/** The zoom and overlay sliders, **Whole picture**, and **Cut crop**. */
function CropControls({ editor, size, overlay, onOverlay }: CropControlsProps) {
  const { picture, setCrop } = editor;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <Range
        label="Zoom"
        min={-2}
        max={3}
        value={picture.crop ? zoomOf(picture.crop) : 0}
        onChange={(zoom) => picture.crop && setCrop(zoomCrop(picture.crop, zoom))}
      />
      <Range label="Others" min={0} max={1} value={overlay} onChange={onOverlay} />
      <FillChoice editor={editor} />
      <Button
        variant="outline"
        size="sm"
        disabled={!size}
        onClick={() => size && setCrop(wholeCrop(...size, picture.crop?.fill))}
      >
        Whole picture
      </Button>
      <CutButton editor={editor} />
    </div>
  );
}

/** The fills a crop can have around the picture, with their names. */
const FILLS: [GearCrop["fill"], string][] = [
  ["white", "White"],
  [undefined, "Transparent"],
];

/** Picks what fills the crop around the picture when it's zoomed out past its edges. */
function FillChoice({ editor }: { editor: GearPictureEditor }) {
  const { picture, setCrop } = editor;
  const { crop } = picture;
  if (!crop) return null;
  return (
    <div role="radiogroup" aria-label="Fill" className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground mr-1">Fill</span>
      {FILLS.map(([fill, label]) => (
        <Button
          key={label}
          role="radio"
          aria-checked={crop.fill === fill}
          variant={crop.fill === fill ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setCrop({ ...crop, fill })}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}

/** Cuts the crop lined up into the 200px-tall picture the portfolio shows. */
function CutButton({ editor }: { editor: GearPictureEditor }) {
  const { picture, cut, applyCrop } = editor;
  const done = sameCrop(picture.crop, picture.applied);
  return (
    <>
      <Button size="sm" disabled={done || cut.isPending} onClick={applyCrop}>
        <Busy busy={cut.isPending} />
        Cut crop
      </Button>
      <SaveNote error={cut.error} why={done ? "" : "The crop isn't cut yet."} />
    </>
  );
}

interface RangeProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

/** A labelled slider. */
function Range({ label, min, max, value, onChange }: RangeProps) {
  return (
    <label className="flex items-center gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        className="accent-primary w-28"
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
