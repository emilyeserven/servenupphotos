import type { CaptionTemplate } from "@/api/captions";
import { type CaptionValues, fillAll, fillCaption } from "@/lib/caption-template";

/** How many places a place form is for: any number, or exactly none, one, two, or three or more. */
export type PlaceCount = "any" | "0" | "1" | "2" | "3+";

/** One form of a template's place name builder: the places it's for, and the text it makes. */
export interface PlaceForm {
  /** How many places the photo has to have for this form. */
  when: PlaceCount;
  /** The place name, with placeholders, such as `{city}, {state}`. */
  text: string;
}

/** What each place count is called in the builder. */
export const PLACE_COUNTS: [PlaceCount, string][] = [
  ["any", "Any number of places"],
  ["0", "No places"],
  ["1", "1 place"],
  ["2", "2 places"],
  ["3+", "3 or more places"],
];

/** Whether a photo with count places fits when. */
function countFits(when: PlaceCount, count: number): boolean {
  if (when === "any") return true;
  if (when === "3+") return count >= 3;
  return count === Number(when);
}

/** The form the builder uses for the values, and the place name it makes. */
export interface PlaceFormPick {
  /** The form's index among the template's forms. */
  index: number;
  text: string;
}

/**
 * The first of the forms that fits the photo: for its number of places, with every placeholder
 * outside square brackets filled. Null when none does.
 */
export function pickPlaceForm(forms: PlaceForm[], values: CaptionValues): PlaceFormPick | null {
  const count = Number(values.placeCount ?? 0);
  for (const [index, form] of forms.entries()) {
    if (!countFits(form.when, count)) continue;
    const text = fillAll(form.text, values);
    if (text !== null) return { index, text };
  }
  return null;
}

/** The values with `{from_places_form}`: the place name the template's builder makes, or "". */
export function withPlaceForm(
  template: Pick<CaptionTemplate, "places">,
  values: CaptionValues,
): CaptionValues {
  return { ...values, from_places_form: pickPlaceForm(template.places ?? [], values)?.text ?? "" };
}

/** The caption the template makes from the values, its place name builder's place name included. */
export function fillTemplate(
  template: Pick<CaptionTemplate, "template" | "places">,
  values: CaptionValues,
): string {
  return fillCaption(template.template, withPlaceForm(template, values));
}

/** A new form: for any number of places, the first place written each way it can be. */
export const NEW_FORM: PlaceForm = { when: "any", text: "{place1Localized}" };

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
