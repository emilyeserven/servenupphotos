import type { CaptionTemplate } from "@/api/captions";
import { type CaptionValues, fillAll, fillCaption } from "@/lib/caption-template";

/** How many places an older place form is for: any number, or exactly none, one, two, or three or more. */
export type PlaceCount = "any" | "0" | "1" | "2" | "3+";

/** One form of a template's place name builder: the fields it needs and the text it makes. */
export interface PlaceForm {
  /** The fields the photo has to have a value for, such as `city` and `state`. */
  has?: string[];
  /** The fields the photo has to have no value for, such as `state`. */
  lacks?: string[];
  /**
   * How many places the photo has to have, from templates saved before `has` and `lacks`; read
   * as the same conditions on `place1` to `place3`, and saved as them.
   */
  when?: PlaceCount;
  /** The place name, with placeholders, such as `{city}, {state}`. */
  text: string;
}

/** The fields a form's condition can name, in the order the builder lists them. */
export const CONDITION_FIELDS = ["place1", "place2", "place3", "city", "state", "country"];

/** The `has` and `lacks` each older place count means, on the numbered places. */
const COUNT_CONDITIONS: Record<PlaceCount, Pick<PlaceForm, "has" | "lacks">> = {
  any: {},
  "0": { lacks: ["place1"] },
  "1": { has: ["place1"], lacks: ["place2"] },
  "2": { has: ["place2"], lacks: ["place3"] },
  "3+": { has: ["place3"] },
};

/** The form with an older place count turned into `has` and `lacks`, and empty lists left out. */
export function formConditions(form: PlaceForm): PlaceForm {
  const old = COUNT_CONDITIONS[form.when ?? "any"] ?? {};
  const has = [...new Set([...(old.has ?? []), ...(form.has ?? [])])];
  const lacks = [...new Set([...(old.lacks ?? []), ...(form.lacks ?? [])])];
  return {
    ...(has.length > 0 && { has }),
    ...(lacks.length > 0 && { lacks }),
    text: form.text,
  };
}

/** Whether the photo's values meet the form's condition: a value for each field it has, none for each it lacks. */
function conditionFits(form: PlaceForm, values: CaptionValues): boolean {
  const { has = [], lacks = [] } = formConditions(form);
  return has.every((name) => values[name]) && lacks.every((name) => !values[name]);
}

/** What a field is in the form's condition: needed, needed empty, or not part of it. */
export type ConditionState = "has" | "lacks" | "off";

/** The form with the field's part of its condition set to state, an older place count turned into fields. */
export function withCondition(form: PlaceForm, name: string, state: ConditionState): PlaceForm {
  const { has = [], lacks = [], text } = formConditions(form);
  const next = {
    has: [...has.filter((n) => n !== name), ...(state === "has" ? [name] : [])],
    lacks: [...lacks.filter((n) => n !== name), ...(state === "lacks" ? [name] : [])],
  };
  return formConditions({ ...next, text });
}

/** What the field is in the form's condition. */
export function conditionState(form: PlaceForm, name: string): ConditionState {
  const { has = [], lacks = [] } = formConditions(form);
  if (has.includes(name)) return "has";
  return lacks.includes(name) ? "lacks" : "off";
}

/** The form the builder uses for the values, and the place name it makes. */
export interface PlaceFormPick {
  /** The form's index among the template's forms. */
  index: number;
  text: string;
}

/** An exception of the place name builder: text in a place name it writes another way. */
export interface PlaceReplacement {
  /** The text as the place name has it, such as "United States of America". */
  from: string;
  /** What's written instead, such as "USA"; "" leaves it out. */
  to: string;
}

/** The text with each exception's text written its way, in order. */
export function replacePlaces(text: string, replacements: PlaceReplacement[] = []): string {
  return replacements.reduce((out, r) => (r.from ? out.replaceAll(r.from, r.to) : out), text);
}

/**
 * The first of the forms that fits the photo: its condition met, with every placeholder
 * outside square brackets filled, with the exceptions written their way. Null when none does.
 */
export function pickPlaceForm(
  forms: PlaceForm[],
  values: CaptionValues,
  replacements?: PlaceReplacement[],
): PlaceFormPick | null {
  for (const [index, form] of forms.entries()) {
    if (!conditionFits(form, values)) continue;
    const text = fillAll(form.text, values);
    if (text !== null) return { index, text: replacePlaces(text, replacements) };
  }
  return null;
}

/** The values with `{from_places_form}`: the place name the template's builder makes, or "". */
export function withPlaceForm(
  template: Pick<CaptionTemplate, "places" | "placeReplacements">,
  values: CaptionValues,
): CaptionValues {
  const pick = pickPlaceForm(template.places ?? [], values, template.placeReplacements);
  return { ...values, from_places_form: pick?.text ?? "" };
}

/** The caption the template makes from the values, its place name builder's place name included. */
export function fillTemplate(
  template: Pick<CaptionTemplate, "template" | "places" | "placeReplacements">,
  values: CaptionValues,
): string {
  return fillCaption(template.template, withPlaceForm(template, values));
}

/** A new form: for any photo, the first place written each way it can be. */
export const NEW_FORM: PlaceForm = { text: "{place1Localized}" };

/** The form a placeholder goes in, by index, and where its cursor is; null parts when unknown. */
export interface FormCursor {
  index: number | null;
  start?: number | null;
  end?: number | null;
}

/**
 * The forms with the placeholder put in the one at the cursor, over what's selected there; or
 * else at the end of the last form; or else in a new form when there are none.
 */
export function withPlaceholder(
  forms: PlaceForm[],
  cursor: FormCursor,
  placeholder: string,
): PlaceForm[] {
  if (forms.length === 0) return [{ ...NEW_FORM, text: placeholder }];
  const at =
    cursor.index !== null && cursor.index < forms.length ? cursor : { index: forms.length - 1 };
  return forms.map((form, i) => {
    if (i !== at.index) return form;
    const start = at.start ?? form.text.length;
    const text = form.text.slice(0, start) + placeholder + form.text.slice(at.end ?? start);
    return { ...form, text };
  });
}
