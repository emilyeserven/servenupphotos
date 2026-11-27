import { type FillableTemplate, fillTemplate } from "@/lib/caption-place-form";
import { plainCaption } from "@/lib/caption-styles";
import type { CaptionValues } from "@/lib/caption-template";
import { withoutHiddenLines } from "@/lib/photo-book-hidden";

/** How a book photo's `hidden` names its caption's first line, the photo's title. */
const TITLE_LINE = "line:0";

/**
 * Whether the caption the template fills in for these values starts with a title: its first line
 * with text, `{title}` in the starter template, isn't left out for being empty.
 */
export function templateHasTitle(template: FillableTemplate, values: CaptionValues): boolean {
  const first = template.template.split("\n").find((line) => line.trim() !== "");
  if (first === undefined) return false;
  return fillTemplate({ ...template, template: first }, values) !== "";
}

/**
 * The caption with no title: its first line left blank, so every line is drawn alike as caption
 * text, not the first one as a bold title; "" stays "".
 */
export function untitledCaption(caption: string): string {
  const text = caption.replace(/^(\s*\n)+/, "");
  return text === "" ? "" : `\n${text}`;
}

/** A caption's title and the lines under it, as a book page draws them. */
export interface CaptionLines {
  /** Its first line, drawn bold; "" when the caption has no title. */
  title: string;
  /** Its lines after the title, without the blank ones before them. */
  rest: string;
}

/**
 * The caption's title, its first line, and the lines after it. A caption whose first line is blank
 * and that has other lines has no title, so all its lines are drawn alike.
 */
export function titleAndRest(caption: string): CaptionLines {
  const [title = "", ...rest] = caption.split("\n");
  return {
    title: title.trim() === "" ? "" : title,
    rest: rest.join("\n").replace(/^(\s*\n)+/, ""),
  };
}

/** The caption's first line with text, without style marks, to name it; "" when it has none. */
export function firstLine(caption: string): string {
  return plainCaption(caption).trim().split("\n")[0] ?? "";
}

/** What a book needs to know to draw a template caption's title, or leave it off. */
export interface TitleSettings {
  /** Whether the template's caption for the photo starts with its title (see templateHasTitle). */
  titled: boolean;
  /** The parts and lines hidden for the photo in the book. */
  hidden: string[] | undefined;
  /** True when the book's captions have no titles, its **Caption titles** off. */
  noCaptionTitles: boolean | undefined;
}

/**
 * The template's caption as the book prints it: without the lines hidden for its photo, and with no
 * title (see untitledCaption) when it had none, when its title line is hidden for the photo, or
 * when the book's captions have no titles, which leaves the title line off too.
 */
export function bookCaption(filled: string, settings: TitleSettings): string {
  const { titled, noCaptionTitles } = settings;
  const hidden =
    titled && noCaptionTitles ? [...(settings.hidden ?? []), TITLE_LINE] : settings.hidden;
  const shown = withoutHiddenLines(filled, hidden);
  return titled && !hidden?.includes(TITLE_LINE) ? shown : untitledCaption(shown);
}
