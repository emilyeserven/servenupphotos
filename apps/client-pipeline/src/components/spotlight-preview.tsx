import { CalendarClock, Grid3x3, MapPin } from "lucide-react";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { type Focus, type Size, objectPosition } from "@/lib/spotlight-focus";
import { cn } from "@/lib/utils";
import { FallbackImage } from "@/components/fallback-image";
import { offlineSmallUrl } from "@/lib/offline-thumbnails";

/** What a spotlight preview shows: one photo, as the portfolio's homepage would. */
export interface PreviewPhoto {
  /** The photo's image URL. */
  src: string;
  /** The photo's title, shown at the bottom left as on the homepage. */
  title: string;
  /** The point kept in view where the photo is cropped, or null for its middle. */
  focus: Focus | null;
  /** Where on the screen the focus point goes, or null for the screen's middle. */
  placement: Focus | null;
  /** Whether the photo has a position, so the homepage shows a map button before its title. */
  onMap: boolean;
}

/** A screen the preview draws the homepage on, at its real size in CSS pixels. */
interface Screen {
  label: string;
  width: number;
  height: number;
  /** Whether it's a phone, which gets the homepage's smaller title and tiles. */
  phone: boolean;
}

const PHONE: Screen = { label: "Phone", width: 390, height: 844, phone: true };
const COMPUTER: Screen = { label: "Computer", width: 1440, height: 900, phone: false };

/** The frosted glass the homepage's title, tiles and caption sit on, as the portfolio has it. */
const FROSTED =
  "border border-white/30 bg-white/20 shadow-xl backdrop-blur-xl backdrop-saturate-150";

/** The views the homepage links to, with their icons. */
const VIEWS = [
  { label: "Timeline", icon: CalendarClock },
  { label: "Map", icon: MapPin },
  { label: "Grid", icon: Grid3x3 },
];

/**
 * The photo behind the portfolio's homepage on a phone held upright and on a computer: cropped to
 * fill the screen around its focus point with no tint, as the homepage has, with the site's name, the
 * view tiles and the photo's caption on frosted glass. Each screen is drawn at its real size and
 * scaled down, so the crop and the glass match the live page.
 */
export function SpotlightPreview({ photo }: { photo: PreviewPhoto }) {
  return (
    <div className="flex items-end gap-3">
      <ScreenFigure screen={PHONE} photo={photo} className="w-[22%] shrink-0" />
      <ScreenFigure screen={COMPUTER} photo={photo} className="min-w-0 flex-1" />
    </div>
  );
}

interface ScreenFigureProps {
  screen: Screen;
  photo: PreviewPhoto;
  className: string;
}

/** One screen of the preview, as wide as its place, with its name under it. */
function ScreenFigure({ screen, photo, className }: ScreenFigureProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const scale = width / screen.width;
  return (
    <figure className={cn("flex flex-col gap-1", className)}>
      <div
        ref={ref}
        className="ring-border relative overflow-hidden rounded-md bg-black ring-1"
        style={{ aspectRatio: `${screen.width} / ${screen.height}` }}
      >
        {width > 0 && (
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{ width: screen.width, height: screen.height, transform: `scale(${scale})` }}
          >
            <Homepage screen={screen} photo={photo} />
          </div>
        )}
      </div>
      <figcaption className="text-muted-foreground text-xs">{screen.label}</figcaption>
    </figure>
  );
}

/** The element's width in CSS pixels, kept up to date as it changes. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/** The homepage at the screen's size, with the photo behind it. */
function Homepage({ screen, photo }: { screen: Screen; photo: PreviewPhoto }) {
  const [image, setImage] = useState<Size>({ width: 1, height: 1 });
  const style: CSSProperties = {
    objectPosition: objectPosition(photo.focus, photo.placement, image, screen),
  };
  return (
    <div
      aria-hidden
      className="relative flex size-full flex-col items-center justify-center px-4 py-20 text-white"
    >
      <FallbackImage
        src={photo.src}
        fallback={offlineSmallUrl(photo.src)}
        alt=""
        style={style}
        onLoad={(event) =>
          setImage({
            width: event.currentTarget.naturalWidth,
            height: event.currentTarget.naturalHeight,
          })
        }
        className="absolute inset-0 size-full object-cover"
      />
      <Front phone={screen.phone} />
      <Caption photo={photo} />
    </div>
  );
}

/** The site's name and a tile for each view, sized as the homepage sizes them on the screen. */
function Front({ phone }: { phone: boolean }) {
  return (
    <div className="relative w-full max-w-5xl text-center">
      <p
        className={cn(
          FROSTED,
          "inline-block rounded-xl font-semibold tracking-tight text-balance",
          phone ? "px-5 py-3 text-4xl" : "px-8 py-4 text-6xl",
        )}
      >
        Serven Up Photos
      </p>
      <ul className={cn("mt-8 flex flex-wrap justify-center", phone ? "gap-2" : "gap-3")}>
        {VIEWS.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className={cn(
              FROSTED,
              "flex flex-col items-center gap-1.5 rounded-lg px-2 py-3",
              phone ? "w-20" : "w-28",
            )}
          >
            <Icon className="size-6" />
            <span className="text-sm font-medium">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The photo's title at the bottom left, after a map button when it has a position. */
function Caption({ photo }: { photo: PreviewPhoto }) {
  return (
    <div className="absolute bottom-4 left-4 flex max-w-[calc(100%-2rem)] items-center gap-2">
      {photo.onMap && (
        <span className={cn(FROSTED, "grid size-8 shrink-0 place-items-center rounded-md")}>
          <MapPin className="size-4" />
        </span>
      )}
      <p className={cn(FROSTED, "truncate rounded-md px-2.5 py-1.5 text-xs")}>{photo.title}</p>
    </div>
  );
}
