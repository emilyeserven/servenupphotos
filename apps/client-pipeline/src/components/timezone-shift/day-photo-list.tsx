import { ArrowDownToLineIcon, ImageIcon } from "lucide-react";
import { SideToggle } from "@/components/timezone-shift/side-toggle";
import { Button } from "@/components/ui/button";
import { type ShiftSide, readableTime } from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";

interface DayPhotoListProps {
  photos: DayPhoto[];
  /** Each photo's side of the change, by path; a photo not listed is before it. */
  sides: Record<string, ShiftSide>;
  onChange: (sides: Record<string, ShiftSide>) => void;
  /** The photo open on the Photo page, marked in the list. */
  currentPath: string;
}

/** The sides with the photo at index and every later one after the change, the earlier ones before; ones left out stay so. */
function fromHereAfter(photos: DayPhoto[], index: number, sides: Record<string, ShiftSide>) {
  const next = { ...sides };
  photos.forEach((photo, i) => {
    const path = photo.photo.file.path;
    if (next[path] !== "skip") next[path] = i < index ? "before" : "after";
  });
  return next;
}

/**
 * The day's photos in the order the camera took them, each marked as taken before or after the
 * timezone change, or left out. "After from here" marks a photo and every later one as after.
 */
export function DayPhotoList({ photos, sides, onChange, currentPath }: DayPhotoListProps) {
  return (
    <ol className="flex flex-col divide-y rounded-md border">
      {photos.map((day, index) => {
        const path = day.photo.file.path;
        return (
          <li key={path} className="flex flex-wrap items-center gap-3 p-2">
            <Thumb url={day.imageUrl} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">
                {day.name}
                {path === currentPath && (
                  <span className="text-muted-foreground"> (this photo)</span>
                )}
              </span>
              <span className="text-muted-foreground text-xs">
                Camera clock {readableTime(day.clockTime)}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Mark this photo and every later one as taken after the change"
              onClick={() => onChange(fromHereAfter(photos, index, sides))}
            >
              <ArrowDownToLineIcon />
              After from here
            </Button>
            <SideToggle
              value={sides[path] ?? "before"}
              onChange={(side) => onChange({ ...sides, [path]: side })}
              label={day.name}
            />
          </li>
        );
      })}
    </ol>
  );
}

function Thumb({ url }: { url?: string }) {
  if (!url) {
    return (
      <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded">
        <ImageIcon className="size-4" />
      </div>
    );
  }
  return <img src={url} alt="" loading="lazy" className="size-10 shrink-0 rounded object-cover" />;
}
