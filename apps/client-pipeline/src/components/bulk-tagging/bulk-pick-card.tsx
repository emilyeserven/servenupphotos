import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { bulkTagCount, defaultBulkTagCount, PickCount } from "@/components/bulk-tagging/pick-count";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface BulkPickCardProps<T extends { photos: { path: string }[] }, B> {
  title: string;
  description: ReactNode;
  /** The pick's mutation, such as Bulk Tagging's. */
  options: UseMutationOptions<T, Error, B>;
  /** The pick's body: the photos already shown, to leave out, and how many to pick. */
  body: (skip: string[], count: number) => B;
  /** Shown above the pick buttons, such as how many photos there are to pick from, or an option. */
  before?: (pending: boolean) => ReactNode;
  /** What's shown for the picked photos, such as their prompt and the answer's review. */
  children: (pick: T) => ReactNode;
}

/**
 * A bulk LLM card such as Bulk Tagging: picks up to the chosen number of related photos (5 at first,
 * up to 50), then other photos leaving out the ones shown, or starts over, and shows `children` for
 * each pick.
 */
export function BulkPickCard<T extends { photos: { path: string }[] }, B>({
  title,
  description,
  options,
  body,
  before,
  children,
}: BulkPickCardProps<T, B>) {
  const [shown, setShown] = useState<string[]>([]);
  const [count, setCount] = useState(String(defaultBulkTagCount));
  const pick = useMutation({
    ...options,
    onSuccess: (result) => setShown((paths) => [...paths, ...result.photos.map((p) => p.path)]),
  });
  const pickFrom = (skip: string[]) => pick.mutate(body(skip, bulkTagCount(count)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {before?.(pick.isPending)}
        <div className="flex flex-wrap items-center gap-3">
          <PickCount value={count} disabled={pick.isPending} onChange={setCount} />
          <PickButtons
            picked={pick.data !== undefined}
            pending={pick.isPending}
            onPick={() => pickFrom(shown)}
            onRestart={() => {
              setShown([]);
              pickFrom([]);
            }}
          />
        </div>
        <ErrorText error={pick.error} />
        {pick.data && <div key={pick.submittedAt}>{children(pick.data)}</div>}
      </CardContent>
    </Card>
  );
}

interface PickButtonsProps {
  /** Whether photos have been picked already, so the next pick leaves them out. */
  picked: boolean;
  pending: boolean;
  onPick: () => void;
  onRestart: () => void;
}

/** Picks photos, then other photos, or starts over from every photo. */
function PickButtons({ picked, pending, onPick, onRestart }: PickButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" variant="outline" disabled={pending} onClick={onPick}>
        {pending && <Spinner />}
        {picked ? "Pick other photos" : "Pick photos"}
      </Button>
      {picked && (
        <Button type="button" variant="ghost" disabled={pending} onClick={onRestart}>
          Start over
        </Button>
      )}
    </div>
  );
}

/** What went wrong, when something did. */
export function ErrorText({ error }: { error: Error | null }) {
  return error && <p className="text-destructive text-sm">{error.message}</p>;
}
