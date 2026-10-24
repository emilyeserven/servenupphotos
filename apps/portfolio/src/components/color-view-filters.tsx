import { SlidersHorizontal } from "lucide-react";
import { useId, useState } from "react";
import { FilterCount } from "@/components/photo-filters";
import { Button } from "@/components/ui/button";
import { VividnessControl } from "@/components/vividness-control";
import type { VividMeasure } from "@/lib/color-sort";

/**
 * The Color page's **Filters** button, beside the view picker, which opens the vividness controls:
 * **Average / Peak** and **Vividness at least**. Hidden at first, so the wheel or chart gets the
 * room; while they're changed from their defaults, the button says how many.
 */
export function ColorViewFilters({
  vivid = 0,
  measure = "average",
}: {
  vivid?: number;
  measure?: VividMeasure;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const count = Number(vivid > 0) + Number(measure === "peak");
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal aria-hidden />
        {open ? "Hide filters" : "Filters"}
        <FilterCount count={count} />
      </Button>
      <div id={panelId} hidden={!open} className="w-full">
        {open && <VividnessControl vivid={vivid} measure={measure} />}
      </div>
    </>
  );
}
