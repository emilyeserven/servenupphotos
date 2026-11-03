import { PlusIcon } from "lucide-react";
import { useState } from "react";
import type { CombinedData } from "@/api/photos";
import { photosBetween, type TimelineLabel, timelineLabels } from "@/api/timeline-labels";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { dayRange } from "@/components/timeline-labels/day-range";
import { LabelEditor } from "@/components/timeline-labels/editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { shownPhotos } from "@/lib/place-seeds";
import { cn } from "@/lib/utils";
import { useCombinedData } from "@/stores/combined-data";

/** The Timeline Labels page: names for runs of days, such as a trip, shown on the portfolio's Timeline. */
export function TimelineLabelsPage() {
  return (
    <Page
      wide
      title="Timeline Labels"
      description="Names for runs of days, such as “Korea” for Sep 20 to 21 and “Japan” for Sep 22 to Oct 2. The portfolio's Timeline shows each day's label on the right of its heading, just under the month. Each label is one JSON file, combined into TIMELINE.json."
    >
      <GitHubGate>{() => <Labels />}</GitHubGate>
    </Page>
  );
}

function Labels() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and timeline labels from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  return <LabelChooser data={combined.data} />;
}

/** The chosen label's ID, or "" for a new one. */
const NEW_LABEL = "";

/** The labels listed on the left, newest first, and the chosen one, or a new one, edited on the right. */
function LabelChooser({ data }: { data: CombinedData }) {
  const labels = timelineLabels(data);
  const [chosen, setChosen] = useState<string>(() => labels[0]?.id ?? NEW_LABEL);
  const label = labels.find((l) => l.id === chosen);
  const photos = shownPhotos(data);
  const countPhotos = (start: string, end: string) => photosBetween(photos, start, end);
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <LabelList
        labels={labels}
        countPhotos={countPhotos}
        chosen={label?.id}
        onChoose={setChosen}
      />
      <LabelEditor
        key={label?.id ?? NEW_LABEL}
        label={label}
        labels={labels}
        countPhotos={countPhotos}
        onSaved={setChosen}
      />
    </div>
  );
}

interface LabelListProps {
  labels: TimelineLabel[];
  countPhotos: (start: string, end: string) => number;
  chosen?: string;
  onChoose: (id: string) => void;
}

function LabelList({ labels, countPhotos, chosen, onChoose }: LabelListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Labels</CardTitle>
        <CardDescription>
          Newest first, with how many photos were taken on their days.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {labels.length === 0 && <p className="text-muted-foreground text-sm">None yet.</p>}
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            onClick={() => onChoose(label.id)}
            aria-current={label.id === chosen}
            className={cn(
              "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              label.id === chosen && "bg-muted font-medium",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{label.name}</span>
              <span className="text-muted-foreground text-xs font-normal">
                {dayRange(label.start, label.end)}
              </span>
            </span>
            <span className="text-muted-foreground shrink-0 text-xs">
              {countPhotos(label.start, label.end)}
            </span>
          </button>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 self-start"
          disabled={chosen === undefined}
          onClick={() => onChoose(NEW_LABEL)}
        >
          <PlusIcon aria-hidden />
          New label
        </Button>
      </CardContent>
    </Card>
  );
}
