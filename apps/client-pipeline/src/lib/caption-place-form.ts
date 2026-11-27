import type { CaptionTemplate } from "@/api/captions";
import { keepTogether } from "@/lib/caption-keep-together";
import { type CaptionValues, fillAll, fillCaption } from "@/lib/caption-template";
import { withStateAbbreviations } from "@/lib/us-states";

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
  /**
   * More lines under it, such as the romanized names under the local ones. Each is left out for a
   * photo when a placeholder in it outside square brackets is empty, or when it reads the same as
   * a line above it.
   */
  more?: string[];
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

/** The fields in either list, each once, in the order they first come. */
function union(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

/** The form with an older place count turned into `has` and `lacks`, and empty lists left out. */
export function formConditions(form: PlaceForm): PlaceForm {
  const old = COUNT_CONDITIONS[form.when ?? "any"] ?? {};
  const has = union(old.has, form.has);
  const lacks = union(old.lacks, form.lacks);
  return {
    ...(has.length > 0 && { has }),
    ...(lacks.length > 0 && { lacks }),
    text: form.text,
    ...(form.more?.some((line) => line.trim()) && { more: form.more }),
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
  const { has = [], lacks = [], ...rest } = formConditions(form);
  const next = {
    has: [...has.filter((n) => n !== name), ...(state === "has" ? [name] : [])],
    lacks: [...lacks.filter((n) => n !== name), ...(state === "lacks" ? [name] : [])],
  };
  return formConditions({ ...rest, ...next });
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
    const text = fillForm(form, values, replacements);
    if (text !== null) return { index, text };
  }
  return null;
}

/** A line of a place name in lower case with its spaces evened out. */
function plain(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Whether two lines of a place name read the same, ignoring case and spaces. */
function sameText(a: string, b: string): boolean {
  return plain(a) === plain(b);
}

/** The form's lines: its first, then the ones under it. */
export function formLines(form: PlaceForm): string[] {
  return [form.text, ...(form.more ?? [])];
}

/** The form with line i (0 for the first) set to text. */
export function withLine(form: PlaceForm, i: number, text: string): PlaceForm {
  if (i === 0) return { ...form, text };
  return { ...form, more: (form.more ?? []).map((line, j) => (j === i - 1 ? text : line)) };
}

/**
 * Each of the form's lines as filled in for the values, with the exceptions written their way, or
 * null when it's left out: the first when a placeholder in it outside square brackets is empty,
 * and one under it for that too, or when it reads the same as a line above it.
 */
export function filledLines(
  form: PlaceForm,
  values: CaptionValues,
  replacements?: PlaceReplacement[],
): (string | null)[] {
  const shown: string[] = [];
  return formLines(form).map((line) => {
    const filled = line.trim() ? fillAll(line, values) : null;
    const text = filled === null ? null : replacePlaces(filled, replacements);
    if (text === null || shown.some((above) => sameText(above, text))) return null;
    shown.push(text);
    return text;
  });
}

/** The place name the form makes: its lines that show, one under another; null when the first doesn't fill in. */
function fillForm(
  form: PlaceForm,
  values: CaptionValues,
  replacements?: PlaceReplacement[],
): string | null {
  const lines = filledLines(form, values, replacements);
  if (lines[0] === null) return null;
  return lines.filter((line) => line !== null).join("\n");
}

/** The values with `{from_places_form}`: the place name the template's builder makes, or "". */
function withPlaceForm(
  template: Pick<CaptionTemplate, "places" | "placeReplacements">,
  values: CaptionValues,
): CaptionValues {
  const pick = pickPlaceForm(template.places ?? [], values, template.placeReplacements);
  return { ...values, from_places_form: pick?.text ?? "" };
}

/** What of a template fills a caption in: its text, place name builder, state abbreviations and values kept together. */
export type FillableTemplate = Pick<
  CaptionTemplate,
  "template" | "places" | "placeReplacements" | "noBreak" | "stateAbbreviations"
>;

/**
 * The values the template fills in: US states abbreviated when it says to, and
 * `{from_places_form}`, its place name builder's place name.
 */
export function templateValues(
  template: Omit<FillableTemplate, "template" | "noBreak">,
  values: CaptionValues,
): CaptionValues {
  return withPlaceForm(
    template,
    template.stateAbbreviations ? withStateAbbreviations(values) : values,
  );
}

/**
 * The caption the template makes from the values, its place name builder's place name included,
 * with its parts marked Keep together and its values that never break kept on one line.
 */
export function fillTemplate(template: FillableTemplate, values: CaptionValues): string {
  return keepTogether(
    fillCaption(template.template, templateValues(template, values)),
    template.noBreak,
  );
}

/** A new form: for any photo, the first place written each way it can be. */
export const NEW_FORM: PlaceForm = { text: "{place1Localized}" };

/** The form a placeholder goes in, by index, and where its cursor is; null parts when unknown. */
export interface FormCursor {
  index: number | null;
  /** Which line of the form, 0 for the first. */
  line?: number;
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
    const line = "line" in at ? (at.line ?? 0) : 0;
    const old = formLines(form)[line] ?? "";
    const start = at.start ?? old.length;
    return withLine(form, line, old.slice(0, start) + placeholder + old.slice(at.end ?? start));
  });
}
