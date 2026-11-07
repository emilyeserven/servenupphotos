import { useId } from "react";
import { FieldSection } from "@/components/field-section";
import { FieldLabel } from "@/components/field-label";
import { Input } from "@/components/ui/input";
import { decimalGps, parseGps } from "@/lib/place-gps";

/** How to fill in the custom GPS position, shown beside its title. */
const HELP =
  "Optional. Latitude, longitude in degrees, such as 40.7795, -73.9634; right-click a spot in Google Maps to copy one. Degrees, minutes and seconds, such as 37°34′12″N 126°59′56″E, are turned into that as they're pasted. The portfolio's map uses it instead of the GPS position in the photo's EXIF, which is kept as it is, and instead of its places'. Saved as customGpsPosition; leave it empty to use the EXIF one.";

interface PhotoCustomGpsProps {
  value: string;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  /** Whether the photo is marked as going without a GPS position on purpose, such as a studio photo. */
  noGps: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  /** Marks the photo as going without a GPS position on purpose, or takes the mark off. */
  onNoGps: (noGps: boolean) => void;
}

/** What the map uses, for the collapsed summary: the custom position, the EXIF one, or none. */
function gpsSummary(value: string, exifGps: string | null, noGps: boolean): string {
  if (value.trim()) return `${value.trim()} (custom)`;
  if (exifGps) return `${exifGps} (from EXIF)`;
  return noGps ? "None, on purpose" : "None in the EXIF";
}

/**
 * The photo's own GPS position, written as "latitude, longitude", which the portfolio uses instead of
 * its EXIF one or its places', and a mark for a photo that won't have one, such as a studio photo.
 * Collapsed to what the map uses, and open from the start when one is written or the EXIF has none.
 */
export function PhotoCustomGps(props: PhotoCustomGpsProps) {
  const { value, exifGps, noGps, disabled, onChange } = props;
  const invalid = parseGps(value) === null;
  return (
    <FieldSection
      title="GPS position"
      summary={gpsSummary(value, exifGps, noGps)}
      defaultOpen={Boolean(value.trim() || !exifGps)}
      className="flex flex-col gap-2"
    >
      <FieldLabel htmlFor="photo-custom-gps" help={HELP}>
        Custom GPS position
      </FieldLabel>
      <Input
        id="photo-custom-gps"
        value={value}
        placeholder="Such as 40.7795, -73.9634"
        disabled={disabled}
        aria-invalid={invalid}
        onChange={(event) => onChange(decimalGps(event.target.value))}
      />
      {invalid && (
        <p className="text-destructive text-sm">
          Write it as latitude, longitude in degrees, such as 40.7795, -73.9634, or as 37°34′12″N
          126°59′56″E.
        </p>
      )}
      <NoGpsCheckbox checked={noGps} disabled={disabled} onChange={props.onNoGps} />
    </FieldSection>
  );
}

interface NoGpsCheckboxProps {
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/** The mark for a photo that won't have a GPS position, which keeps it off Needs Attention's GPS and place rows. */
function NoGpsCheckbox({ checked, disabled, onChange }: NoGpsCheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 pt-1 text-sm">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>
        This photo won&apos;t have a GPS position, such as a studio photo
        <span className="text-muted-foreground block">
          Needs attention leaves it out of the photos without GPS or a place. Saved as noGps.
        </span>
      </label>
    </div>
  );
}
