import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CombinedPhoto } from "@/lib/group-photos";
import { originalHref } from "@/lib/original-download";

/**
 * A small button that downloads the photo's original JPEG from R2, named after the photo, to send
 * to the printer; a note instead when its JSON has no original in R2.
 */
export function DownloadOriginalButton({ photo }: { photo: CombinedPhoto }) {
  const href = originalHref(photo);
  if (!href) return <span className="text-muted-foreground text-xs">No original JPEG in R2</span>;
  return (
    <Button asChild variant="outline" size="sm" className="self-start">
      <a href={href} download>
        <DownloadIcon />
        Original JPEG
      </a>
    </Button>
  );
}
