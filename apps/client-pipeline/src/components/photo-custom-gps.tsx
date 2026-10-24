import { FieldSection } from "@/components/field-section";
import { FieldLabel } from "@/components/field-label";
import { Input } from "@/components/ui/input";
import { parseGps } from "@/lib/place-gps";

/** How to fill in the custom GPS position, shown beside its title. */
const HELP =
  "Optional. Latitude, longitude in degrees, such as 40.7795, -73.9634; right-click a spot in Google Maps to copy one. The portfolio's map uses it instead of the GPS position in the photo's EXIF, which is kept as it is, and instead of its places'. Saved as customGpsPosition; leave it empty to use the EXIF one.";

interface PhotoCustomGpsProps {
  value: string;
  /** The GPS position in the photo's EXIF, or null when it has none. */
  exifGps: string | null;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** What the map uses, for the collapsed summary: the custom position, the EXIF one, or none. */
function gpsSummary(value: string, exifGps: string | null): string {
  if (value.trim()) return `${value.trim()} (custom)`;
  return exifGps ? `${exifGps} (from EXIF)` : "None in the EXIF";
}

/**
 * The photo's own GPS position, written as "latitude, longitude", which the portfolio uses instead of
 * its EXIF one or its places'. Collapsed to what the map uses, and open from the start when one is
 * written or the EXIF has none.
 */
export function PhotoCustomGps({ value, exifGps, disabled, onChange }: PhotoCustomGpsProps) {
  const invalid = parseGps(value) === null;
  return (
    <FieldSection
      title="GPS position"
      summary={gpsSummary(value, exifGps)}
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
        onChange={(event) => onChange(event.target.value)}
      />
      {invalid && (
        <p className="text-destructive text-sm">
          Write it as latitude, longitude in degrees, such as 40.7795, -73.9634.
        </p>
      )}
    </FieldSection>
  );
}
