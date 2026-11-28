import { useNavigate } from "@tanstack/react-router";
import { ChevronsUpDown, LocateFixed, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PlacesPanel } from "@/components/place-columns";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { photos } from "@/lib/all-photos";
import { DEFAULT_NEAR_LABEL, nearLabel, pointText } from "@/lib/distance-sort";
import { locationOptions } from "@/lib/filter-options";

/**
 * Distance's **From** button, shown beside **Sort** while the Grid is sorted by Distance: it opens
 * the same columns of countries, regions, cities and places as the Places filter, and picking one
 * measures from it (`?near=city:Stamford`). Beside it, **Use my location** measures from where the
 * browser says the viewer is (`?near=41.0534,-73.5387`), and **×** goes back to Stamford, CT.
 */
export function DistanceFromControl({ near }: { near?: string }) {
  const navigate = useNavigate({ from: "/grid" });
  const [open, setOpen] = useState(false);
  const options = useMemo(() => locationOptions(photos, photos), []);
  const go = (next: string | undefined) =>
    void navigate({ search: (prev) => ({ ...prev, near: next, photo: undefined }), replace: true });

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            title="Where Distance measures from"
            className="relative bg-background font-normal has-[>svg]:pr-8 dark:bg-background"
          >
            <MapPin aria-hidden className="text-muted-foreground" />
            <span className="text-muted-foreground">From</span>
            {nearLabel(near, options)}
            <ChevronsUpDown aria-hidden className="absolute right-2.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        {open && (
          <PlacesPanel
            options={options}
            onChoose={(value) => {
              setOpen(false);
              go(value);
            }}
          />
        )}
      </Popover>
      <MyLocationButton onFound={go} />
      {near && (
        <Button
          variant="ghost"
          size="icon"
          title={`Measure from ${DEFAULT_NEAR_LABEL} again`}
          aria-label={`Measure from ${DEFAULT_NEAR_LABEL} again`}
          onClick={() => go(undefined)}
          className="size-8"
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  );
}

/**
 * **Use my location**: asks the browser where the viewer is and gives it as the URL's spot. The
 * browser asks the viewer first; when it can't say, the button's tooltip says why.
 */
function MyLocationButton({ onFound }: { onFound: (near: string) => void }) {
  const [state, setState] = useState<LocateState>("idle");
  const { title, className } = LOCATE_LOOKS[state];
  const find = () => {
    setState("finding");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setState("idle");
        onFound(pointText(coords));
      },
      () => setState("failed"),
      { maximumAge: 600_000, timeout: 15_000 },
    );
  };
  return (
    <Button
      variant="outline"
      size="icon"
      title={title}
      aria-label={title}
      disabled={!canLocate() || state === "finding"}
      onClick={find}
      className={className}
    >
      <LocateFixed aria-hidden />
    </Button>
  );
}

/** Whether **Use my location** is looking, idle, or couldn't find the viewer last time. */
type LocateState = "idle" | "finding" | "failed";

/** The button's tooltip and look in each state. */
const LOCATE_LOOKS: Record<LocateState, { title: string; className: string }> = {
  idle: { title: "Use my location", className: "size-8" },
  finding: { title: "Finding your location…", className: "size-8 animate-pulse" },
  failed: {
    title: "Your location isn't available. Check the browser's location permission.",
    className: "size-8 text-destructive",
  },
};

/** Whether the browser can say where the viewer is. */
function canLocate(): boolean {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}
