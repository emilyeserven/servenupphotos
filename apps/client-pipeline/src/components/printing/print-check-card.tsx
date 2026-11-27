import { DownloadOriginalButton } from "@/components/printing/download-original-button";
import { PrintRatingBadge, usePrintCheck } from "@/components/printing/print-rating";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type CombinedPhoto, photoImage } from "@/lib/group-photos";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import { PRINT_DPI } from "@/lib/photo-book-dpi";
import {
  type Dimensions,
  GOOD_PPI,
  inUnit,
  largestPrint,
  type PrintCheck,
  type PrintChoice,
  RATING_TEXT,
  sizeText,
} from "@/lib/print-quality";
import { printPhotoName } from "@/lib/print-queue";
import { cn } from "@/lib/utils";
import { EmptyNote } from "@portfolio/components/empty-note";

/**
 * How clear the photo will be printed at the chosen size: its pixels per inch with a rating, a
 * preview of the paper showing what's cropped or left blank, and the largest sizes it prints well.
 */
export function PrintCheckCard({ photo }: { photo: CombinedPhoto }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{printPhotoName(photo)}</CardTitle>
      </CardHeader>
      <CardContent>
        <CheckBody photo={photo} />
      </CardContent>
    </Card>
  );
}

function CheckBody({ photo }: { photo: CombinedPhoto }) {
  const { choice, pixels, check } = usePrintCheck(photo);
  if (!pixels) {
    return (
      <EmptyNote>
        This photo's JSON has no width and height, so its print size can't be checked. Update Data's
        Missing fields can fill them in.
      </EmptyNote>
    );
  }
  if (!check) return <EmptyNote>Enter a width and height to check this photo.</EmptyNote>;
  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PaperPreview photo={photo} check={check} fit={choice.fit} />
      <div className="flex flex-col gap-4">
        <CheckDetails pixels={pixels} check={check} choice={choice} />
        <DownloadOriginalButton photo={photo} />
      </div>
    </div>
  );
}

/** The paper drawn to scale with the photo on it, cropped to fill it or fitted inside it. */
function PaperPreview({
  photo,
  check,
  fit,
}: {
  photo: CombinedPhoto;
  check: PrintCheck;
  fit: PrintChoice["fit"];
}) {
  const image = photoImage(photo, "medium") ?? photoImage(photo, "small");
  return (
    <div className="flex items-center justify-center">
      <div
        className="max-h-80 w-full overflow-hidden border bg-white shadow-sm"
        style={{ aspectRatio: `${check.paper.width} / ${check.paper.height}` }}
      >
        {image && (
          <img
            src={offlineImageUrl(image)}
            alt=""
            className={cn("size-full", fit === "fill" ? "object-cover" : "object-contain")}
          />
        )}
      </div>
    </div>
  );
}

function CheckDetails({
  pixels,
  check,
  choice,
}: {
  pixels: Dimensions;
  check: PrintCheck;
  choice: PrintChoice;
}) {
  const { unit } = choice.size;
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <PrintRatingBadge check={check} className="self-start text-sm" />
        <p className="text-muted-foreground">{RATING_TEXT[check.rating].note}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Original</dt>
        <dd>
          {pixels.width} × {pixels.height} px
        </dd>
        <dt className="text-muted-foreground">Paper</dt>
        <dd>{sizeText(inUnit(check.paper, unit), unit)}</dd>
        <UnusedRow check={check} />
        <dt className="text-muted-foreground">Excellent up to</dt>
        <dd>{sizeText(largestPrint(pixels, PRINT_DPI, unit), unit)}</dd>
        <dt className="text-muted-foreground">Good up to</dt>
        <dd>{sizeText(largestPrint(pixels, GOOD_PPI, unit), unit)}</dd>
      </dl>
    </div>
  );
}

/** How much of the photo is cropped away, or of the paper left blank, when any is. */
function UnusedRow({ check }: { check: PrintCheck }) {
  const percent = (share: number) => `${Math.round(share * 100)}%`;
  if (check.cropped >= 0.005) {
    return (
      <>
        <dt className="text-muted-foreground">Cropped</dt>
        <dd>{percent(check.cropped)} of the photo, to fill the paper</dd>
      </>
    );
  }
  if (check.blank >= 0.005) {
    return (
      <>
        <dt className="text-muted-foreground">Borders</dt>
        <dd>{percent(check.blank)} of the paper left blank</dd>
      </>
    );
  }
  return null;
}
