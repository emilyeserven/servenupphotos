import { LayoutGridIcon, RectangleHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Switches Photo Pages between the editing view, each page large with its controls, and the grid
 * of small previews to drag into a new order.
 */
export function PagesViewToggle({
  grid,
  onGrid,
}: {
  grid: boolean;
  onGrid: (grid: boolean) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Photo Pages view" className="flex gap-1">
      <Button
        size="sm"
        role="radio"
        aria-checked={!grid}
        variant={grid ? "outline" : "secondary"}
        onClick={() => onGrid(false)}
      >
        <RectangleHorizontalIcon />
        Edit pages
      </Button>
      <Button
        size="sm"
        role="radio"
        aria-checked={grid}
        variant={grid ? "secondary" : "outline"}
        onClick={() => onGrid(true)}
      >
        <LayoutGridIcon />
        Grid to reorder
      </Button>
    </div>
  );
}
