import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LocateFixedIcon } from "lucide-react";
import { useState } from "react";
import { optimisticEntry, type PhotoPlace, type Place, savePlaceMutation } from "@/api/places";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { exifGpsText, parseGps } from "@/lib/place-gps";

interface PlaceGpsAddersProps {
  /** The photo's places, in order. */
  rows: PhotoPlace[];
  places: Place[];
  /** The GPS position in the photo's EXIF, offered as the place's; null when it has none. */
  exifGps: string | null;
  disabled: boolean;
}

/** Whether the place has no GPS position of its own. */
function lacksGps(place: Place): boolean {
  return place.latitude === undefined || place.longitude === undefined;
}

/** A way to give each of the photo's places that has no GPS position one, without leaving the page. */
export function PlaceGpsAdders({ rows, places, exifGps, disabled }: PlaceGpsAddersProps) {
  const chosen = rows.flatMap((row) => places.filter((place) => place.id === row.id));
  return chosen
    .filter(lacksGps)
    .map((place) => (
      <PlaceGpsAdder key={place.id} place={place} exifGps={exifGps} disabled={disabled} />
    ));
}

interface PlaceGpsAdderProps {
  place: Place;
  exifGps: string | null;
  disabled: boolean;
}

/**
 * A button that opens a GPS position field for a place that has none, saved to the place like on
 * the Places page, so photos given it without their own GPS position go there on the map.
 */
function PlaceGpsAdder({ place, exifGps, disabled }: PlaceGpsAdderProps) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto justify-start p-0 text-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <LocateFixedIcon />
        Add a GPS position for {place.name}
      </Button>
    );
  }
  return <PlaceGpsForm place={place} exifGps={exifGps} onClose={() => setOpen(false)} />;
}

interface PlaceGpsFormProps {
  place: Place;
  exifGps: string | null;
  onClose: () => void;
}

/** The place's GPS position as latitude, longitude, with this photo's offered, and Save. */
function PlaceGpsForm({ place, exifGps, onClose }: PlaceGpsFormProps) {
  const queryClient = useQueryClient();
  const save = useMutation({ ...savePlaceMutation, ...optimisticEntry(queryClient, "places") });
  const [text, setText] = useState("");
  const id = `place-gps-${place.id}`;
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <label htmlFor={id} className="text-xs font-medium">
        GPS position for {place.name}
      </label>
      <Input
        id={id}
        value={text}
        placeholder="37.5796, 126.977"
        disabled={save.isPending}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="text-muted-foreground text-xs">
        Latitude, longitude in degrees; right-click a spot in Google Maps to copy one. Photos given
        this place without their own GPS position go here on the portfolio's map.
      </p>
      <FormProblem text={text} error={save.error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={!positionOf(text) || save.isPending}
          onClick={() => save.mutate({ ...place, ...positionOf(text) }, { onSuccess: onClose })}
        >
          {save.isPending && <Spinner />}
          Save
        </Button>
        <PhotoPositionButton exifGps={exifGps} onUse={setText} />
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/** The GPS position typed, or null when nothing is typed or it can't be read. */
function positionOf(text: string) {
  return text.trim() ? parseGps(text) : null;
}

/** Why the save failed, or that what's typed can't be read as a GPS position; "" for neither. */
function problemText(text: string, error: Error | null): string {
  if (error) return error.message;
  return parseGps(text) ? "" : "Write it as latitude, longitude.";
}

/** Why the save failed, or that what's typed can't be read as a GPS position. */
function FormProblem({ text, error }: { text: string; error: Error | null }) {
  const message = problemText(text, error);
  return message ? <p className="text-destructive text-xs">{message}</p> : null;
}

/** Fills in the photo's own EXIF GPS position, when it has one. */
function PhotoPositionButton({
  exifGps,
  onUse,
}: {
  exifGps: string | null;
  onUse: (text: string) => void;
}) {
  const fromPhoto = exifGpsText(exifGps);
  if (!fromPhoto) return null;
  return (
    <Button type="button" size="sm" variant="outline" onClick={() => onUse(fromPhoto)}>
      Use this photo's position
    </Button>
  );
}
