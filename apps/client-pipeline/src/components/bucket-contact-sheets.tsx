import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import { deleteContactSheetsMutation } from "@/api/contact-sheets";
import { type BucketImage, bucketImagesQuery } from "@/api/photos";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type ContactSheetSet, contactSheetSets } from "@/lib/contact-sheets";
import { count } from "@portfolio/lib/words";
import { dateTimeText } from "@portfolio/lib/dates";
import { ErrorNote } from "@/components/error-note";

/** A size in bytes as KB or MB. */
function sizeText(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Deletes one set of sheets, or every set for "", and lists the bucket again. */
function useDeleteSheets() {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteContactSheetsMutation,
    onSettled: () => queryClient.invalidateQueries({ queryKey: bucketImagesQuery.queryKey }),
  });
}

/**
 * Explore Bucket's Contact sheets section: every set of sheets made for a prompt, newest first,
 * each with its sheets and a button to delete it, and one to delete them all. R2 deletes them
 * after a day only when the bucket has the lifecycle rule, so this is how they're cleared without
 * it. Nothing shows when there are none.
 */
export function ContactSheetsCard() {
  const bucket = useQuery(bucketImagesQuery);
  const sets = contactSheetSets(bucket.data?.images ?? []);
  const remove = useDeleteSheets();
  if (sets.length === 0) return null;
  const sheets = sets.reduce((sum, set) => sum + set.sheets.length, 0);
  return (
    <Card id="contact-sheets">
      <CardHeader>
        <CardTitle>Contact sheets</CardTitle>
        <CardDescription>
          {count(sets.length, "set")} of sheets made for prompts, {count(sheets, "sheet")} in{" "}
          <code>contact-sheets/</code>. A prompt that links a deleted sheet can&apos;t show it
          anymore.
        </CardDescription>
        <CardAction>
          <DeleteAllButton sheets={sheets} remove={remove} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y">
          {sets.map((set) => (
            <SheetSetRow key={set.name} set={set} remove={remove} />
          ))}
        </ul>
        <DeleteProblems remove={remove} />
      </CardContent>
    </Card>
  );
}

type DeleteSheets = ReturnType<typeof useDeleteSheets>;

/** Deletes every set, after a second press that says how many sheets go. */
function DeleteAllButton({ sheets, remove }: { sheets: number; remove: DeleteSheets }) {
  const [asking, setAsking] = useState(false);
  const press = () => {
    setAsking(!asking);
    if (asking) remove.mutate("");
  };
  return (
    <Button
      variant={asking ? "destructive" : "outline"}
      size="sm"
      disabled={remove.isPending}
      onClick={press}
      onBlur={() => setAsking(false)}
    >
      <DeleteIcon pending={remove.isPending && remove.variables === ""} />
      {asking ? `Delete ${count(sheets, "sheet")}?` : "Delete all"}
    </Button>
  );
}

/** A spinner while deleting, or else a trash can. */
function DeleteIcon({ pending }: { pending: boolean }) {
  return pending ? <Spinner /> : <Trash2Icon />;
}

/** One set: when it was made, its sheets as small links, its size, and a button to delete it. */
function SheetSetRow({ set, remove }: { set: ContactSheetSet<BucketImage>; remove: DeleteSheets }) {
  return (
    <li className="flex flex-wrap items-center gap-3 py-2">
      <div className="flex min-w-48 flex-col text-sm">
        <span>{dateTimeText(set.modified)}</span>
        <span className="text-muted-foreground text-xs">
          {count(set.sheets.length, "sheet")} · {sizeText(set.size)}
        </span>
      </div>
      <ul className="flex flex-1 flex-wrap gap-1.5">
        {set.sheets.map((sheet, i) => (
          <li key={sheet.key}>
            <a href={sheet.url} target="_blank" rel="noreferrer" title={sheet.key}>
              <img
                src={sheet.url}
                alt={`Sheet ${i + 1}`}
                loading="lazy"
                className="bg-muted h-10 w-11 rounded border object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive"
        disabled={remove.isPending}
        onClick={() => remove.mutate(set.name)}
      >
        <DeleteIcon pending={remove.isPending && remove.variables === set.name} />
        Delete
      </Button>
    </li>
  );
}

/** Why the last delete failed, or which sheets it couldn't delete. */
function DeleteProblems({ remove }: { remove: DeleteSheets }) {
  const text = problemText(remove.error, remove.data);
  return <ErrorNote error={text} />;
}

/** Why the last delete failed, or else which sheets it couldn't delete, or "". */
function problemText(error: Error | null, data: DeleteSheets["data"]): string {
  if (error) return error.message;
  return failedText(data?.failed);
}

/** How many sheets couldn't be deleted and why, or "" when none. */
function failedText(failed: { message: string }[] = []): string {
  const [first] = failed;
  return first ? `${count(failed.length, "sheet")} couldn't be deleted: ${first.message}` : "";
}
