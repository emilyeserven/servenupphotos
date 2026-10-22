import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  cacheSavedEntry,
  type Localization,
  type LocalizationType,
  placesQuery,
  readEntries,
  saveLocalizationMutation,
} from "@/api/places";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LocalizationRow, localizationRows, shownPhotos } from "@/lib/place-seeds";
import { useCombinedData } from "@/stores/combined-data";

/** The Localizations page: how each country, city and place is written and said where it is. */
export function LocalizationsPage() {
  return (
    <Page
      wide
      title="Localizations"
      description="How each country, city and place is written and said where it is: its romanization, its local pronunciation (such as furigana) and its local script (such as hangeul or kanji). Countries and cities come from ALLPHOTOS.json, and places from the Places page. Each one is its own JSON file, combined into LOCALIZATIONS.json."
    >
      <GitHubGate>{() => <LocalizationTabs />}</GitHubGate>
    </Page>
  );
}

const TABS: { type: LocalizationType; title: string }[] = [
  { type: "country", title: "Countries" },
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

function LocalizationTabs() {
  const { rows, pending, error } = useRows();
  if (pending) return <p>Reading photos, places and localizations from GitHub…</p>;
  return (
    <>
      {error && <p className="text-destructive text-sm">{error.message}</p>}
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
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  );
}

const DESCRIPTIONS: Record<LocalizationType, string> = {
  country:
    "Every country the photos show: the custom one written on the Photo page, or else the one from the EXIF.",
  city: "Every city the photos show: the custom one written on the Photo page, or else the one from the EXIF.",
  place: "Every place on the Places page.",
};

interface LocalizationCardProps {
  type: LocalizationType;
  title: string;
  rows: LocalizationRow[];
}

function LocalizationCard({ type, title, rows }: LocalizationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {DESCRIPTIONS[type]} Each saves as one commit in the photo data pull request.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col divide-y">
        {rows.length === 0 ? (
          <EmptyRows type={type} />
        ) : (
          rows.map((row) => <LocalizationRowForm key={row.id} row={row} />)
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

/** The three fields a localization notes, as the JSON names them, with their labels and examples. */
const FIELDS = [
  { key: "romanization", label: "Romanization", example: "Gyeongbokgung" },
  { key: "pronunciation", label: "Local pronunciation", example: "Such as きょうと" },
  { key: "localScript", label: "Local script", example: "Such as 경복궁 or 京都" },
] as const;

type Fields = Pick<Localization, (typeof FIELDS)[number]["key"]>;

function savedFields(saved: Localization | undefined): Fields {
  return Object.fromEntries(FIELDS.map(({ key }) => [key, saved?.[key] ?? ""])) as Fields;
}

function sameFields(a: Fields, b: Fields): boolean {
  return FIELDS.every(({ key }) => a[key].trim() === b[key].trim());
}

/** One country, city or place, with its three fields and a button to save them. */
function LocalizationRowForm({ row }: { row: LocalizationRow }) {
  const queryClient = useQueryClient();
  const [fields, setFields] = useState(() => savedFields(row.saved));
  const save = useMutation({
    ...saveLocalizationMutation,
    onSuccess: (result) => cacheSavedEntry(queryClient, "localizations", result),
  });
  const changed = !sameFields(fields, savedFields(row.saved));
  return (
    <form
      className="grid gap-3 py-4 first:pt-0 last:pb-0 lg:grid-cols-[minmax(10rem,1fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({ id: row.id, type: row.type, name: row.name, ...fields });
      }}
    >
      <RowName row={row} />
      {FIELDS.map((field) => (
        <FieldInput
          key={field.key}
          id={`${row.id}-${field.key}`}
          field={field}
          value={fields[field.key]}
          disabled={save.isPending}
          onChange={(value) => {
            save.reset();
            setFields((f) => ({ ...f, [field.key]: value }));
          }}
        />
      ))}
      <SaveButton changed={changed} save={save} />
      <SaveError error={save.error} />
    </form>
  );
}

interface SaveButtonProps {
  changed: boolean;
  save: { isPending: boolean; isSuccess: boolean };
}

/** Saves the row once it's changed, and says Saved after. */
function SaveButton({ changed, save }: SaveButtonProps) {
  return (
    <Button type="submit" variant="outline" disabled={!changed || save.isPending}>
      {save.isPending && <Spinner />}
      {saveLabel(changed, save.isSuccess)}
    </Button>
  );
}

/** "Saved" once the row is saved and not changed since, or else "Save". */
function saveLabel(changed: boolean, saved: boolean): string {
  return saved && !changed ? "Saved" : "Save";
}

function SaveError({ error }: { error: Error | null }) {
  return error && <p className="text-destructive text-sm lg:col-span-5">{error.message}</p>;
}

interface FieldInputProps {
  id: string;
  field: (typeof FIELDS)[number];
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

function FieldInput({ id, field, value, disabled, onChange }: FieldInputProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted-foreground text-xs">
        {field.label}
      </label>
      <Input
        id={id}
        placeholder={field.example}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function RowName({ row }: { row: LocalizationRow }) {
  const photos = `${row.photos} photo${row.photos === 1 ? "" : "s"}`;
  return (
    <div className="min-w-0 self-center">
      <div className="truncate font-medium">{row.name}</div>
      <div className="text-muted-foreground truncate text-xs">
        {[row.detail, photos, row.saved ? undefined : "not saved yet"].filter(Boolean).join(" · ")}
      </div>
    </div>
  );
}
