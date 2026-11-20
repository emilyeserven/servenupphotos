/**
 * `servenup/empty-note`: an empty list, grid or panel is shown with `EmptyNote`
 * (`apps/portfolio/src/components/empty-note.tsx`), never as a hand-styled muted paragraph. It
 * flags a `<p>` with `text-muted-foreground` whose text starts "No …", "None" or "Nothing".
 */
import { classStrings, elementName, fileOf, UI_DIR } from "../helpers.mjs";

/** How loudly oxlint reports this rule. */
export const severity = "error";

/** Whether the text reads like an empty state: "No albums yet.", "None yet.", "Nothing to commit.". */
function readsEmpty(text) {
  return /^(No|None|Nothing)\b/.test(text.trim());
}

/** The element's first child with words in it, read as text when it is plain JSX text. */
function firstWords(element) {
  const child = element.children.find((c) => c.type !== "JSXText" || c.value.trim());
  return child?.type === "JSXText" ? child.value : "";
}

/** Whether the opening tag has a className holding `text-muted-foreground`. */
function isMuted(opening) {
  const attr = opening.attributes.find(
    (a) => a.type === "JSXAttribute" && a.name.name === "className",
  );
  return attr
    ? classStrings(attr.value).some((s) => s.split(/\s+/).includes("text-muted-foreground"))
    : false;
}

const EMPTY_NOTE_FILE = /components[\\/]empty-note\.tsx$/;

export default {
  meta: {
    type: "suggestion",
    docs: {
      description: "Show empty states with EmptyNote instead of a hand-styled muted paragraph.",
    },
    messages: {
      paragraph:
        "Show this empty state with <EmptyNote> from @portfolio/components/empty-note instead of a muted <p>.",
    },
  },
  create(context) {
    const file = fileOf(context);
    if (EMPTY_NOTE_FILE.test(file) || UI_DIR.test(file)) return {};
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "p" || !isMuted(node.openingElement)) return;
        if (readsEmpty(firstWords(node))) context.report({ node, messageId: "paragraph" });
      },
    };
  },
};
