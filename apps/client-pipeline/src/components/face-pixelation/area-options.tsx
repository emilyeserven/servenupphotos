import { Button } from "@/components/ui/button";
import type { CircleEdge, FaceBox, FaceShape } from "@/lib/face-boxes";

interface Choice<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled: boolean;
}

/** A row of small buttons, one pressed: a choice between a few options. */
function Segmented<T extends string>({
  label,
  choices,
  value,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className="bg-muted inline-flex rounded-md p-0.5">
      {choices.map((choice) => (
        <Button
          key={choice.value}
          variant={choice.value === value ? "outline" : "ghost"}
          size="sm"
          className="h-7 px-2 text-xs"
          aria-pressed={choice.value === value}
          disabled={disabled}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </Button>
      ))}
    </div>
  );
}

type Kind = "pixelate" | "keep";

const KINDS: Choice<Kind>[] = [
  { value: "pixelate", label: "Pixelate" },
  { value: "keep", label: "Keep as is" },
];

const SHAPES: Choice<FaceShape>[] = [
  { value: "box", label: "Box" },
  { value: "circle", label: "Circle" },
];

const EDGES: Choice<CircleEdge>[] = [
  { value: "inside", label: "Inside the circle" },
  { value: "blocks", label: "Whole blocks" },
];

interface AreaOptionsProps {
  face: FaceBox;
  onChange: (face: FaceBox) => void;
  disabled: boolean;
}

/**
 * Whether the area is pixelated or kept as it is, its shape, and for a pixelated circle whether only
 * its inside is pixelated or every block it touches.
 */
export function AreaOptions({ face, onChange, disabled }: AreaOptionsProps) {
  return (
    <div className="col-span-2 flex flex-wrap items-center gap-2">
      <Segmented
        label="Pixelate or keep"
        choices={KINDS}
        value={kindOf(face)}
        onChange={(kind) => onChange({ ...face, keep: kind === "keep" })}
        disabled={disabled}
      />
      <Segmented
        label="Shape"
        choices={SHAPES}
        value={shapeOf(face)}
        onChange={(shape) => onChange({ ...face, shape })}
        disabled={disabled}
      />
      <EdgeOptions face={face} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function kindOf(face: FaceBox): Kind {
  return face.keep ? "keep" : "pixelate";
}

function shapeOf(face: FaceBox): FaceShape {
  return face.shape ?? "box";
}

/** For a pixelated circle, whether only its inside is pixelated or every block it touches. */
function EdgeOptions({ face, onChange, disabled }: AreaOptionsProps) {
  if (shapeOf(face) !== "circle" || face.keep) return null;
  return (
    <Segmented
      label="Circle edge"
      choices={EDGES}
      value={face.edge ?? "inside"}
      onChange={(edge) => onChange({ ...face, edge })}
      disabled={disabled}
    />
  );
}
