import { PlusIcon } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { CaptionTemplate } from "@/api/captions";
import type { CombinedData } from "@/api/photos";
import { type FormExample, PlaceFormRow } from "@/components/caption-templates/place-form-row";
import { PlaceReplacements } from "@/components/caption-templates/place-replacements";
import { shuffled } from "@/components/caption-templates/placeholder-list";
import { photoLabel, previewPhotos } from "@/components/caption-templates/preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  NEW_FORM,
  type PlaceForm,
  type PlaceReplacement,
  pickPlaceForm,
  replacePlaces,
  withPlaceholder,
} from "@/lib/caption-place-form";
import {
  type CaptionValues,
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

/**
 * Each form's examples: the photos it's used for, with what it makes after the exceptions; the
 * place names before the exceptions, which each exception's count is from; and the photos none fits.
 */
function formExamples(
  forms: PlaceForm[],
  replacements: PlaceReplacement[],
  photos: ReturnType<typeof useExamplePhotos>,
) {
  const byForm: FormExample[][] = forms.map(() => []);
  const names: string[] = [];
  let unfit = 0;
  for (const { name, values } of photos) {
    const pick = pickPlaceForm(forms, values);
    if (!pick) {
      unfit++;
      continue;
    }
    names.push(pick.text);
    byForm[pick.index]?.push({ photo: name, text: replacePlaces(pick.text, replacements), values });
  }
  return { byForm, names, unfit };
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

/** The form text box last clicked, which a placeholder clicked goes in. */
interface FocusedForm {
  index: number;
  input: HTMLInputElement;
}

interface FormListProps {
  forms: PlaceForm[];
  /** Each form's examples. */
  byForm: FormExample[][];
  /** The values to draw a form no photo uses with. */
  fallback: CaptionValues;
  /** Notes the form text box last clicked. */
  lastFocused: React.RefObject<FocusedForm | null>;
  onChange: (forms: PlaceForm[]) => void;
}

/** The forms, each with its condition, text and what it makes, or a note when there are none. */
function FormList({ forms, byForm, fallback, lastFocused, onChange }: FormListProps) {
  const [shown, setShown] = useState<number[]>([]);
  const shuffle = (i: number) =>
    setShown((s) => Object.assign([...s], { [i]: shuffled(s[i] ?? 0, byForm[i]?.length ?? 0) }));
  const change = (i: number, form: PlaceForm) =>
    onChange(forms.map((f, j) => (j === i ? form : f)));
  const move = (i: number, by: -1 | 1) => {
    const next = [...forms];
    [next[i], next[i + by]] = [next[i + by]!, next[i]!];
    onChange(next);
  };
  if (forms.length === 0) return <EmptyNote>No forms yet. Add one to start.</EmptyNote>;
  return (
    <ol className="flex flex-col gap-2">
      {forms.map((form, i) => (
        <PlaceFormRow
          key={i}
          form={form}
          index={i}
          total={forms.length}
          examples={byForm[i] ?? []}
          fallback={fallback}
          shown={shown[i] ?? 0}
          onShuffle={() => shuffle(i)}
          onChange={(next) => change(i, next)}
          onMove={(by) => move(i, by)}
          onRemove={() => onChange(forms.filter((_, j) => j !== i))}
          onFocus={(input) => (lastFocused.current = { index: i, input })}
        />
      ))}
    </ol>
  );
}

/** How many photos no form fits, when there are any. */
function UnfitNote({ unfit }: { unfit: number }) {
  if (unfit === 0) return null;
  return (
    <span className="text-muted-foreground text-xs">
      {`No form fits ${count(unfit, "photo")}, so {from_places_form} is empty for them.`}
    </span>
  );
}

interface PlaceFormBuilderProps {
  forms: PlaceForm[];
  /** The exceptions, swapped into the place name the forms make. */
  replacements: PlaceReplacement[];
  /** The combined lists, for the photos the forms are tried on. */
  data: CombinedData;
  onChange: (
    part: Pick<CaptionTemplate, "places"> | Pick<CaptionTemplate, "placeReplacements">,
  ) => void;
}

/**
 * The template's **Place name builder**: forms for the place name, each with a condition on the
 * photo's fields, of which `{from_places_form}` is the first that fits the photo. Each form shows what it makes
 * for one of the photos it's used for, with Shuffle for another.
 */
export function PlaceFormBuilder({
  forms,
  replacements,
  data,
  onChange: set,
}: PlaceFormBuilderProps) {
  const photos = useExamplePhotos(data);
  const { byForm, names, unfit } = useMemo(
    () => formExamples(forms, replacements, photos),
    [forms, replacements, photos],
  );
  const onChange = (places: PlaceForm[]) => set({ places });
  const lastFocused = useRef<FocusedForm | null>(null);
  const insert = (placeholder: string) => {
    const at = lastFocused.current;
    const cursor = at && { start: at.input.selectionStart, end: at.input.selectionEnd };
    onChange(withPlaceholder(forms, { index: at?.index ?? null, ...cursor }, placeholder));
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Place name builder</CardTitle>
        <CardDescription>
          Put {"{from_places_form}"} in the template for the place name these forms make. A photo
          gets the first form that fits it: its condition met, and every placeholder outside square
          brackets filled. Click a field under a form to make the form need it, click again to make
          it need it empty, and again to leave it out. So put {"{city}, {state}"} above {"{city}"}{" "}
          to name the state only when there is one. Click a placeholder to put it in the form you
          last clicked.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <BuilderPlaceholders onInsert={insert} />
        <FormList
          forms={forms}
          byForm={byForm}
          fallback={photos[0]?.values ?? {}}
          lastFocused={lastFocused}
          onChange={onChange}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => onChange([...forms, NEW_FORM])}>
            <PlusIcon />
            Add a form
          </Button>
          <UnfitNote unfit={forms.length > 0 ? unfit : 0} />
        </div>
        <PlaceReplacements
          replacements={replacements}
          names={names}
          onChange={(placeReplacements) => set({ placeReplacements })}
        />
      </CardContent>
    </Card>
  );
}
