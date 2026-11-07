import { type FormEvent, useState } from "react";
import { type Localization, localizationId } from "@/api/places";
import { FieldLabel } from "@/components/field-label";
import { FloatingSaveButton } from "@/components/floating-save-button";
import { LocalizationFields, useLocalizationDraft } from "@/components/localization-fields";
import { RegionIcon } from "@/components/region-icon";
import type { RegionListData } from "@/components/region-list";
import { NO_WHERE, type RegionWhere, RegionWhereFields } from "@/components/region-where-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { winningName } from "@/lib/location-names";
import { regionNodeKey } from "@/lib/region-tree";

/** A country, state or city that can be added on the Places page. */
export type AddedRegionKind = "country" | "state" | "city";

/** Each kind's title, and how to fill in its name. */
const KINDS = {
  country: { title: "New country", help: "Such as South Korea, written the way photos write it." },
  state: {
    title: "New state",
    help: "A state, province or prefecture, such as Gyeonggi or Hokkaido, between a city and its country.",
  },
  city: { title: "New city", help: "Such as Suwon, written the way photos write it." },
};

/** The state and country the localization keeps, by kind: a city's both, a state's country, a country's none. */
function whereOf(kind: AddedRegionKind, where: RegionWhere): Partial<Localization> {
  if (kind === "country") return {};
  const country = where.country.trim();
  return kind === "city" ? { state: where.state.trim(), country } : { country };
}

/** Why the name can't be added: it's empty, or that kind is already listed with that name. */
function nameProblem(kind: AddedRegionKind, name: string, list: RegionListData) {
  const key = regionNodeKey(kind, winningName(list.names, kind, name.trim()));
  if (!key) return "Write its name.";
  const found = list.nodes.find((node) => node.key === key);
  return found ? `${found.name} is already listed. Choose it in the list to edit it.` : undefined;
}

interface RegionAdderProps {
  kind: AddedRegionKind;
  folder: string;
  list: RegionListData;
  /** Called with the new row's key once it's saved. */
  onAdded: (key: string) => void;
}

/** The new country's, state's or city's fields as typed, why they can't be added, and adding it. */
function useRegionAdder(
  kind: AddedRegionKind,
  list: RegionListData,
  onAdded: (key: string) => void,
) {
  const [name, setName] = useState("");
  const [where, setWhere] = useState(NO_WHERE);
  const draft = useLocalizationDraft(undefined);
  const problem = nameProblem(kind, name, list);
  const id = localizationId(kind, name.trim());
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    const added = name.trim();
    draft.saveAs({ id, type: kind, name: added }, whereOf(kind, where), () =>
      onAdded(regionNodeKey(kind, added)),
    );
  };
  const busy = draft.save.isPending;
  // Why it can't be added shows once a name is typed; why saving failed shows until it's typed again.
  const message = draft.save.error?.message ?? (name ? problem : undefined);
  return {
    name,
    setName,
    where,
    setWhere,
    draft,
    id,
    submit,
    busy,
    blocked: Boolean(problem),
    message,
  };
}

type RegionAdderForm = ReturnType<typeof useRegionAdder>;

/**
 * A form for a new country, state or city, before any photo or place has it. It's saved as its
 * localization, with where it is, so the Places list and the City, State and Country fields show it.
 */
export function RegionAdder({ kind, folder, list, onAdded }: RegionAdderProps) {
  const form = useRegionAdder(kind, list, onAdded);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RegionIcon kind={kind} />
          {KINDS[kind].title}
        </CardTitle>
        <CardDescription>
          Saves it as <code className="break-all">{`${folder}/localizations/${form.id}.json`}</code>
          , so it's listed here and offered on places and photos before any of them has it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form id="region-adder-form" className="flex flex-col gap-4" onSubmit={form.submit}>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="region-adder-name" help={KINDS[kind].help}>
              Name
            </FieldLabel>
            <Input
              id="region-adder-name"
              value={form.name}
              disabled={form.busy}
              onChange={(event) => form.setName(event.target.value)}
            />
          </div>
          <WhereFields kind={kind} form={form} />
          <LocalizationFields
            draft={form.draft}
            idPrefix="region-adder-localization"
            disabled={form.busy}
          />
          <AdderButtons kind={kind} form={form} />
        </form>
      </CardContent>
    </Card>
  );
}

/** Where a new city or state is; nothing for a country. */
function WhereFields({ kind, form }: { kind: AddedRegionKind; form: RegionAdderForm }) {
  if (kind === "country") return null;
  return (
    <RegionWhereFields
      kind={kind}
      value={form.where}
      disabled={form.busy}
      onChange={form.setWhere}
    />
  );
}

/** Why it can't be added or saving failed, and the buttons that add it. */
function AdderButtons({ kind, form }: { kind: AddedRegionKind; form: RegionAdderForm }) {
  const disabled = form.blocked || form.busy;
  return (
    <>
      {form.message && <p className="text-destructive text-sm">{form.message}</p>}
      <FloatingSaveButton form="region-adder-form" disabled={disabled} busy={form.busy} />
      <div>
        <Button type="submit" disabled={disabled}>
          {form.busy && <Spinner />}
          Add {kind}
        </Button>
      </div>
    </>
  );
}
