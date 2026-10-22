import type { Localization, LocalizationType } from "@/api/places";
import { localizationId } from "@/api/places";
import {
  type LocalizationDraft,
  LocalizationFields,
  useLocalizationDraft,
} from "@/components/localization-fields";
import { FloatingSaveButton } from "@/components/floating-save-button";
import { RegionIcon } from "@/components/region-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { CityRow, CountryRow } from "@/lib/place-cities";
import type { RegionNode } from "@/lib/region-tree";

/** The count with its noun, such as "1 place" or "3 places". */
function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** What's known about a city or country: where it is, and how many cities, places and photos have it. */
function regionSummary(node: RegionNode): string {
  const region = node.region as Partial<CityRow & CountryRow>;
  const parts = [
    region.country ? `In ${region.country}` : undefined,
    region.cities === undefined ? undefined : counted(region.cities, "city"),
    counted(region.places ?? 0, "place"),
    counted(node.photos, "photo"),
  ];
  return parts.filter(Boolean).join(" · ");
}

interface RegionEditorProps {
  node: RegionNode;
  saved: Localization | undefined;
}

/**
 * A country or city in the edit panel: what's known about it, and its localization. Its name comes
 * from the photos and places that have it, so it's changed there.
 */
export function RegionEditor({ node, saved }: RegionEditorProps) {
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
        <RegionLocalizationForm node={node} saved={saved} />
      </CardContent>
    </Card>
  );
}

/** The country's or city's localization fields, and a button to save them. */
function RegionLocalizationForm({ node, saved }: RegionEditorProps) {
  const draft = useLocalizationDraft(saved);
  const type = node.kind as LocalizationType;
  const { save } = draft;
  return (
    <form
      id="region-editor-form"
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        draft.saveAs({ id: localizationId(type, node.name), type, name: node.name });
      }}
    >
      <LocalizationFields
        draft={draft}
        idPrefix={`${node.kind}-localization`}
        disabled={save.isPending}
      />
      <SaveStatus draft={draft} />
      <FloatingSaveButton
        form="region-editor-form"
        disabled={!draft.changed || save.isPending}
        busy={save.isPending}
      />
      <div>
        <Button type="submit" disabled={!draft.changed || save.isPending}>
          {save.isPending && <Spinner />}
          Save localization
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
