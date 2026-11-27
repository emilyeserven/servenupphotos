import { Input } from "@/components/ui/input";
import { printMinPpi } from "@/stores/printing";

/** The print queue's minimum pixels per inch: photos that print below it are grayed out. */
export function MinPpiField() {
  const minimum = printMinPpi.use();
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Minimum PPI</span>
      <Input
        type="number"
        min={0}
        step={10}
        inputMode="numeric"
        placeholder="None"
        className="h-8 w-24"
        value={minimum > 0 ? minimum : ""}
        onChange={(event) =>
          printMinPpi.set(Math.max(0, Math.round(Number(event.target.value) || 0)))
        }
      />
      <span className="text-muted-foreground">
        Photos that print below this at the size picked are grayed out, but stay in the queue.
      </span>
    </label>
  );
}
