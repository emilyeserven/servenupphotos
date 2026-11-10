import { Trash2Icon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { type FaceBox, MAX_BLOCKS, MIN_BLOCKS, blockSide, roundedBox } from "@/lib/face-boxes";
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
  const id = useId();
  const { width, height, blocks } = roundedBox(face);
  return (
    <li
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-md border p-2 text-sm",
        selected && "border-primary bg-muted/50",
      )}
    >
      <button type="button" onClick={onSelect} className="text-left" aria-pressed={selected}>
        <span className="font-medium">Face {index + 1}</span>{" "}
        <span className="text-muted-foreground text-xs">
          {width} × {height} px
        </span>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Remove face ${index + 1}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2Icon />
      </Button>
      <div className="col-span-2 flex items-center gap-3">
        <label htmlFor={id} className="text-muted-foreground text-xs">
          Density
        </label>
        <input
          id={id}
          type="range"
          min={MIN_BLOCKS}
          max={MAX_BLOCKS}
          step={1}
          value={blocks}
          disabled={disabled}
          onFocus={onSelect}
          onChange={(event) => onChange({ ...face, blocks: Number(event.target.value) })}
          aria-valuetext={`${blocks} blocks across`}
          className="accent-primary min-w-0 flex-1"
        />
        <span className="w-32 text-right text-xs tabular-nums">
          {blocks} blocks <span className="text-muted-foreground">· ~{blockSide(face)} px</span>
        </span>
      </div>
    </li>
  );
}
