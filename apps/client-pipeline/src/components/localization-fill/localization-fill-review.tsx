import { useIsMutating } from "@tanstack/react-query";
import { useLocalizationDrafts } from "@/components/localization-drafts";
import {
  FIELDS,
  type Fields,
  LocalizationRowForms,
  savedFields,
} from "@/components/localization-row";
import { count } from "@/components/update-data-shared";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { LocalizationAnswer } from "@/lib/localization-answer";
import type { LocalizationRow } from "@/lib/place-seeds";

/** The row's saved fields, with the answer's in the ones that are empty, so nothing saved is replaced. */
function filledFields(row: LocalizationRow, answered: Fields): Fields {
  const saved = savedFields(row.saved);
  return Object.fromEntries(
    FIELDS.map(({ key }) => [key, saved[key].trim() || answered[key]]),
  ) as Fields;
}

/** The fields to start each answered row with, by localization ID. */
function filledDrafts(rows: LocalizationRow[], answer: LocalizationAnswer): Record<string, Fields> {
  return Object.fromEntries(
    rows.flatMap((row) => {
      const answered = answer.fields[row.id];
      return answered ? [[row.id, filledFields(row, answered)]] : [];
    }),
  );
}

interface LocalizationFillReviewProps {
  /** Every name the prompt asked about, as they are now. */
  rows: LocalizationRow[];
  answer: LocalizationAnswer;
}

/**
 * Each name the answer fills in, as a row to check and change before saving it, or all of them with
 * one button; then the names it left out, and the ones it gave that weren't asked about.
 */
export function LocalizationFillReview({ rows, answer }: LocalizationFillReviewProps) {
  const answered = rows.filter((row) => row.id in answer.fields);
  const drafts = useLocalizationDrafts(answered, filledDrafts(answered, answer));
  const busy = useIsMutating({ mutationKey: ["localizations", "save"] });
  const changed = drafts.changed.length;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col divide-y">
        <LocalizationRowForms rows={answered} drafts={drafts} />
      </div>
      <LeftOut rows={rows.filter((row) => !(row.id in answer.fields))} unknown={answer.unknown} />
      <Button
        type="button"
        className="self-start"
        disabled={changed === 0}
        onClick={drafts.saveAll}
      >
        {busy > 0 && <Spinner />}
        {changed > 0 ? `Save ${count(changed, "localization")}` : "Saved"}
      </Button>
    </div>
  );
}

/** The names the answer didn't give, and the IDs it gave that weren't asked about. */
function LeftOut({ rows, unknown }: { rows: LocalizationRow[]; unknown: string[] }) {
  return (
    <>
      {rows.length > 0 && (
        <p className="text-muted-foreground text-sm">
          The answer left out {rows.map((row) => row.name).join(", ")}, so{" "}
          {rows.length === 1 ? "it's" : "they're"} still to fill in.
        </p>
      )}
      {unknown.length > 0 && (
        <p className="text-muted-foreground text-sm">
          Left out, since the prompt didn&apos;t ask about them: {unknown.join(", ")}.
        </p>
      )}
    </>
  );
}
