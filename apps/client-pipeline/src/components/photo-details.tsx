import { ChevronRightIcon, InfoIcon } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkBreaks from "remark-breaks";
import { type PhotoPlace, savedPlaces } from "@/api/places";
import { RegionOverrideField } from "@/components/region-override-field";
import { PhotoCustomGps } from "@/components/photo-custom-gps";
import { PlaceFields } from "@/components/place-fields";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUntitledDrafts } from "@/lib/drafts";

/** Spacing and list, link, code and quote styles for rendered Markdown, which Tailwind's reset strips. */
const MARKDOWN_CLASSES = [
  "text-sm break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-medium",
  "[&_a]:underline [&_a]:underline-offset-4 [&_hr]:my-3",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
].join(" ");

/** The photo's title, place name, custom city and country, and Markdown comment as typed; empty when there's none. */
interface PhotoText {
  title: string;
  placeName: string;
  customCity: string;
  customState: string;
  customCountry: string;
  /** A GPS position written as "latitude, longitude", which the map uses instead of the EXIF one. */
  customGpsPosition: string;
  comment: string;
}

/** The photo's text details, and where it was taken as places from PLACES.json. */
export interface PhotoDetails extends PhotoText {
  /** The photo's places, each with how the photo relates to it; a row being filled in has no ID yet. */
  places: PhotoPlace[];
}

/** No title, place name, custom city or country, or comment, which a new photo starts with. */
const NO_TEXT: PhotoText = {
  title: "",
  placeName: "",
  customCity: "",
  customState: "",
  customCountry: "",
  customGpsPosition: "",
  comment: "",
};

/** No details or places, which a new photo starts with. */
export const NO_DETAILS: PhotoDetails = { ...NO_TEXT, places: [] };

/** The text fields of PhotoDetails, as the JSON names them. */
export const TEXT_FIELDS = Object.keys(NO_TEXT) as (keyof PhotoText)[];

/** The city and country read from the photo's EXIF, which the custom ones show instead of, and its GPS position. */
export interface ExifPlace {
  city: string | null;
  /** The state, province or prefecture from the EXIF, between the city and the country. */
  state: string | null;
  country: string | null;
  /** The GPS position from the EXIF, or null when it has none. */
  gpsPosition: string | null;
}

/** A file name without its extension, which the portfolio uses as the title of a photo without one. */
export function fileStem(file: string): string {
  return file.replace(/\.[^.]*$/, "");
}

/** The details saved in a photo's JSON, to start editing from. */
export function savedDetails(data: Record<string, unknown>): PhotoDetails {
  const texts = Object.fromEntries(TEXT_FIELDS.map((field) => [field, text(data[field])]));
  return { ...(texts as unknown as PhotoText), places: savedPlaces(data.places) };
}

