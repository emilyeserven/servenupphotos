import { DownloadOriginalButton } from "@/components/printing/download-original-button";
import { PrintPhotoTile } from "@/components/printing/print-photo-tile";
import { usePrintCheck } from "@/components/printing/print-rating";
import type { CombinedPhoto } from "@/lib/group-photos";
import { belowMinimum } from "@/lib/print-quality";
import { cn } from "@/lib/utils";
import { printMinPpi } from "@/stores/printing";

/**
 * One photo in the print queue: its tile with its rating and its Original JPEG download, grayed out
 * when it prints below the minimum PPI.
 */
export function QueueItem({ photo }: { photo: CombinedPhoto }) {
  const { check } = usePrintCheck(photo);
  const minimum = printMinPpi.use();
  const below = belowMinimum(check, minimum);
  return (
    <li
      className={cn(
        "flex flex-col gap-1 transition",
        below && "opacity-40 grayscale hover:opacity-70",
      )}
      title={below ? `Below the minimum of ${minimum} ppi` : undefined}
    >
      <PrintPhotoTile photo={photo} />
      <DownloadOriginalButton photo={photo} />
    </li>
  );
}
