import { CheckIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";
import type { SocialCalendar, SocialPhoto } from "@/api/publish";
import { PhotoFiles } from "@/components/photo-files";
import { Thumbnail, ZonePhotos } from "@/components/spotlight-zone-photos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  type SpotlightZone,
  type UnsavedOrder,
  type UnsavedZones,
  SPOTLIGHT_ORDER,
  SPOTLIGHT_ZONES,
  moveChanges,
  newestFirst,
  orderChange,
  spotlightZones,
  unsavedOrderFromEdits,
  unsavedZonesFromEdits,
  zoneChange,
  zonePhotos,
  zonesOf,
  zonesUnsaved,
} from "@/lib/site-spotlight";
import { photoName } from "@/lib/social-schedule";
import { cn } from "@/lib/utils";
import { useLocalEditsStore } from "@/stores/local-edits";

/** Picks the photos each spotlight zone of the portfolio shows, such as the homepage's. */
export function SiteSpotlight() {
  return <PhotoFiles>{(data) => <Zones files={data} />}</PhotoFiles>;
}

/** Puts a photo in a zone or takes it out. */
type Toggle = (photo: SocialPhoto, zone: string, on: boolean) => void;

/** The zones and order as changed here, and how to change them. */
interface Spotlight {
  unsaved: UnsavedZones;
  order: UnsavedOrder;
  toggle: Toggle;
  /** Saves list, a zone's photos in their order, with the photo at from moved to to. */
  move: (list: SocialPhoto[], from: number, to: number) => void;
}

/**
 * The zones and order changed here and not committed yet, kept with the app's other local edits
 * so the sync button counts them and **Commit** saves them. Taking a photo out of a zone also takes
 * its place in the order away.
 */
function useSpotlight(): Spotlight {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const unsaved = useMemo(() => unsavedZonesFromEdits(edits), [edits]);
  const order = useMemo(() => unsavedOrderFromEdits(edits), [edits]);
  const toggle: Toggle = (photo, zone, on) => {
    setField(SPOTLIGHT_ZONES, [zoneChange(unsaved, photo, zone, on)]);
    if (!on) setField(SPOTLIGHT_ORDER, [orderChange(photo, null)]);
  };
  const move: Spotlight["move"] = (list, from, to) =>
    setField(SPOTLIGHT_ORDER, moveChanges(list, from, to));
  return { unsaved, order, toggle, move };
}

function Zones({ files }: { files: SocialCalendar }) {
  const spotlight = useSpotlight();
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Photos to pick from are the {files.photos.length} photo files on <code>{files.branch}</code>
        , in flight ones included. Changes are kept in the app until you <strong>Commit</strong>{" "}
        from the sync button at the top right, which saves them to each photo&apos;s{" "}
        <code>spotlightZones</code> and, for the order, <code>websiteSpotlight</code>.
      </p>
      {files.unreadable.length > 0 && (
        <p className="text-destructive text-sm">
          Some photo files couldn&apos;t be read, so nothing can be committed:{" "}
          {files.unreadable.map((f) => f.path).join(", ")}
        </p>
      )}
      {spotlightZones.map((zone) => (
        <ZoneCard key={zone.id} zone={zone} photos={files.photos} spotlight={spotlight} />
      ))}
    </div>
  );
}

interface ZoneProps {
  zone: SpotlightZone;
  photos: SocialPhoto[];
  spotlight: Spotlight;
}

/**
 * One zone: its photos in their order, to drag into another order or take out, and a picker to
 * add more.
 */
function ZoneCard({ zone, photos, spotlight }: ZoneProps) {
  const [picking, setPicking] = useState(false);
  const { unsaved, order, toggle, move } = spotlight;
  const chosen = zonePhotos(photos, unsaved, order, zone.id);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{zone.label}</CardTitle>
        <CardDescription>{zone.description}</CardDescription>
        <CardAction>
          <Button variant="outline" onClick={() => setPicking(true)}>
            <PlusIcon />
            Add photos
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {chosen.length === 0 ? (
          <p className="text-muted-foreground text-sm">{zone.fallback}</p>
        ) : (
          <ZonePhotos
            photos={chosen}
            isUnsaved={(photo) => zonesUnsaved(unsaved, photo) || photo.path in order}
            onMove={(from, to) => move(chosen, from, to)}
            onRemove={(photo) => toggle(photo, zone.id, false)}
          />
        )}
      </CardContent>
      <ZonePicker
        open={picking}
        zone={zone}
        photos={photos}
        unsaved={unsaved}
        onToggle={toggle}
        onClose={() => setPicking(false)}
      />
    </Card>
  );
}

/** The photos matching search, by title or file name, newest first. */
function matching(photos: SocialPhoto[], search: string): SocialPhoto[] {
  const query = search.trim().toLowerCase();
  return photos
    .filter((photo) => `${photoName(photo)} ${photo.file}`.toLowerCase().includes(query))
    .toSorted(newestFirst);
}

interface ZonePickerProps {
  open: boolean;
  zone: SpotlightZone;
  photos: SocialPhoto[];
  unsaved: UnsavedZones;
  onToggle: Toggle;
  onClose: () => void;
}

/** Every photo, to click in or out of a zone. */
function ZonePicker({ open, zone, photos, unsaved, onToggle, onClose }: ZonePickerProps) {
  const [search, setSearch] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{zone.label} photos</DialogTitle>
          <DialogDescription>Click a photo to add it, and again to take it out.</DialogDescription>
        </DialogHeader>
        <Input
          type="search"
          placeholder="Search by title or file name"
          aria-label="Search photos"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="-mx-1 grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto px-1 sm:grid-cols-5">
          {matching(photos, search).map((photo) => (
            <PickerPhoto
              key={photo.path}
              photo={photo}
              chosen={zonesOf(unsaved, photo).includes(zone.id)}
              onToggle={(on) => onToggle(photo, zone.id, on)}
            />
          ))}
        </ul>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface PickerPhotoProps {
  photo: SocialPhoto;
  chosen: boolean;
  onToggle: (on: boolean) => void;
}

/** A photo in the picker, ringed and checked while it's in the zone. */
function PickerPhoto({ photo, chosen, onToggle }: PickerPhotoProps) {
  const name = photoName(photo);
  return (
    <li>
      <button
        type="button"
        aria-pressed={chosen}
        title={name}
        onClick={() => onToggle(!chosen)}
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring",
          chosen && "ring-primary ring-2",
        )}
      >
        <Thumbnail photo={photo} />
        {chosen && (
          <span className="bg-primary text-primary-foreground absolute top-1 right-1 rounded-full p-0.5">
            <CheckIcon className="size-3.5" />
          </span>
        )}
        <span className="sr-only">{name}</span>
      </button>
      <p className="mt-1 truncate text-xs">{name}</p>
    </li>
  );
}
