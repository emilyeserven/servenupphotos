import { WifiOffIcon } from "lucide-react";
import type { InFlightImages } from "@/api/photos";

/**
 * Says the page is showing the offline copy, when R2 couldn't be reached: the images found the last
 * time it could be, with the Square Thumbnails kept on this computer. Nothing without one.
 */
export function OfflineNotice({ images }: { images: InFlightImages }) {
  if (!images.offline) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
    >
      <WifiOffIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-medium">Offline.</span> R2 can&apos;t be reached, so the thumbnails
        shown are the ones kept on this computer. Saves still wait for Commit, which needs the
        internet, as do uploads and full-size images.
      </span>
    </p>
  );
}
