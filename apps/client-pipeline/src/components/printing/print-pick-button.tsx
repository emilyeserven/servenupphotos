import { HeartIcon } from "lucide-react";
import type { CombinedPhoto } from "@/lib/group-photos";
import { togglePick } from "@/lib/print-picks";
import { photoKey, printPhotoName } from "@/lib/print-queue";
import { cn } from "@/lib/utils";
import { printPicks } from "@/stores/printing";

/** A heart over a print queue photo's corner that marks it as one to actually print, or unmarks it. */
export function PrintPickButton({ photo }: { photo: CombinedPhoto }) {
  const picks = printPicks.use();
  const key = photoKey(photo);
  const picked = picks.includes(key);
  return (
    <button
      type="button"
      aria-pressed={picked}
      aria-label={`${picked ? "Un-heart" : "Heart"} ${printPhotoName(photo)} to print`}
      title={picked ? "Hearted to print" : "Heart to print"}
      onClick={() => printPicks.set(togglePick(picks, key))}
      className="bg-background/85 hover:bg-background focus-visible:ring-ring absolute top-2 right-2 flex size-8 items-center justify-center rounded-full shadow-sm outline-none focus-visible:ring-2"
    >
      <HeartIcon
        className={cn("size-4", picked ? "fill-rose-500 text-rose-500" : "text-muted-foreground")}
        aria-hidden
      />
    </button>
  );
}
