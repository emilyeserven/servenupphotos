import { Link } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import {
  type ComparisonMode,
  ComparisonModePicker,
  EditComparison,
} from "@portfolio/components/edit-comparison";
import { parseImage } from "@portfolio/lib/photo-image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { PhotoJson } from "@/components/edit-in-flight/photo-json";
import type { UneditedOriginal } from "@/components/edit-in-flight/use-unedited-original";
import {
  type OriginalEntry,
  cropOrMiddle,
  facesChecked,
  knownSize,
  originalShown,
} from "@/lib/unedited-original";

interface OriginalComparisonCardProps {
  original: UneditedOriginal;
  entry: OriginalEntry;
  saved: PhotoJson;
  blocked: boolean;
}

/** The edit and its original as the comparison draws them, or null without versions to draw. */
function comparedImages(saved: PhotoJson, entry: OriginalEntry) {
  const edited = parseImage(saved as unknown as Parameters<typeof parseImage>[0]);
  const raw = parseImage(entry);
  const edit = knownSize(saved);
  if (!edited || !raw || !edit) return null;
  return { edited, original: { ...raw, crop: cropOrMiddle(entry, edit) } };
}

/**
 * The edit compared with its unedited original, as the portfolio's Raw vs Edited page draws them,
 * with whether the portfolio shows it and a way to take it off the photo.
 */
export function OriginalComparisonCard({
  original,
  entry,
  saved,
  blocked,
}: OriginalComparisonCardProps) {
  const [mode, setMode] = useState<ComparisonMode>("slider");
  const images = comparedImages(saved, entry);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Original vs edited</CardTitle>
        <CardDescription>
          <code>{entry.file ?? "The original"}</code> next to this photo. Drag the line, see them
          side by side, or switch between them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ComparisonModePicker mode={mode} onChange={setMode} />
        {images ? (
          <EditComparison {...images} alt="This photo" mode={mode} maxHeight="70vh" />
        ) : (
          <p className="text-muted-foreground text-sm">
            The photo or its original has no resized versions to compare yet.
          </p>
        )}
        <div className="flex flex-col gap-4 border-t pt-4">
          <ShowOnPortfolio original={original} entry={entry} saved={saved} blocked={blocked} />
          <RemoveOriginal original={original} blocked={blocked} />
        </div>
      </CardContent>
    </Card>
  );
}

/** The checkbox that shows the original on the portfolio's Raw vs Edited page, or stops. */
function ShowOnPortfolio({ original, entry, saved, blocked }: OriginalComparisonCardProps) {
  const marked = entry.showOnPortfolio === true;
  return (
    <div className="flex items-start gap-3">
      <input
        id="original-show"
        type="checkbox"
        className="accent-primary mt-0.5 size-4 cursor-pointer disabled:cursor-not-allowed"
        checked={marked}
        disabled={blocked}
        aria-describedby="original-show-help"
        onChange={(event) => original.setShown(event.target.checked)}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="original-show" className="text-sm font-medium">
          Show on the portfolio
        </label>
        <p id="original-show-help" className="text-muted-foreground text-sm">
          <ShownHelp
            shown={originalShown(saved)}
            marked={marked}
            checked={facesChecked(saved, entry)}
          />
        </p>
      </div>
    </div>
  );
}

function ShownHelp({
  shown,
  marked,
  checked,
}: {
  shown: boolean;
  marked: boolean;
  checked: boolean;
}) {
  if (shown) {
    return (
      <>
        On the portfolio&apos;s Raw vs Edited page and behind a button in its photo viewer, once
        Commit&apos;s pull request merges. Only its resized versions go there.
      </>
    );
  }
  if (marked && !checked) {
    return (
      <>
        Marked to show, but held back until its pixelated areas are saved under Pixelate the
        original.
      </>
    );
  }
  return (
    <>Off, it stays in the pipeline: the portfolio&apos;s build leaves it out of the photo data.</>
  );
}

/** Takes the original off the photo's JSON, leaving its files in R2. */
function RemoveOriginal({ original, blocked }: { original: UneditedOriginal; blocked: boolean }) {
  const { change } = original;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" disabled={blocked} onClick={original.remove}>
          <Trash2Icon />
          Remove original
        </Button>
        {change.isPending && <Spinner />}
        {change.error && <span className="text-destructive text-sm">{change.error.message}</span>}
      </div>
      <p className="text-muted-foreground text-xs">
        Removing it only takes it off the photo&apos;s JSON; its files stay in R2, to delete from{" "}
        <Link to="/bucket" className="underline underline-offset-4">
          Explore Bucket
        </Link>{" "}
        once the pull request merges.
      </p>
    </div>
  );
}
