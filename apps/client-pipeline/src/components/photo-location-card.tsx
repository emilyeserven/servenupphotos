import type { LocationPrompt } from "@/components/edit-in-flight/location-prompt";
import { CardTitleWithHint, LabeledHint } from "@/components/field-hint";
import { FieldSection } from "@/components/field-section";
import type { ExifPlace, PhotoDetails } from "@/components/photo-details";
import { PhotoCustomGps } from "@/components/photo-custom-gps";
import { PhotoLocationMap } from "@/components/photo-location-map";
import { PlaceFields } from "@/components/place-fields";
import { RegionOverrideField } from "@/components/region-override-field";
import { Card, CardContent } from "@/components/ui/card";

interface PhotoLocationCardProps {
  value: PhotoDetails;
  onChange: (value: PhotoDetails) => void;
  /** The city, state, country and GPS position from the photo's EXIF, shown until custom ones are written. */
  exifPlace: ExifPlace;
  /** What happens to the location when it's saved, shown on hover beside the card's title. */
  description: string;
  /** Saving is underway or done, so changing it now would not change the file. */
  disabled: boolean;
  /** The Place field's location prompt, when the photo has one. */
  locationPrompt?: LocationPrompt;
}

/**
 * Where the photo was taken: a map with its pin, which can be dragged (or the map clicked) to set a
 * custom GPS position, its places, and its custom city, state and country. Saved as the JSON's
 * "customGpsPosition", "noGps", "places" (with the first place's name as "placeName"), "customCity",
 * "customState" and "customCountry".
 */
export function PhotoLocationCard({
  value,
  onChange,
  exifPlace,
  description,
  disabled,
  locationPrompt,
}: PhotoLocationCardProps) {
  const field = (name: "customCity" | "customState" | "customCountry") => ({
    value: value[name],
    disabled,
    onChange: (next: string) => onChange({ ...value, [name]: next }),
  });
  const setGps = (customGpsPosition: string) => onChange({ ...value, customGpsPosition });
  return (
    <Card>
      <CardTitleWithHint title="Location" description={description} />
      <CardContent className="flex flex-col gap-3">
        <PhotoLocationMap
          value={value.customGpsPosition}
          exifGps={exifPlace.gpsPosition}
          disabled={disabled}
          onChange={setGps}
        />
        <PhotoCustomGps
          value={value.customGpsPosition}
          exifGps={exifPlace.gpsPosition}
          noGps={value.noGps}
          disabled={disabled}
          onChange={setGps}
          onNoGps={(noGps) => onChange({ ...value, noGps })}
        />
        <PlaceFields
          value={value}
          disabled={disabled}
          exifCountry={exifPlace.country}
          exifGps={exifPlace.gpsPosition}
          exifCity={exifPlace.city}
          prompt={locationPrompt}
          onChange={(place) => onChange({ ...value, ...place })}
        />
        <CityAndCountry
          exifPlace={exifPlace}
          value={value}
          field={field}
          onCity={(city, country) => onChange(withCity(value, exifPlace, city, country))}
        />
      </CardContent>
    </Card>
  );
}

interface FieldState {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

interface CityAndCountryProps {
  exifPlace: ExifPlace;
  value: PhotoDetails;
  field: (name: "customCity" | "customState" | "customCountry") => FieldState;
  /** Sets the custom city, with the city's country when one is known. */
  onCity: (city: string, country: string | undefined) => void;
}

/**
 * The details with the custom city set, and the custom country filled from the city's when it's
 * empty and the EXIF country isn't already that.
 */
function withCity(
  value: PhotoDetails,
  exifPlace: ExifPlace,
  city: string,
  country: string | undefined,
): PhotoDetails {
  const fill = !value.customCountry.trim() && country !== exifPlace.country;
  return {
    ...value,
    customCity: city,
    customCountry: fill ? (country ?? "") : value.customCountry,
  };
}

/**
 * The custom city and country, collapsed to what the portfolio will show, and open from the start
 * when either is written.
 */
function CityAndCountry({ exifPlace, value, field, onCity }: CityAndCountryProps) {
  const { summary, custom } = placeSummary(value, exifPlace);
  return (
    <FieldSection
      title="City, state and country"
      summary={summary}
      defaultOpen={custom}
      className="grid gap-4 sm:grid-cols-2"
    >
      <LabeledHint
        id="photo-custom-city"
        label="City"
        hint="Shown instead of the city from the photo's EXIF, which is kept as it is. Choose one places are in or other photos show, or type one. Saved as customCity; leave it empty to use the EXIF one."
      >
        <RegionOverrideField
          id="photo-custom-city"
          kind="city"
          placeholder={exifPlace.city ?? "Not in the EXIF"}
          {...field("customCity")}
          onChange={onCity}
        />
      </LabeledHint>
      <LabeledHint
        id="photo-custom-state"
        label="State"
        hint="The state, province, prefecture or other region between the city and the country. Shown instead of the EXIF's, which is kept as it is. Saved as customState; leave it empty to use the EXIF one."
      >
        <RegionOverrideField
          id="photo-custom-state"
          kind="state"
          placeholder={exifPlace.state ?? "Not in the EXIF"}
          {...field("customState")}
        />
      </LabeledHint>
      <LabeledHint
        id="photo-custom-country"
        label="Country"
        hint="Shown instead of the country from the photo's EXIF, which is kept as it is. Choose one places are in or other photos show, or type one. Saved as customCountry; leave it empty to use the EXIF one."
      >
        <RegionOverrideField
          id="photo-custom-country"
          kind="country"
          placeholder={exifPlace.country ?? "Not in the EXIF"}
          {...field("customCountry")}
        />
      </LabeledHint>
    </FieldSection>
  );
}

/** The value written here, or else the one from the EXIF. */
function shown(written: string, exif: string | null): string | null {
  return written.trim() || exif;
}

/** The city and country the portfolio will show, saying whether either is custom. */
function placeSummary(value: PhotoDetails, exifPlace: ExifPlace) {
  const custom = [value.customCity, value.customState, value.customCountry].some((written) =>
    written.trim(),
  );
  const place = [
    shown(value.customCity, exifPlace.city),
    shown(value.customState, exifPlace.state),
    shown(value.customCountry, exifPlace.country),
  ]
    .filter(Boolean)
    .join(", ");
  return { custom, summary: `${place || "None"} (${custom ? "custom" : "from EXIF"})` };
}
