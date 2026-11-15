import { useId, useMemo, useState } from "react";
import { AutogroupReview } from "@/components/compare/autogroup-review";
import { ReadProblems } from "@/components/compare/compare-group-list";
import { CopyPromptButton, PasteAnswer } from "@/components/bulk-tagging/pick-controls";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCompareGroups } from "@/hooks/use-compare-groups";
import {
  type AutogroupAnswer,
  type AutogroupOptions,
  type AutogroupPhoto,
  type AutogroupScope,
  autogroupBatchSize,
  autogroupBatches,
  autogroupPhotos,
  autogroupPrompt,
  defaultAutogroupBatch,
  readAutogroupAnswer,
} from "@/lib/compare-autogroup";
import type { ComparePhoto } from "@/lib/compare-groups";
import { cn } from "@/lib/utils";

/**
 * Autogroup: chooses every photo or only the drafts, copies a prompt linking a batch of their Small
 * images for an LLM, and reads its JSON answer back into compare groups to review and make.
 */
export function AutogroupCard() {
  const compare = useCompareGroups();
  const [options, setOptions] = useState<AutogroupOptions>({ scope: "all", skipGrouped: true });
  const [typedSize, setTypedSize] = useState(String(defaultAutogroupBatch));
  const [index, setIndex] = useState(0);
  const size = autogroupBatchSize(typedSize);
  const photos = useMemo(() => autogroupPhotos(compare.photos, options), [compare.photos, options]);
  const batches = autogroupBatches(photos, size);
  const shown = Math.min(index, Math.max(batches.length - 1, 0));
  const change = (next: Partial<AutogroupOptions>) => {
    setOptions({ ...options, ...next });
    setIndex(0);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Autogroup</CardTitle>
        <CardDescription>
          Copy a prompt linking each photo&apos;s Small version into a chat with an LLM, which finds
          the photos that are too similar to all be posted, not only near duplicates. Paste its JSON
          answer back, review the groups, and add them to Compare, waiting for Commit like any other
          compare group. Photos are taken oldest first, so a bigger batch lets it compare photos
          from further apart.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ReadProblems problems={compare.problems} />
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <ScopeToggle value={options.scope} onChange={(scope) => change({ scope })} />
          <SkipGroupedCheck
            checked={options.skipGrouped}
            onChange={(skipGrouped) => change({ skipGrouped })}
          />
          <BatchSize
            value={typedSize}
            onChange={(value) => {
              setTypedSize(value);
              setIndex(0);
            }}
          />
        </div>
        {compare.pending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <BatchPicker
            count={photos.length}
            size={size}
            index={shown}
            batches={batches.length}
            onChange={setIndex}
          />
        )}
        {batches[shown] && (
          <AutogroupBatch
            key={`${options.scope}-${options.skipGrouped}-${size}-${shown}`}
            batch={batches[shown]}
            all={compare.photos}
          />
        )}
      </CardContent>
    </Card>
  );
}

const SCOPES: [AutogroupScope, string][] = [
  ["all", "All photos"],
  ["drafts", "Draft photos"],
];

/** Whether the prompt asks about every photo, or only the drafts. */
function ScopeToggle({
  value,
  onChange,
}: {
  value: AutogroupScope;
  onChange: (scope: AutogroupScope) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Which photos to group"
      className="bg-background flex shrink-0 rounded-md border p-0.5"
    >
      {SCOPES.map(([scope, text]) => (
        <button
          key={scope}
          type="button"
          aria-pressed={value === scope}
          onClick={() => onChange(scope)}
          className={cn(
            "focus-visible:ring-ring rounded px-3 py-1 outline-none focus-visible:ring-2",
            value === scope
              ? "bg-primary text-primary-foreground font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

/** Leaves out photos already in a compare group. */
function SkipGroupedCheck({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="checkbox"
        className="accent-primary size-4"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>Leave out photos already in a group</label>
    </div>
  );
}

/** How many photos one prompt links. */
function BatchSize({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      Photos per prompt
      <Input
        type="number"
        min={1}
        max={200}
        step={1}
        className="w-20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => onChange(String(autogroupBatchSize(value)))}
      />
    </label>
  );
}

interface BatchPickerProps {
  /** How many photos there are to ask about. */
  count: number;
  size: number;
  index: number;
  batches: number;
  onChange: (index: number) => void;
}

/** How many photos there are and, with more than one batch, which one the prompt is for. */
function batchText({ count, size, index, batches }: Omit<BatchPickerProps, "onChange">): string {
  const photos = count === 1 ? "1 photo" : `${count} photos`;
  if (batches < 2) return photos;
  const first = index * size + 1;
  const last = Math.min(count, first + size - 1);
  return `${photos}, batch ${index + 1} of ${batches} (photos ${first} to ${last})`;
}

/** How many photos there are, which batch the prompt is for, and buttons to go to the others. */
function BatchPicker(props: BatchPickerProps) {
  if (props.count === 0) {
    return <p className="text-muted-foreground text-sm">No photos to group with these choices.</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span>{batchText(props)}</span>
      {props.batches > 1 && (
        <BatchButtons index={props.index} batches={props.batches} onChange={props.onChange} />
      )}
    </div>
  );
}

/** Goes to the batch before or after this one. */
function BatchButtons({ index, batches, onChange }: Omit<BatchPickerProps, "count" | "size">) {
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={index === 0}
        onClick={() => onChange(index - 1)}
      >
        Previous batch
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={index >= batches - 1}
        onClick={() => onChange(index + 1)}
      >
        Next batch
      </Button>
    </div>
  );
}

interface AutogroupBatchProps {
  batch: AutogroupPhoto[];
  /** Every photo that can be compared, to count the ones in a suggested group already. */
  all: ComparePhoto[];
}

/** The batch's photos, its prompt, the box to paste the answer into, and the review of it. */
function AutogroupBatch({ batch, all }: AutogroupBatchProps) {
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<AutogroupAnswer | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Each review starts fresh, so groups left out of the last one aren't left out of the next.
  const [reviews, setReviews] = useState(0);
  const review = () => {
    try {
      setAnswer(readAutogroupAnswer(typed, batch, all));
      setReviews((n) => n + 1);
      setError(null);
    } catch (problem) {
      setAnswer(null);
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <BatchTiles batch={batch} />
      <CopyPromptButton
        label={`Copy the Autogroup prompt for ${batch.length} photos`}
        disabled={false}
        prompt={() => autogroupPrompt(batch)}
      />
      <PasteAnswer
        value={typed}
        onChange={setTyped}
        pending={false}
        label="Review the groups"
        onReview={review}
      />
      {error && <p className="text-destructive text-sm">{error}</p>}
      {answer && <AutogroupReview key={reviews} answer={answer} />}
    </div>
  );
}

/** The batch's photos as small square tiles, each named on hover. */
function BatchTiles({ batch }: { batch: AutogroupPhoto[] }) {
  return (
    <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-10 lg:grid-cols-12">
      {batch.map((entry) => (
        <li key={entry.key} title={entry.takenAt ? `${entry.key}, ${entry.takenAt}` : entry.key}>
          <PickedThumbnail data={entry.photo.data} alt={entry.key} className="w-full" />
        </li>
      ))}
    </ul>
  );
}
