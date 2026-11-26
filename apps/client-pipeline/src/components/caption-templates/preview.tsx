import { useState } from "react";
import type { CaptionTemplate } from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import { CaptionRuns } from "@/components/caption-runs";
import { ErrorNote } from "@/components/error-note";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fillTemplate, templateValues } from "@/lib/caption-place-form";
import { captionLists, captionValues, unknownPlaceholders } from "@/lib/caption-template";
import { type CombinedPhoto, photoText } from "@/lib/group-photos";
import { FILE, TITLE } from "@/lib/photo-fields";
import { shownPhotos } from "@/lib/place-seeds";

/** A photo's name in the preview's list: its title, or else its file. */
export function photoLabel(photo: CombinedPhoto, index: number): string {
  return photoText(photo, TITLE) ?? photoText(photo, FILE) ?? `Photo ${index + 1}`;
}

/** The photos to preview with, newest first, as the portfolio lists them. */
export function previewPhotos(data: CombinedData): CombinedPhoto[] {
  return shownPhotos(data).toReversed();
}

/** The caption the template makes for a photo picked from the portfolio's, with any placeholder it doesn't know. */
export function TemplatePreview(props: { template: CaptionTemplate; data: CombinedData }) {
  const { template, data } = props;
  const photos = previewPhotos(data);
  const [index, setIndex] = useState(0);
  const raw = captionValues(photos[index] ?? {}, captionLists(data), ["travelphotography"]);
  const values = templateValues(template, raw);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription>
          The caption for one of the photos, with #travelphotography as its post&apos;s hashtags.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <PhotoSelect photos={photos} index={index} onChange={setIndex} />
        <p className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
          <CaptionRuns text={fillTemplate(template, raw) || "Nothing yet."} />
        </p>
        <UnknownNote names={unknownPlaceholders(template.template, values)} />
      </CardContent>
    </Card>
  );
}

interface PhotoSelectProps {
  photos: CombinedPhoto[];
  index: number;
  onChange: (index: number) => void;
}

function PhotoSelect({ photos, index, onChange }: PhotoSelectProps) {
  return (
    <select
      aria-label="Photo to preview"
      value={index}
      onChange={(event) => onChange(Number(event.target.value))}
      className="border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs"
    >
      {photos.map((p, i) => (
        <option key={i} value={i}>
          {photoLabel(p, i)}
        </option>
      ))}
    </select>
  );
}

/** The placeholders no photo field is called, which are left empty. */
function UnknownNote({ names }: { names: string[] }) {
  if (names.length === 0) return null;
  return (
    <ErrorNote
      error={`No photo field is called ${names.map((name) => `{${name}}`).join(", ")}, so ${names.length === 1 ? "it's" : "they're"} left empty.`}
    />
  );
}
