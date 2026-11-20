import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { LayoutGridIcon } from "lucide-react";
import { useState } from "react";
import {
  type ContactSheet,
  type ContactSheetPhoto,
  type ContactSheets,
  contactSheetsMutation,
} from "@/api/contact-sheets";
import type { BulkTagPhoto } from "@/api/bulk-tags";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pickedSheetPhotos } from "@/lib/bulk-tag-prompt";
import { count } from "@portfolio/lib/words";

/** The contact sheets for a prompt's photos, and how to make them. */
export interface ContactSheetsState {
  /** The sheets made for the photos as they are now, or undefined until they're made. */
  sheets?: ContactSheet[];
  /** The whole answer for the photos as they are now, or undefined until the sheets are made. */
  made?: ContactSheets;
  /** How many photos would go on the sheets. */
  photos: number;
  pending: boolean;
  error: Error | null;
  /** Makes the sheets for the photos as they are now. */
  make: () => void;
}

/** One string for a list of photos, so sheets made for other photos aren't used. */
function photosKey(photos: ContactSheetPhoto[]): string {
  return photos.map((photo) => `${photo.label}\n${photo.url}`).join("\n");
}

/**
 * The contact sheets for photos, in the order the prompt lists them. Sheets made for another list
 * of photos (after picking others, say) are dropped, so the prompt's tile numbers always match.
 */
export function useContactSheets(photos: ContactSheetPhoto[]): ContactSheetsState {
  const mutation = useMutation(contactSheetsMutation);
  const [madeFor, setMadeFor] = useState<{ key: string; made: ContactSheets } | null>(null);
  const key = photosKey(photos);
  const made = madeFor?.key === key ? madeFor.made : undefined;
  return {
    sheets: made?.sheets,
    made,
    photos: photos.length,
    pending: mutation.isPending,
    error: mutation.error,
    make: () =>
      mutation.mutate({ photos }, { onSuccess: (answer) => setMadeFor({ key, made: answer }) }),
  };
}

/** The contact sheets for photos picked on a bulk page (tags, genres or places), in the prompt's order. */
export function usePickedContactSheets(photos: BulkTagPhoto[]): ContactSheetsState {
  return useContactSheets(pickedSheetPhotos(photos));
}

/**
 * Makes contact sheets of the prompt's photos in R2, so the copied prompt links a few numbered
 * sheets for the LLM to look through instead of opening every photo's link, and says what was made.
 */
export function ContactSheetsButton({ state }: { state: ContactSheetsState }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <MakeButton state={state} />
        <p className="text-muted-foreground text-sm">{madeText(state.made)}</p>
      </div>
      {state.made && <MadeSheets made={state.made} />}
      {state.error && <p className="text-destructive text-sm">{state.error.message}</p>}
    </div>
  );
}

/** The button that makes the sheets, or makes them again. */
function MakeButton({ state }: { state: ContactSheetsState }) {
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={state.photos === 0 || state.pending}
      onClick={state.make}
    >
      {state.pending ? <Spinner /> : <LayoutGridIcon />}
      {state.made ? "Make the contact sheets again" : "Make contact sheets"}
    </Button>
  );
}

/** What the sheets are for, or how many were made. */
function madeText(made: ContactSheets | undefined): string {
  if (!made) {
    return "Optional: puts the photos on numbered sheets of 30 in R2 for the prompt to link, which is quicker and cheaper for the LLM to look through.";
  }
  const ready = `${count(made.sheets.length, "contact sheet")} ready. The prompt links them now`;
  return made.expiryProblem ? `${ready}.` : `${ready}, and R2 deletes them after a day.`;
}

/** Links to the sheets, the photos that couldn't be read, and where to delete them when R2 won't. */
function MadeSheets({ made }: { made: ContactSheets }) {
  return (
    <>
      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
        {made.sheets.map((sheet, i) => (
          <li key={sheet.url}>
            <a href={sheet.url} target="_blank" rel="noreferrer" className="underline">
              Sheet {i + 1}
            </a>{" "}
            <span className="text-muted-foreground">
              ({sheet.first} to {sheet.last})
            </span>
          </li>
        ))}
      </ul>
      {made.missing.length > 0 && (
        <p className="text-muted-foreground text-sm">
          {count(made.missing.length, "photo")} couldn&apos;t be read and show as gray tiles:{" "}
          {made.missing.join(", ")}.
        </p>
      )}
      {made.expiryProblem && <KeptNote />}
    </>
  );
}

/**
 * Where to delete the sheets when R2 has no lifecycle rule to do it: the R2 token can't add one,
 * which is fine, since Explore Bucket deletes them.
 */
function KeptNote() {
  return (
    <p className="text-muted-foreground text-sm">
      R2 keeps these until they&apos;re deleted. Clear them in{" "}
      <Link to="/bucket" hash="contact-sheets" className="text-foreground underline">
        Explore Bucket → Contact sheets
      </Link>{" "}
      when you&apos;re done.
    </p>
  );
}
