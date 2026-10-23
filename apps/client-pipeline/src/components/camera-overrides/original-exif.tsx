import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
  fieldLabel,
  OVERRIDE_FIELDS,
  type OverrideField,
  type OverrideRule,
  type OverrideValue,
} from "@/api/cameras";
import { bucketExifMutation } from "@/api/photos";
import { showValue } from "@/components/camera-overrides/rule-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { exifValue } from "@/lib/camera-overrides";
import type { CombinedPhoto } from "@/lib/group-photos";

/** EXIF tags about the camera, lens and settings, which the list shows unless asked for all. */
const CAMERA_TAG = /make|model|lens|focal|camera|aperture|fnumber|serial|mount|adapter/i;

interface OriginalExifProps {
  /** The camera's photos, one of which is read. */
  photos: CombinedPhoto[];
  /** Adds a rule writing a tag's value into a field. */
  onUse: (rule: OverrideRule) => void;
}

/** The R2 key of the photo's original, or "" when it has none. */
function photoKey(photo: CombinedPhoto): string {
  const key = photo.images?.key;
  return typeof key === "string" ? key : "";
}

/** How the photo shows in the list: its title or file, with its EXIF lens. */
function photoLabel(photo: CombinedPhoto): string {
  const name = (photo.title as string | null) || (photo.file as string | null) || photoKey(photo);
  return `${name} (${showValue(exifValue(photo, "lens"))})`;
}

/**
 * Reads every EXIF tag of one of the camera's originals in R2, so a value the photo data doesn't
 * keep, such as LensMake or LensSpecification, can be written into a field with a rule.
 */
export function OriginalExif({ photos, onUse }: OriginalExifProps) {
  const withKeys = photos.filter(photoKey);
  const [key, setKey] = useState(() => firstKey(withKeys));
  const read = useMutation(bucketExifMutation);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Original EXIF</CardTitle>
        <CardDescription>
          Reads every tag of a photo&apos;s original in R2. <strong>Use for</strong> adds a rule
          writing that tag&apos;s value into a field, for the photos with this photo&apos;s lens.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <PhotoPicker
          photos={withKeys}
          value={key}
          reading={read.isPending}
          onChange={(next) => {
            setKey(next);
            read.reset();
          }}
          onRead={() => read.mutate(key)}
        />
        <ExifResult
          error={read.error}
          tags={read.data?.exif}
          photo={withKeys.find((p) => photoKey(p) === key)}
          onUse={onUse}
        />
      </CardContent>
    </Card>
  );
}

/** The key of the first photo's original, or "" with none. */
function firstKey(photos: CombinedPhoto[]): string {
  return photoKey(photos[0] ?? {});
}

interface PhotoPickerProps {
  photos: CombinedPhoto[];
  /** The chosen photo's key. */
  value: string;
  reading: boolean;
  onChange: (key: string) => void;
  onRead: () => void;
}

function PhotoPicker({ photos, value, reading, onChange, onRead }: PhotoPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Photo to read"
        className="border-input bg-background h-9 min-w-0 flex-1 rounded-md border px-3 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {photos.map((p) => (
          <option key={photoKey(p)} value={photoKey(p)}>
            {photoLabel(p)}
          </option>
        ))}
      </select>
      <Button disabled={!value || reading} onClick={onRead}>
        {reading ? <Spinner /> : null}
        Read original EXIF
      </Button>
    </div>
  );
}

interface ExifResultProps {
  error: Error | null;
  /** Every tag exiftool read; undefined until it's read. */
  tags?: Record<string, unknown> | null;
  photo?: CombinedPhoto;
  onUse: (rule: OverrideRule) => void;
}

/** Why the read failed, or the tags it read. */
function ExifResult({ error, tags, photo, onUse }: ExifResultProps) {
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (!tags || !photo) return null;
  return <TagTable tags={tags} photo={photo} onUse={onUse} />;
}

interface TagTableProps {
  tags: Record<string, unknown>;
  photo: CombinedPhoto;
  onUse: (rule: OverrideRule) => void;
}

function TagTable({ tags, photo, onUse }: TagTableProps) {
  const id = useId();
  const [all, setAll] = useState(false);
  const shown = Object.entries(tags)
    .filter(([tag]) => all || CAMERA_TAG.test(tag))
    .toSorted(([a], [b]) => a.localeCompare(b));
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm">
        <input
          id={id}
          type="checkbox"
          className="accent-primary size-4"
          checked={all}
          onChange={(e) => setAll(e.target.checked)}
        />
        Show every tag, not only the camera, lens and settings ones
      </label>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-3 py-2 font-medium">Tag</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">Use for</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {shown.map(([tag, value]) => (
              <tr key={tag}>
                <td className="px-3 py-1.5 font-mono text-xs">{tag}</td>
                <td className="px-3 py-1.5 break-all">{String(value)}</td>
                <td className="px-3 py-1.5">
                  <UseFor tag={tag} onPick={(f) => onUse(ruleFor(photo, f, value))} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** value as the photo files write field: a number field takes the first number in it. */
function asFieldValue(field: OverrideField, value: unknown): OverrideValue {
  const numeric = OVERRIDE_FIELDS.find((f) => f.field === field)?.type === "number";
  if (!numeric) return String(value);
  const n = Number.parseFloat(String(value));
  return Number.isNaN(n) ? null : n;
}

/**
 * A rule writing value into field: for every photo from the camera when it's the camera's name,
 * else for the photos with the same EXIF lens as photo.
 */
function ruleFor(photo: CombinedPhoto, field: OverrideField, value: unknown): OverrideRule {
  const when =
    field === "camera" ? null : { field: "lens" as const, value: exifValue(photo, "lens") };
  return { when, set: { [field]: asFieldValue(field, value) } };
}

function UseFor({ tag, onPick }: { tag: string; onPick: (field: OverrideField) => void }) {
  return (
    <select
      aria-label={`Use ${tag} for`}
      className="border-input bg-background h-8 rounded-md border px-2 text-sm"
      value=""
      onChange={(e) => onPick(e.target.value as OverrideField)}
    >
      <option value="">—</option>
      {OVERRIDE_FIELDS.map((f) => (
        <option key={f.field} value={f.field}>
          {fieldLabel(f.field)}
        </option>
      ))}
    </select>
  );
}
