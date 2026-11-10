import { Trash2Icon } from "lucide-react";
import { type ReactNode, useId } from "react";
import { AreaOptions } from "@/components/face-pixelation/area-options";
import { Button } from "@/components/ui/button";
import {
  type FaceBox,
  MAX_BLOCKS,
  MIN_BLOCKS,
  areaName,
  blockSide,
  normalRotation,
  roundedBox,
} from "@/lib/face-boxes";
import { cn } from "@/lib/utils";

interface FaceListProps {
  faces: FaceBox[];
  selected: number | null;
  onSelect: (index: number) => void;
  onFacesChange: (faces: FaceBox[]) => void;
  disabled: boolean;
}

/** Each face's box with its own density slider and a way to remove it. */
export function FaceList({ faces, selected, onSelect, onFacesChange, disabled }: FaceListProps) {
  if (faces.length === 0) return null;
  const change = (index: number, next: FaceBox) =>
    onFacesChange(faces.map((face, i) => (i === index ? next : face)));
  return (
    <ul className="flex flex-col gap-2">
      {faces.map((face, index) => (
        <FaceRow
          // Boxes have no ids of their own; their place in the list is what the page names them by.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
          index={index}
          face={face}
          selected={selected === index}
          onSelect={() => onSelect(index)}
          onChange={(next) => change(index, next)}
          onRemove={() => onFacesChange(faces.filter((_, i) => i !== index))}
          disabled={disabled}
        />
      ))}
    </ul>
  );
}

interface FaceRowProps {
  index: number;
  face: FaceBox;
  selected: boolean;
  onSelect: () => void;
  onChange: (face: FaceBox) => void;
  onRemove: () => void;
  disabled: boolean;
}

function FaceRow({ index, face, selected, onSelect, onChange, onRemove, disabled }: FaceRowProps) {
  const { width, height } = roundedBox(face);
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md border p-2 text-sm",
        selected && "border-primary bg-muted/50",
      )}
    >
      <button type="button" onClick={onSelect} className="text-left" aria-pressed={selected}>
        <span className="font-medium">{areaName(face, index)}</span>{" "}
        <span className="text-muted-foreground text-xs">
          {width} × {height} px
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove ${areaName(face, index)}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
      <AreaOptions face={face} onChange={onChange} disabled={disabled} />
      {!face.keep && (
        <DensitySlider face={face} onChange={onChange} onFocus={onSelect} disabled={disabled} />
      )}
      <TurnSlider face={face} onChange={onChange} onFocus={onSelect} disabled={disabled} />
    </li>
  );
}

interface SliderRowProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
  onFocus: () => void;
  disabled: boolean;
  /** What the slider's value means, for screen readers. */
  valueText: string;
  /** What's shown at the right of the slider. */
  readout: ReactNode;
}

/** A labelled slider across an area's row, with what it's set to at its right. */
function SliderRow({ label, onChange, valueText, readout, ...input }: SliderRowProps) {
  const id = useId();
  return (
    <div className="col-span-2 flex items-center gap-3">
      <label htmlFor={id} className="text-muted-foreground w-14 text-xs">
        {label}
      </label>
      <input
        id={id}
        type="range"
        step={1}
        {...input}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-valuetext={valueText}
        className="accent-primary min-w-0 flex-1"
      />
      <span className="w-32 text-right text-xs tabular-nums">{readout}</span>
    </div>
  );
}

interface AreaSliderProps {
  face: FaceBox;
  onChange: (face: FaceBox) => void;
  onFocus: () => void;
  disabled: boolean;
}

/** How many blocks fit across the face, and how big each is on the photo. */
function DensitySlider({ face, onChange, ...props }: AreaSliderProps) {
  const { blocks } = roundedBox(face);
  return (
    <SliderRow
      label="Density"
      min={MIN_BLOCKS}
      max={MAX_BLOCKS}
      value={blocks}
      onChange={(next) => onChange({ ...face, blocks: next })}
      valueText={`${blocks} blocks across`}
      readout={
        <>
          {blocks} blocks <span className="text-muted-foreground">· ~{blockSide(face)} px</span>
        </>
      }
      {...props}
    />
  );
}

/** How far the area is turned, clockwise, from -180° to 180°. */
function TurnSlider({ face, onChange, ...props }: AreaSliderProps) {
  const turn = normalRotation(face.rotation ?? 0);
  return (
    <SliderRow
      label="Turn"
      min={-180}
      max={180}
      value={turn}
      onChange={(next) => onChange({ ...face, rotation: next })}
      valueText={`turned ${turn} degrees`}
      readout={`${turn}°`}
      {...props}
    />
  );
}
