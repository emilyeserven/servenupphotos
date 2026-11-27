import { Link } from "@tanstack/react-router";
import { ImageOffIcon } from "lucide-react";
import { PrintRatingBadge, usePrintCheck } from "@/components/printing/print-rating";
import { type CombinedPhoto, photoImage } from "@/lib/group-photos";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { photoKey, printPhotoName } from "@/lib/print-queue";
import { cn } from "@/lib/utils";

/**
 * A photo's Square Thumbnail and name with its print rating at the chosen size, opening it on the
 * Print Quality page.
 */
export function PrintPhotoTile({
  photo,
  chosen = false,
}: {
  photo: CombinedPhoto;
  chosen?: boolean;
}) {
  const name = printPhotoName(photo);
  return (
    <Link
      to="/printing"
      search={{ photo: photoKey(photo) }}
      aria-current={chosen ? "true" : undefined}
      className={cn(
        "hover:bg-muted/60 focus-visible:ring-ring/50 flex flex-col gap-1 rounded-md p-1 outline-none focus-visible:ring-[3px]",
        chosen && "bg-muted ring-primary ring-2",
      )}
    >
      <TileSquare photo={photo} />
      <span className="truncate text-xs" title={name}>
        {name}
      </span>
      <TileRating photo={photo} />
    </Link>
  );
}

/** The photo's Square Thumbnail, or an icon when it has none. */
function TileSquare({ photo }: { photo: CombinedPhoto }) {
  const image = photoImage(photo, "thumbnail") ?? photoImage(photo, "xsmall");
  return (
    <span className="bg-muted flex aspect-square w-full items-center justify-center overflow-hidden rounded-md border">
      {image ? (
        <img
          src={offlineImageUrl(image)}
          alt=""
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        <ImageOffIcon className="text-muted-foreground size-5" aria-hidden />
      )}
    </span>
  );
}

function TileRating({ photo }: { photo: CombinedPhoto }) {
  const { check } = usePrintCheck(photo);
  if (!check) return <span className="text-muted-foreground text-xs">Size unknown</span>;
  return <PrintRatingBadge check={check} className="self-start" />;
}
