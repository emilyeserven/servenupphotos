import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import type { Localization, LocalizationType } from "@/api/places";
import { localizationId } from "@/api/places";
import {
  type LocalizationDraft,
  LocalizationFields,
  useLocalizationDraft,
} from "@/components/localization-fields";
import { FloatingSaveButton } from "@/components/floating-save-button";
import { OtherNamesField } from "@/components/other-names-field";
import { RegionIcon } from "@/components/region-icon";
import type { RegionListData } from "@/components/region-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { type RegionType, unrenamedCounts } from "@/lib/location-names";
import type { CityRow, CountryRow } from "@/lib/place-cities";
import type { RegionNode } from "@/lib/region-tree";

/** The count with its noun, such as "1 place" or "3 places". */
function counted(count: number, noun: string, plural = `${noun}s`): string {
  return `${count} ${count === 1 ? noun : plural}`;
}

/** What's known about a city or country: where it is, and how many cities, places and photos have it. */
function regionSummary(node: RegionNode): string {
  const region = node.region as Partial<CityRow & CountryRow>;
  const parts = [
    region.country ? `In ${region.country}` : undefined,
    region.cities === undefined ? undefined : counted(region.cities, "city", "cities"),
    counted(region.places ?? 0, "place"),
    counted(node.photos, "photo"),
  ];
  return parts.filter(Boolean).join(" · ");
}

interface RegionEditorProps {
  node: RegionNode;
  saved: Localization | undefined;
  list: RegionListData;
}

/**
 * A country or city in the edit panel: what's known about it, its other names and its
 * localization. Its name comes from the photos and places that have it, so it's changed there, or
 * made another name of one that wins.
 */
export function RegionEditor({ node, saved, list }: RegionEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RegionIcon kind={node.kind} />
          {node.name}
        </CardTitle>
        <CardDescription>{regionSummary(node)}</CardDescription>
      </CardHeader>
      <CardContent>
        <RegionLocalizationForm node={node} saved={saved} list={list} />
      </CardContent>
    </Card>
  );
}

/** Whether two lists of names are the same, in the same order. */
function sameNames(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((name, i) => name === b[i]);
}

/** The country's or city's other names as picked, whether they differ from the saved ones, and setting them. */
function useOtherNames(saved: Localization | undefined, draft: LocalizationDraft) {
  const before = saved?.otherNames ?? [];
  const [names, setNames] = useState(before);
  const set = (next: string[]) => {
    draft.save.reset();
    setNames(next);
  };
  return { names, set, changed: !sameNames(names, before) };
}

/** The country's or city's localization and other names as typed, and saving them. */
function useRegionForm(node: RegionNode, saved: Localization | undefined) {
  const draft = useLocalizationDraft(saved);
  const other = useOtherNames(saved, draft);
  const type = node.kind as LocalizationType;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const target = { id: localizationId(type, node.name), type, name: node.name };
    draft.saveAs(target, { otherNames: other.names });
  };
  return { draft, other, changed: draft.changed || other.changed, submit };
}

/** The country's or city's other names and localization fields, and a button to save them. */
function RegionLocalizationForm({ node, saved, list }: RegionEditorProps) {
  const { draft, other, changed, submit } = useRegionForm(node, saved);
  const { save } = draft;
  return (
    <form id="region-editor-form" className="flex flex-col gap-4" onSubmit={submit}>
      <OtherNamesField
        node={node}
        list={list}
        value={other.names}
        disabled={save.isPending}
        onChange={other.set}
      />
      <UnrenamedNote node={node} list={list} />
      <LocalizationFields
        draft={draft}
        idPrefix={`${node.kind}-localization`}
        disabled={save.isPending}
      />
      <SaveStatus draft={draft} />
      <FloatingSaveButton
        form="region-editor-form"
        disabled={!changed || save.isPending}
        busy={save.isPending}
      />
      <div>
        <Button type="submit" disabled={!changed || save.isPending}>
          {save.isPending && <Spinner />}
          Save changes
        </Button>
      </div>
    </form>
  );
}

/** Why saving failed, or that it saved, until something else is typed. */
function SaveStatus({ draft }: { draft: LocalizationDraft }) {
  const { save } = draft;
  if (save.error) return <p className="text-destructive text-sm">{save.error.message}</p>;
  return save.isSuccess ? <p className="text-sm">Saved to the photo data pull request.</p> : null;
}

/** Such as "3 photos and 1 place", leaving out a zero. */
function stillWriting(left: { photos: number; places: number }): string {
  const parts = [
    [left.photos, "photo"],
    [left.places, "place"],
  ] as const;
  return parts
    .filter(([n]) => n > 0)
    .map(([n, noun]) => counted(n, noun))
    .join(" and ");
}

/**
 * How many photos and places still write one of the saved other names, until Update Data's
 * Location names rewrites them; nothing when none do.
 */
function UnrenamedNote({ node, list }: { node: RegionNode; list: RegionListData }) {
  const left = unrenamedCounts(
    list.photos,
    list.places,
    list.names,
    node.kind as RegionType,
    node.name,
  );
  if (left.photos + left.places === 0) return null;
  return (
    <p className="text-muted-foreground text-sm">
      {stillWriting(left)} still write another name, and are counted as {node.name} here.{" "}
      <Link
        to="/update-data/$section"
        params={{ section: "location-names" }}
        className="text-foreground underline underline-offset-4"
      >
        Rewrite them in Update Data
      </Link>
      .
    </p>
  );
}
