import {
  type QueryClient,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  cacheSavedEntry,
  type LocalizationType,
  placesQuery,
  readEntries,
  saveLocalizationMutation,
} from "@/api/places";
import { FloatingAction } from "@/components/floating-actions";
import {
  type Fields,
  isChanged,
  LocalizationRowForm,
  savedFields,
} from "@/components/localization-row";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LocalizationRow, localizationRows, shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The Localizations page: how each country, state, city and place is written and said where it is. */
export function LocalizationsPage() {
  return (
    <Page
      wide
      title="Localizations"
      description="How each country, state, city and place is written and said where it is: its romanization, its local pronunciation (such as furigana) and its local script (such as hangeul or kanji). Countries, states and cities come from ALLPHOTOS.json, and places from the Places page. Each one is its own JSON file, combined into LOCALIZATIONS.json."
    >
      <GitHubGate>{() => <LocalizationTabs />}</GitHubGate>
    </Page>
  );
}

const TABS: { type: LocalizationType; title: string }[] = [
  { type: "country", title: "Countries" },
  { type: "state", title: "States" },
  { type: "city", title: "Cities" },
  { type: "place", title: "Places" },
];

/** Every country, city and place to localize, read from the combined lists and the place files. */
function useRows() {
  const read = useQuery(placesQuery);
  const combined = useCombinedData();
  const rows = localizationRows(
    shownPhotos(combined.data),
    readEntries(read.data && read.data.places),
    readEntries(read.data && read.data.localizations),
  );
  return { rows, pending: read.isPending || combined.isPending, error: firstError(read, combined) };
}

function firstError(...reads: { error: Error | null | undefined }[]): Error | undefined {
  return reads.find((read) => read.error)?.error ?? undefined;
}

/**
 * The rows' fields as typed, kept here so they survive switching tabs, and saving them: each Save,
 * or Save all, queues a save that runs once the ones before it are done.
 */
function useDrafts(rows: LocalizationRow[]) {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, Fields>>({});
  const save = useMutation({
    ...saveLocalizationMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "localizations", result),
  });
  const fieldsOf = (row: LocalizationRow) => drafts[row.id] ?? savedFields(row.saved);
  const changed = rows.filter((row) => isChanged(row, fieldsOf(row)));
  return {
    fieldsOf,
    changed,
    set: (row: LocalizationRow, fields: Fields) => setDrafts((d) => ({ ...d, [row.id]: fields })),
    save: (row: LocalizationRow, fields: Fields) => {
      // A row already queued or saving isn't queued again, as when Save all is pressed twice.
      if (isSaving(queryClient, row.id)) return;
      save.mutate({
        id: row.id,
        type: row.type,
        name: row.name,
        otherNames: row.saved?.otherNames,
        ...fields,
      });
    },
  };
}

type Drafts = ReturnType<typeof useDrafts>;

/** Whether a save of the localization `id` is queued or running. */
function isSaving(queryClient: QueryClient, id: string): boolean {
  const pending = queryClient.getMutationCache().findAll({
    mutationKey: saveLocalizationMutation.mutationKey,
    status: "pending",
  });
  return pending.some((m) => (m.state.variables as { id?: string } | undefined)?.id === id);
}

function LocalizationTabs() {
  const { rows, pending, error } = useRows();
  const drafts = useDrafts(rows);
  if (pending) return <p>Reading photos, places and localizations from GitHub…</p>;
  return (
    <>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
      <SaveAllButton drafts={drafts} />
      <Tabs defaultValue="country">
        <TabsList>
          {TABS.map(({ type, title }) => (
            <TabsTrigger key={type} value={type}>
              {title} ({rows.filter((row) => row.type === type).length})
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ type, title }) => (
          <TabsContent key={type} value={type}>
            <LocalizationCard
              type={type}
              title={title}
              rows={rows.filter((r) => r.type === type)}
              drafts={drafts}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

/**
 * Queues a save of every changed row, on every tab, at the top right next to the sync button.
 * The saves run one at a time, each its own commit.
 */
function SaveAllButton({ drafts }: { drafts: Drafts }) {
  const count = drafts.changed.length;
  const busy = useIsMutating({ mutationKey: ["localizations", "save"] });
  return (
    <FloatingAction>
      <Button
        className="h-9 rounded-full shadow-md"
        disabled={count === 0}
        onClick={() => drafts.changed.forEach((row) => drafts.save(row, drafts.fieldsOf(row)))}
      >
        {busy > 0 && <Spinner />}
        Save all{count > 0 && ` (${count})`}
      </Button>
    </FloatingAction>
  );
}

const DESCRIPTIONS: Record<LocalizationType, string> = {
  country:
    "Every country the photos show: the custom one written on the Photo page, or else the one from the EXIF.",
  state:
    "Every state, province or prefecture the photos show: the custom one written on the Photo page, or else the one from the EXIF.",
  city: "Every city the photos show: the custom one written on the Photo page, or else the one from the EXIF.",
  place: "Every place on the Places page.",
};

interface LocalizationCardProps {
  type: LocalizationType;
  title: string;
  rows: LocalizationRow[];
  drafts: Drafts;
}

function LocalizationCard({ type, title, rows, drafts }: LocalizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {DESCRIPTIONS[type]} Each saves as one commit in the photo data pull request; saves made
          while one runs wait their turn.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.length === 0 ? (
          <EmptyRows type={type} />
        ) : (
          rows.map((row) => (
            <LocalizationRowForm
              key={row.id}
              row={row}
              fields={drafts.fieldsOf(row)}
              onChange={(fields) => drafts.set(row, fields)}
              onSave={(fields) => drafts.save(row, fields)}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EmptyRows({ type }: { type: LocalizationType }) {
  if (type !== "place") {
    return <p className="text-muted-foreground text-sm">None of the photos list one yet.</p>;
  }
  return (
    <p className="text-muted-foreground text-sm">
      No places yet. Add them on the{" "}
      <Link to="/places" className="text-foreground underline underline-offset-4">
        Places
      </Link>{" "}
      page.
    </p>
  );
}
