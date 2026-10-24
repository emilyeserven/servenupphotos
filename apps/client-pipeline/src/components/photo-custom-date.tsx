import { CalendarIcon } from "lucide-react";
import { FieldSection } from "@/components/field-section";
import { FieldLabel } from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateFromFileName, fromInputValue, inputValue, readableDate } from "@/lib/photo-date";

/** How to fill in the custom date, shown beside its title. */
const HELP =
  "Optional. When the photo was taken, which the portfolio uses instead of the date in the photo's EXIF, which is kept as it is. The portfolio leaves out photos with no date at all, so a photo whose EXIF has none needs one to show. Saved as customCreateDate; leave it empty to use the EXIF one.";

interface PhotoCustomDateProps {
  /** The custom date, as exiftool writes dates ("2016:12:23 22:07:39"), or "" for none. */
  value: string;
  /** The date in the photo's EXIF, or null when it has none. */
  exifDate: string | null;
  /** The photo's file name without its extension, which phones often write the date into. */
  fileStem: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** What the portfolio uses, for the collapsed summary: the custom date, the EXIF one, or none. */
function dateSummary(value: string, exifDate: string | null): string {
  if (value.trim()) return `${readableDate(value)} (custom)`;
  return exifDate
    ? `${readableDate(exifDate)} (from EXIF)`
    : "None in the EXIF, so the portfolio leaves it out";
}

/**
 * When the photo was taken, which the portfolio uses instead of its EXIF date. Collapsed to what
 * the portfolio uses, and open from the start when one is written or the EXIF has none. When the
 * file name has a date in it and none is written, it's offered in one click.
 */
export function PhotoCustomDate({
  value,
  exifDate,
  fileStem,
  disabled,
  onChange,
}: PhotoCustomDateProps) {
  return (
    <FieldSection
      title="Date taken"
      summary={dateSummary(value, exifDate)}
      defaultOpen={Boolean(value.trim() || !exifDate)}
      className="flex flex-col gap-2"
    >
      <FieldLabel htmlFor="photo-custom-date" help={HELP}>
        Custom date
      </FieldLabel>
      <Input
        id="photo-custom-date"
        type="datetime-local"
        step={1}
        value={inputValue(value)}
        disabled={disabled}
        onChange={(event) => onChange(fromInputValue(event.target.value))}
      />
      <FileNameDate value={value} fileStem={fileStem} disabled={disabled} onChange={onChange} />
    </FieldSection>
  );
}

/** Offers the date in the file name, when it has one and no custom date is written. */
function FileNameDate({
  value,
  fileStem,
  disabled,
  onChange,
}: Omit<PhotoCustomDateProps, "exifDate">) {
  const found = dateFromFileName(fileStem);
  if (!found || value.trim()) return null;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto justify-start p-0 text-xs"
      disabled={disabled}
      onClick={() => onChange(found)}
    >
      <CalendarIcon />
      Use {readableDate(found)} from the file name
    </Button>
  );
}
