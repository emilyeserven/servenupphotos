import { Link } from "@tanstack/react-router";
import { DownloadIcon, ImageIcon } from "lucide-react";
import { FallbackImage } from "@/components/fallback-image";
import { Button } from "@/components/ui/button";
import { parseIsoDate } from "@/lib/calendar";
import type { PlannedPhoto } from "@/lib/instagram-planned";
import { offlineSmallUrl } from "@/lib/offline-thumbnails";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
});

const BADGE = "rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap";

/** The photo JSON's `images.<name>`, when it's text. */
function image(data: Record<string, unknown>, name: string): string | undefined {
  const images = data.images as Record<string, unknown> | undefined;
  const value = images?.[name];
  return typeof value === "string" && value ? value : undefined;
}

/**
 * Where the original JPEG downloads from: the pipeline's own route, which names the file after the
 * photo, since a browser won't download straight from R2's address. Undefined without an R2 key.
 */
function originalHref(data: Record<string, unknown>): string | undefined {
  const key = image(data, "key");
  if (!key) return undefined;
  const params = new URLSearchParams({ key });
  if (typeof data.file === "string") params.set("name", data.file);
  return `/api/photos/original?${params}`;
}

/** The photo large enough to compare with Instagram's preview, or its smallest version. */
function PreviewImage({ planned }: { planned: PlannedPhoto }) {
  const { data, image: small, name } = planned.file;
  const src = image(data, "medium") ?? small;
  if (!src) {
    return (
      <div className="bg-muted text-muted-foreground flex aspect-[4/3] items-center justify-center rounded-md">
        <ImageIcon className="size-6" />
      </div>
    );
  }
  return (
    <FallbackImage
      src={src}
      fallback={offlineSmallUrl(src)}
      alt={name}
      className="bg-muted max-h-[60vh] w-full rounded-md object-contain"
    />
  );
}

/** The planned day, with whether it's today or already gone by. */
function DayLine({ day, today }: { day: string; today: string }) {
  if (!day) return <span>No day set</span>;
  return (
    <>
      <span>{dayFormat.format(parseIsoDate(day))}</span>
      {day === today && (
        <span className={cn(BADGE, "bg-primary text-primary-foreground")}>Today</span>
      )}
      {day < today && <span className={cn(BADGE, "bg-amber-500 text-white")}>Overdue</span>}
    </>
  );
}

/** The button that downloads the photo's original JPEG from R2. */
function DownloadOriginal({ data }: { data: Record<string, unknown> }) {
  const href = originalHref(data);
  if (!href) {
    return <p className="text-muted-foreground text-xs">This photo has no original JPEG in R2.</p>;
  }
  return (
    <Button asChild variant="outline" size="lg" className="self-start">
      <a href={href} download>
        <DownloadIcon />
        Download original JPEG
      </a>
    </Button>
  );
}

/** The planned photo: its image, name, day, and a download of its original JPEG. */
export function PlannedPhotoView({ planned, today }: { planned: PlannedPhoto; today: string }) {
  const { file } = planned;
  return (
    <div className="flex flex-col gap-3">
      <PreviewImage planned={planned} />
      <div className="flex flex-col gap-1">
        <Link
          to="/exif"
          search={{ edit: file.path }}
          className="text-base font-medium underline-offset-4 hover:underline"
        >
          {file.name}
        </Link>
        <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm">
          <DayLine day={planned.day} today={today} />
        </p>
      </div>
      <DownloadOriginal data={file.data} />
    </div>
  );
}
