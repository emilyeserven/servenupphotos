import { ArrowDownToLineIcon, CameraIcon, ImageIcon } from "lucide-react";
import { useMemo } from "react";
import { CameraClockPicker } from "@/components/timezone-shift/camera-clock-picker";
import { SideToggle } from "@/components/timezone-shift/side-toggle";
import { zoneOptions } from "@/components/timezone-shift/zone-pickers";
import { Button } from "@/components/ui/button";
import type { ComboboxOption } from "@/components/ui/combobox";
import { type CameraClock, DEFAULT_CLOCK, byCamera } from "@/lib/camera-clock";
import { type ShiftSide, readableTime } from "@/lib/timezone-shift";
import type { DayPhoto } from "@/lib/timezone-shift-plan";

interface DayPhotoListProps {
  photos: DayPhoto[];
  /** Each photo's side of the change, by path; a photo not listed is before it. */
  sides: Record<string, ShiftSide>;
  onSidesChange: (sides: Record<string, ShiftSide>) => void;
  /** What each camera's clock was set to, by camera name; one not listed kept the start timezone. */
  clocks: Record<string, CameraClock>;
  onClocksChange: (clocks: Record<string, CameraClock>) => void;
  /** The photo open on the Photo page, marked in the list. */
  currentPath: string;
  day: string;
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
 * The day's photos by camera, since each camera kept its own clock: what the clock was set to, then
 * its photos in the order it took them, each marked as taken before or after the timezone change.
 */
export function DayPhotoList(props: DayPhotoListProps) {
  const options = useMemo(() => zoneOptions(props.day), [props.day]);
  return (
    <div className="flex flex-col gap-4">
      {byCamera(props.photos).map(([camera, photos]) => (
        <CameraGroup key={camera} {...props} camera={camera} photos={photos} options={options} />
      ))}
    </div>
  );
}

type CameraGroupProps = DayPhotoListProps & { camera: string; options: ComboboxOption[] };

function CameraGroup(props: CameraGroupProps) {
  const { camera, photos, clocks, onClocksChange, options, day } = props;
  const clock = clocks[camera] ?? DEFAULT_CLOCK;
  return (
    <section className="flex flex-col gap-2 rounded-md border p-3">
      <h3 className="flex items-center gap-1.5 font-medium">
        <CameraIcon className="size-3.5" />
        {camera}
        <span className="text-muted-foreground font-normal">
          · {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </span>
      </h3>
      <CameraClockPicker
        camera={camera}
        photos={photos}
        value={clock}
        onChange={(next) => onClocksChange({ ...clocks, [camera]: next })}
        options={options}
        day={day}
      />
      <ol className="flex flex-col divide-y rounded-md border">
        {photos.map((photo, index) => (
          <PhotoRow
            key={photo.photo.file.path}
            {...props}
            photo={photo}
            index={index}
            kept={clock.kind === "right"}
          />
        ))}
      </ol>
    </section>
  );
}

type PhotoRowProps = CameraGroupProps & {
  photo: DayPhoto;
  index: number;
  /** The camera's clock was right, so the photo keeps its time and has no side to pick. */
  kept: boolean;
};

function PhotoRow({
  photo,
  index,
  kept,
  photos,
  sides,
  onSidesChange,
  currentPath,
}: PhotoRowProps) {
  const path = photo.photo.file.path;
  return (
    <li className="flex flex-wrap items-center gap-3 p-2">
      <Thumb url={photo.imageUrl} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">
          {photo.name}
          {path === currentPath && <span className="text-muted-foreground"> (this photo)</span>}
        </span>
        <span className="text-muted-foreground text-xs">Clock {readableTime(photo.clockTime)}</span>
      </div>
      {kept ? (
        <span className="text-muted-foreground text-xs">Keeps its time</span>
      ) : (
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title="Mark this photo and every later one from this camera as taken after the change"
            onClick={() => onSidesChange(fromHereAfter(photos, index, sides))}
          >
            <ArrowDownToLineIcon />
            After from here
          </Button>
          <SideToggle
            value={sides[path] ?? "before"}
            onChange={(side) => onSidesChange({ ...sides, [path]: side })}
            label={photo.name}
          />
        </>
      )}
    </li>
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
