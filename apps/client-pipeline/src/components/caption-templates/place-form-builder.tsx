import { PlusIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { CombinedData } from "@/api/photos";
import { type FormExample, PlaceFormRow } from "@/components/caption-templates/place-form-row";
import { shuffled } from "@/components/caption-templates/placeholder-list";
import { photoLabel, previewPhotos } from "@/components/caption-templates/preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NEW_FORM, type PlaceForm, pickPlaceForm, withPlaceholder } from "@/lib/caption-place-form";
import {
  PLACE_FORM_PLACEHOLDERS,
  PLACEHOLDERS,
  captionLists,
  captionValues,
} from "@/lib/caption-template";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/** The first names of the placeholders about places, which the builder lists. */
const PLACE_GROUPS = ["places", "place", "mainPlace", "city", "state", "country"];

/** Every placeholder the builder offers: the place ones, then the numbered places. */
const BUILDER_NAMES = [
  ...PLACEHOLDERS.filter((p) => PLACE_GROUPS.includes(p.names[0] ?? "")),
  ...PLACE_FORM_PLACEHOLDERS,
].flatMap((p) => p.names);

/** Each of the portfolio's photos by name, with its caption values. */
function useExamplePhotos(data: CombinedData) {
  return useMemo(() => {
    const lists = captionLists(data);
    return previewPhotos(data).map((photo, i) => ({
      name: photoLabel(photo, i),
      values: captionValues(photo, lists),
    }));
  }, [data]);
}

/** Each form's examples: the photos it's used for, with what it makes; and the photos none fits. */
function formExamples(forms: PlaceForm[], photos: ReturnType<typeof useExamplePhotos>) {
  const byForm: FormExample[][] = forms.map(() => []);
  let unfit = 0;
  for (const { name, values } of photos) {
    const pick = pickPlaceForm(forms, values);
    if (pick) byForm[pick.index]?.push({ photo: name, text: pick.text });
    else unfit++;
  }
  return { byForm, unfit };
}

/** The placeholders a form can use, each a button that puts it in the form last clicked. */
function BuilderPlaceholders({ onInsert }: { onInsert: (placeholder: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {BUILDER_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono text-xs"
          onClick={() => onInsert(`{${name}}`)}
        >
          {`{${name}}`}
        </button>
      ))}
    </div>
  );
}

interface PlaceFormBuilderProps {
  forms: PlaceForm[];
  /** The combined lists, for the photos the forms are tried on. */
  data: CombinedData;
  onChange: (forms: PlaceForm[]) => void;
}

/**
 * The template's **Place name builder**: forms for the place name, each for a number of places,
 * of which `{from_places_form}` is the first that fits the photo. Each form shows what it makes
 * for one of the photos it's used for, with Shuffle for another.
 */
export function PlaceFormBuilder({ forms, data, onChange }: PlaceFormBuilderProps) {
  const photos = useExamplePhotos(data);
  const { byForm, unfit } = useMemo(() => formExamples(forms, photos), [forms, photos]);
  const [shown, setShown] = useState<number[]>([]);
  const focused = useRef<{ index: number; input: HTMLInputElement } | null>(null);
  const change = (i: number, form: PlaceForm) =>
    onChange(forms.map((f, j) => (j === i ? form : f)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...forms];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };
  const insert = (placeholder: string) => {
    const at = focused.current;
    const cursor = at && { start: at.input.selectionStart, end: at.input.selectionEnd };
    onChange(withPlaceholder(forms, { index: at?.index ?? null, ...cursor }, placeholder));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Place name builder</CardTitle>
        <CardDescription>
          Put {"{from_places_form}"} in the template for the place name these forms make. A photo
          gets the first form that fits it: one for its number of places, with every placeholder
          outside square brackets filled. So put {"{city}, {state}"} above {"{city}"} to name the
          state only when there is one. Click a placeholder to put it in the form you last clicked.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <BuilderPlaceholders onInsert={insert} />
        {forms.length === 0 ? (
          <EmptyNote>No forms yet. Add one to start.</EmptyNote>
        ) : (
          <ol className="flex flex-col gap-2">
            {forms.map((form, i) => (
              <PlaceFormRow
                key={i}
                form={form}
                index={i}
                total={forms.length}
                examples={byForm[i] ?? []}
                shown={shown[i] ?? 0}
                onShuffle={() =>
                  setShown((s) =>
                    Object.assign([...s], { [i]: shuffled(s[i] ?? 0, byForm[i]?.length ?? 0) }),
                  )
                }
                onChange={(next) => change(i, next)}
                onMove={(by) => move(i, by)}
                onRemove={() => onChange(forms.filter((_, j) => j !== i))}
                onFocus={(input) => (focused.current = { index: i, input })}
              />
            ))}
          </ol>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => onChange([...forms, NEW_FORM])}>
            <PlusIcon />
            Add a form
          </Button>
          {forms.length > 0 && unfit > 0 && (
            <span className="text-muted-foreground text-xs">
              {`No form fits ${count(unfit, "photo")}, so {from_places_form} is empty for them.`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
