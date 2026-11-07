import { useState } from "react";
import {
  R2_EXIF_FIELD_LABELS,
  type R2ExifFieldValue,
  type R2ExifMismatch,
  type R2ExifPhoto,
} from "@/api/r2-exif";
import { ConfirmWriteButton } from "@/components/r2-exif/confirm-write";
import { Input } from "@/components/ui/input";

/** What each source of the pipeline's value says beside it. */
const SOURCE_NOTES: Record<R2ExifMismatch["source"], string> = {
  custom: "custom value",
  override: "camera override or custom lens",
  "": "",
};

/**
 * The fields of a photo that don't match its original in R2. Make each change in Lightroom first,
 * then tick it as done there; only ticked fields are written, and the button asks before writing.
 * Each starts with the pipeline's value, which can be changed to match what Lightroom has.
 */
export function MismatchForm({ photo }: { photo: R2ExifPhoto }) {
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(photo.mismatches.map((m) => [m.field, m.photo])),
  );
  const fields: R2ExifFieldValue[] = photo.mismatches
    .filter((m) => picked[m.field])
    .map((m) => ({ field: m.field, value: values[m.field] ?? m.photo, lightroom: true as const }));

  return (
    <div className="flex flex-col gap-3">
      <table className="w-full text-sm">
        <thead className="text-muted-foreground text-left text-xs">
          <tr>
            <th className="w-24 font-normal">Done in Lightroom</th>
            <th className="font-normal">Field</th>
            <th className="font-normal">In R2 now</th>
            <th className="font-normal">Write</th>
          </tr>
        </thead>
        <tbody>
          {photo.mismatches.map((m) => (
            <MismatchRow
              key={m.field}
              mismatch={m}
              picked={Boolean(picked[m.field])}
              value={values[m.field] ?? m.photo}
              onPick={(on) => setPicked((p) => ({ ...p, [m.field]: on }))}
              onValue={(v) => setValues((p) => ({ ...p, [m.field]: v }))}
            />
          ))}
        </tbody>
      </table>
      <ConfirmWriteButton photo={photo} fields={fields} />
    </div>
  );
}

interface MismatchRowProps {
  mismatch: R2ExifMismatch;
  picked: boolean;
  value: string;
  onPick: (picked: boolean) => void;
  onValue: (value: string) => void;
}

/** One field: a box to tick once it's changed in Lightroom, what R2 has, and the value to write. */
function MismatchRow({ mismatch, picked, value, onPick, onValue }: MismatchRowProps) {
  const label = R2_EXIF_FIELD_LABELS[mismatch.field];
  return (
    <tr className="align-top">
      <td className="py-1.5">
        <input
          type="checkbox"
          aria-label={`${label} is done in Lightroom`}
          className="accent-primary mt-1 size-4"
          checked={picked}
          onChange={(event) => onPick(event.target.checked)}
        />
      </td>
      <td className="py-1.5 pr-2">
        <span className="font-medium">{label}</span>
        <SourceNote source={mismatch.source} />
      </td>
      <td className="text-muted-foreground py-1.5 pr-2 break-all">{mismatch.r2 ?? "None"}</td>
      <td className="py-1.5">
        <Input
          aria-label={`${label} to write`}
          value={value}
          disabled={!picked}
          onChange={(event) => onValue(event.target.value)}
          className="h-8"
        />
      </td>
    </tr>
  );
}

function SourceNote({ source }: { source: R2ExifMismatch["source"] }) {
  if (!source) return null;
  return <p className="text-muted-foreground text-xs">{SOURCE_NOTES[source]}</p>;
}
