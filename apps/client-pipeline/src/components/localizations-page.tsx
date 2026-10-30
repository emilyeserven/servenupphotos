import { useIsMutating } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { LocalizationType } from "@/api/places";
import { FloatingAction } from "@/components/floating-actions";
import {
  type LocalizationDrafts as Drafts,
  useLocalizationDrafts,
  useLocalizationRows,
} from "@/components/localization-drafts";
import { LocalizationRowForms } from "@/components/localization-row";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { LocalizationRow } from "@/lib/place-seeds";

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

function LocalizationTabs() {
  const { rows, pending, error } = useLocalizationRows();
  const drafts = useLocalizationDrafts(rows);
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
        onClick={drafts.saveAll}
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
          <LocalizationRowForms rows={rows} drafts={drafts} />
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
