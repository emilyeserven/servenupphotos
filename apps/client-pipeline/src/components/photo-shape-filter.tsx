import { Button } from "@/components/ui/button";
import type { PhotoShape } from "@/lib/aspect-ratio";
import type { CombinedPhoto } from "@/lib/group-photos";
import { PHOTO_SHAPES, shapeCounts } from "@/lib/photo-shapes";

/** What the quick filter calls each shape. */
const SHAPE_LABELS: Record<PhotoShape, string> = {
  landscape: "Landscape",
  portrait: "Portrait",
  square: "Square",
};

interface PhotoShapeFilterProps {
  /** Every photo the card shows, to count each shape in. */
  photos: CombinedPhoto[];
  /** The shape shown alone, or undefined for all of them. */
  value?: PhotoShape;
  onChange: (shape?: PhotoShape) => void;
}

/**
 * The quick filter on an album's Photos card: All, or only its landscape, portrait or square
 * photos, each with how many there are. Shapes no photo has are left out, and so is the filter when there's under two photos to filter.
 */
export function PhotoShapeFilter({ photos, value, onChange }: PhotoShapeFilterProps) {
  if (photos.length < 2) return null;
  const counts = shapeCounts(photos);
  const shapes = PHOTO_SHAPES.filter((shape) => counts[shape] > 0 || shape === value);
  return (
    <div role="group" aria-label="Orientation" className="flex flex-wrap gap-2">
      <ShapeButton label="All" n={photos.length} active={!value} onClick={() => onChange()} />
      {shapes.map((shape) => (
        <ShapeButton
          key={shape}
          label={SHAPE_LABELS[shape]}
          n={counts[shape]}
          active={value === shape}
          onClick={() => onChange(shape)}
        />
      ))}
    </div>
  );
}

interface ShapeButtonProps {
  label: string;
  n: number;
  active: boolean;
  onClick: () => void;
}

function ShapeButton({ label, n, active, onClick }: ShapeButtonProps) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
      <span className="tabular-nums opacity-70">{n}</span>
    </Button>
  );
}