/** The EXIF city, country and GPS position saved in a photo's JSON. */
export function savedExifPlace(data: Record<string, unknown>): ExifPlace {
  const field = (name: string) => text(data[name]) || null;
  return {
    city: field("city"),
    state: field("state"),
    country: field("country"),
    gpsPosition: field("gpsPosition"),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * data with the title and comment, or null for ones left empty, as its first fields, and the place
 * name, places and custom city and country where data has them (before the country, as new photo
 * files list them), or else last.
 */
export function withDetails<T extends object>(data: T, details: PhotoDetails) {
  const {
    title: _title,
    comment: _comment,
    ...rest
  } = data as T & {
    title?: unknown;
    comment?: unknown;
  };
  const saved = (field: keyof PhotoText) => details[field].trim() || null;
  return {
    title: saved("title"),
    comment: saved("comment"),
    ...rest,
    // Setting a key the spread already added keeps it where it was.
    placeName: saved("placeName"),
    places: chosenPlaces(details.places),
    customCity: saved("customCity"),
    customState: saved("customState"),
    customCountry: saved("customCountry"),
    customGpsPosition: saved("customGpsPosition"),
  };
}

/** The places with one chosen, as they're saved. */
export function chosenPlaces(places: PhotoPlace[]): PhotoPlace[] {
  return places.filter((place) => place.id);
}

/** A link in the comment's preview, opened in a new tab so the page and its work stay put. */
function NewTabLink({ node: _node, ...props }: ComponentProps<"a"> & ExtraProps) {
  return <a {...props} target="_blank" rel="noreferrer" />;
}

interface PhotoDetailsCardProps {
  value: PhotoDetails;
  onChange: (value: PhotoDetails) => void;
  /** What the portfolio calls the photo without a title: its file name without the extension. */
  fallbackTitle: string;
  /** The city and country from the photo's EXIF, shown until custom ones are written. */
  exifPlace: ExifPlace;
  /** What happens to the details when they're saved, shown on hover beside the card's title. */
  description: string;
  /** Saving is underway or done, so changing them now would not change the file. */
  disabled: boolean;
}

/**
 * The photo's optional title on the portfolio and Markdown comment in one card, and its places,
 * custom city and country and where it goes on the map in another, saved as the JSON's "title", "places" (with the first place's name as "placeName"),
 * "customCity", "customCountry", "customGpsPosition" and "comment".
 */
export function PhotoDetailsCard({
  value,
  onChange,
  fallbackTitle,
  exifPlace,
  description,
  disabled,
}: PhotoDetailsCardProps) {
  const field = (name: "title" | "customCity" | "customState" | "customCountry") => ({
    value: value[name],
    disabled,
    onChange: (next: string) => onChange({ ...value, [name]: next }),
  });
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardTitleWithHint title="Title and comment" description={description} />
        <CardContent className="flex flex-col gap-6">
          <TextField
            id="photo-title"
            label="Title"
            placeholder={fallbackTitle}
            hint={<TitleHint fallbackTitle={fallbackTitle} />}
            {...field("title")}
          />
          <CommentField
            value={value.comment}
            disabled={disabled}
            onChange={(comment) => onChange({ ...value, comment })}
          />
        </CardContent>
      </Card>
      <Card>
        <CardTitleWithHint title="Location" description={description} />
        <CardContent className="flex flex-col gap-3">
          <PlaceFields
            value={value}
            disabled={disabled}
            exifCountry={exifPlace.country}
            exifGps={exifPlace.gpsPosition}
            exifCity={exifPlace.city}
            onChange={(place) => onChange({ ...value, ...place })}
          />
          <PhotoCustomGps
            value={value.customGpsPosition}
            exifGps={exifPlace.gpsPosition}
            disabled={disabled}
            onChange={(customGpsPosition) => onChange({ ...value, customGpsPosition })}
          />
          <CityAndCountry
            exifPlace={exifPlace}
            value={value}
            field={field}
            onCity={(city, country) => onChange(withCity(value, exifPlace, city, country))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * What the title is for, and what happens without one: the photo is a draft the portfolio doesn't
 * show, or, with untitled photos included in Settings, it goes by its file name.
 */
function TitleHint({ fallbackTitle }: { fallbackTitle: string }) {
  if (useUntitledDrafts()) {
    return (
      <>
        What the portfolio calls the photo. Without one, the photo is a <strong>draft</strong>: its
        JSON is saved, but Commit leaves it out of <code>ALLPHOTOS.json</code>, so the portfolio
        doesn&apos;t show it. Its JSON file is named after the title too.
      </>
    );
  }
  return (
    <>
      What the portfolio calls the photo. Without one, it uses the file name,{" "}
      <code>{fallbackTitle}</code>. Its JSON file is named after it too.
    </>
  );
}

/** A card's title, with what happens to its details when they're saved on hover beside it. */
function CardTitleWithHint({ title, description }: { title: string; description: string }) {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-1.5">
        {title}
        <Hint label={`About ${title.toLowerCase()}`}>{description}</Hint>
      </CardTitle>
    </CardHeader>
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
  const [open, setOpen] = useState(custom);
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-md border"
    >
      <summary className="hover:bg-muted/50 flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon className="size-4 shrink-0 transition-transform group-open:rotate-90" />
        <span className="font-medium">City, state and country</span>
        <span className="text-muted-foreground min-w-0 truncate">{summary}</span>
      </summary>
      <div className="grid gap-4 px-3 pt-1 pb-3 sm:grid-cols-2">
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
      </div>
    </details>
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

interface TextFieldProps extends FieldState {
  id: string;
  label: string;
  placeholder: string;
  /** What the field is for, shown on hover beside its label. */
  hint: ReactNode;
}

/** A one-line text field with its label, and its hint on hover beside the label. */
function TextField({ id, label, placeholder, hint, value, disabled, onChange }: TextFieldProps) {
  return (
    <LabeledHint id={id} label={label} hint={hint}>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
        onChange={(event) => onChange(event.target.value)}
      />
    </LabeledHint>
  );
}

interface LabeledHintProps {
  /** The id of the field inside, which the label points to. */
  id: string;
  label: string;
  hint: ReactNode;
  children: ReactNode;
}

/** A field with its label, and its hint on hover beside the label. */
function LabeledHint({ id, label, hint, children }: LabeledHintProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <Hint label={`About ${label}`} id={`${id}-hint`}>
          {hint}
        </Hint>
      </div>
      {children}
    </div>
  );
}

interface HintProps {
  /** What the info button is called for screen readers. */
  label: string;
  /** An id for the hint's text, which stays in the page for aria-describedby. */
  id?: string;
  children: ReactNode;
}

/** An info icon showing helper text on hover or focus, to keep it from cluttering the form. */
function Hint({ label, id, children }: HintProps) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-full outline-none focus-visible:ring-[3px]"
          >
            <InfoIcon className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs font-normal">{children}</TooltipContent>
      </Tooltip>
      {id && (
        <span id={id} className="sr-only">
          {children}
        </span>
      )}
    </>
  );
}

interface CommentFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** A Markdown note about the photo, with a tab to preview it rendered. */
function CommentField({ value, disabled, onChange }: CommentFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span id="photo-comment-label" className="text-sm font-medium">
          Comment
        </span>
        <Hint label="About Comment" id="photo-comment-hint">
          Written in Markdown.
        </Hint>
      </div>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            aria-labelledby="photo-comment-label"
            aria-describedby="photo-comment-hint"
            placeholder="What's the story behind this photo? **Markdown** works here."
            className="max-h-96 min-h-28"
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </TabsContent>
        <TabsContent value="preview">
          <div className="min-h-28 rounded-md border px-3 py-2">
            {value.trim() ? (
              <div className={MARKDOWN_CLASSES}>
                <Markdown components={{ a: NewTabLink }} remarkPlugins={[remarkBreaks]}>
                  {value}
                </Markdown>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
