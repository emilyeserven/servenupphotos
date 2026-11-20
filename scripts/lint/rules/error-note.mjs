/**
 * `servenup/error-note`: a failure in the pipeline is shown with `ErrorNote`
 * (`apps/client-pipeline/src/components/error-note.tsx`), never as a hand-written red paragraph. It
 * flags a bare `text-destructive` class on a JSX element and an `{… .error.message}` or
 * `{error.message}` written straight into JSX. Icons, shadcn/ui and `hover:`-style variants are
 * left alone; anything else that is red on purpose and isn't an error takes an
 * `oxlint-disable-next-line servenup/error-note` comment saying why.
 */
import { classStrings, elementName, fileOf, UI_DIR } from "../helpers.mjs";

/** How loudly oxlint reports this rule. */
export const severity = "error";

/** Whether the string holds `text-destructive` as a class of its own, with no `hover:`-style variant. */
function hasBareDestructive(text) {
  return text.split(/\s+/).includes("text-destructive");
}

/** The expression inside an optional chain (`a?.b`), or the expression itself. */
function unchained(node) {
  return node?.type === "ChainExpression" ? node.expression : node;
}

/** Whether the node names something ending in "error", such as `error`, `readError` or `save.error`. */
function namesError(node) {
  const name = node.type === "MemberExpression" ? node.property.name : node.name;
  return /error$/i.test(name ?? "");
}

/** Whether the expression reads `.message` off something named `error` (`error.message`, `save.error.message`). */
function isErrorMessage(expression) {
  const node = unchained(expression);
  if (node?.type !== "MemberExpression" || node.property.name !== "message") return false;
  return namesError(unchained(node.object));
}

const ERROR_NOTE_FILE = /components[\\/]error-note\.tsx$/;

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Show failures with ErrorNote instead of a hand-written red paragraph." },
    messages: {
      className:
        "Show this failure with <ErrorNote error={…} /> from @/components/error-note instead of text-destructive.",
      message:
        "Show this failure with <ErrorNote error={…} /> from @/components/error-note instead of writing .error.message into JSX.",
    },
  },
  create(context) {
    const file = fileOf(context);
    if (ERROR_NOTE_FILE.test(file) || UI_DIR.test(file)) return {};
    return {
      JSXAttribute(node) {
        if (node.name.name !== "className") return;
        const name = elementName(node.parent);
        if (name.endsWith("Icon")) return;
        if (classStrings(node.value).some(hasBareDestructive))
          context.report({ node, messageId: "className" });
      },
      JSXExpressionContainer(node) {
        if (node.parent?.type === "JSXAttribute") return;
        if (isErrorMessage(node.expression)) context.report({ node, messageId: "message" });
      },
    };
  },
};
