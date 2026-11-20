/**
 * `servenup/reading-label`: a read's pending words start with "Reading" and name what's read, as
 * `QueryResult`'s `pendingLabel` and `ReadingNote`'s `label` do. It flags a `pendingLabel` or a
 * `ReadingNote` `label` that doesn't start with "Reading", and JSX text that starts with "Loading".
 */
import { classStrings, elementName, fileOf, UI_DIR } from "../helpers.mjs";

/** How loudly oxlint reports this rule. */
export const severity = "error";

/**
 * The attribute's text as written, or undefined when it isn't a string: a string's value, or a
 * template's opening text (`Reading ${plural}…` gives "Reading "). It reads the value the way
 * `classStrings` reads a className.
 */
function attributeText(value) {
  return classStrings(value)[0];
}

/** Whether the attribute is the pending words of a read: `pendingLabel`, or `label` on `ReadingNote`. */
function isReadingLabel(node) {
  if (node.name.name === "pendingLabel") return true;
  return node.name.name === "label" && elementName(node.parent) === "ReadingNote";
}

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Start a read's pending words with \"Reading\" and name what's read." },
    messages: {
      label: 'Start this with "Reading" and name what\'s read, such as "Reading the photo JSON…".',
      loading:
        'Show a read with QueryResult and a pendingLabel such as "Reading the photo JSON…", not "Loading".',
    },
  },
  create(context) {
    if (UI_DIR.test(fileOf(context))) return {};
    return {
      JSXAttribute(node) {
        if (!isReadingLabel(node)) return;
        const text = attributeText(node.value);
        if (text !== undefined && !text.startsWith("Reading"))
          context.report({ node, messageId: "label" });
      },
      JSXText(node) {
        if (/^\s*Loading\b/.test(node.value)) context.report({ node, messageId: "loading" });
      },
    };
  },
};
