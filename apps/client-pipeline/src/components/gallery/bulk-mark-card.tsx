import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { PublishedFile } from "@/api/photos";
import { selectProblem } from "@/components/gallery/published-file";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { count } from "@portfolio/lib/words";

/** What a Gallery card that puts a mark on the chosen photos, or takes it off, says and does. */
export interface BulkMarkCardProps {
  /** Every photo on the Gallery. */
  files: PublishedFile[];
  /** The chosen photos' paths. */
  selection: ReadonlySet<string>;
  /** The card's title, such as "Lower Tier". */
  title: string;
  /** What the mark means and how the Gallery shows it. */
  description: ReactNode;
  /** The button that puts the mark on, given how many photos it'd mark, such as "Mark 3 photos Lower Tier". */
  markLabel: (photos: string) => string;
  /** The icon on the button that puts the mark on. */
  markIcon: ReactNode;
  /** The button that takes the mark off, such as "Take the mark off". */
  clearLabel: string;
  /** The icon on the button that takes the mark off. */
  clearIcon: ReactNode;
  /** What was done, given whether the mark went on and how many photos, such as "Marked 3 photos." */
  doneMessage: (marked: boolean, photos: string) => string;
  /** Puts the mark on the files, or takes it off, as changes waiting for Commit. */
  setMark: (files: PublishedFile[], marked: boolean) => void;
}

/**
 * A card that puts a mark on every chosen photo that can be changed, or takes it off, as changes
 * waiting for Commit, and says what it did. The selection stays, so the same photos can be given
 * albums and tags too.
 */
export function BulkMarkCard(props: BulkMarkCardProps) {
  const [done, setDone] = useState<string>();
  const chosen = props.files.filter(
    (file) => props.selection.has(file.path) && !selectProblem(file),
  );
  const photos = count(chosen.length, "photo");
  const set = (marked: boolean) => {
    props.setMark(chosen, marked);
    setDone(`${props.doneMessage(marked, photos)} The change waits for Commit.`);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
        <CardDescription>{props.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <Button disabled={chosen.length === 0} onClick={() => set(true)}>
            {props.markIcon}
            {props.markLabel(photos)}
          </Button>
          <Button variant="outline" disabled={chosen.length === 0} onClick={() => set(false)}>
            {props.clearIcon}
            {props.clearLabel}
          </Button>
        </div>
        {done && (
          <p className="flex items-start gap-2" aria-live="polite">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{done}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
