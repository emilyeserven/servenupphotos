/**
 * The repository's own oxlint rules, loaded through `jsPlugins` in `.oxlintrc.json`.
 *
 * `servenup/error-note`: a failure in the pipeline is shown with `ErrorNote`
 * (`apps/client-pipeline/src/components/error-note.tsx`), never as a hand-written red paragraph. It
 * flags a bare `text-destructive` class on a JSX element and an `{… .error.message}` or
 * `{error.message}` written straight into JSX. Icons, shadcn/ui and `hover:`-style variants are
 * left alone; anything else that is red on purpose and isn't an error takes an
 * `oxlint-disable-next-line servenup/error-note` comment saying why.
 *
 * `servenup/empty-note`: an empty list, grid or panel is shown with `EmptyNote`
 * (`apps/portfolio/src/components/empty-note.tsx`), never as a hand-styled muted paragraph. It
 * flags a `<p>` with `text-muted-foreground` whose text starts "No …", "None" or "Nothing".
 */

/** How to find the class strings inside each kind of className value. */
const CLASS_PARTS = {
  Literal: (node) => (typeof node.value === "string" ? [node.value] : []),
  TemplateLiteral: (node) => node.quasis.map((q) => q.value.cooked ?? ""),
  JSXExpressionContainer: (node) => classStrings(node.expression),
  CallExpression: (node) => node.arguments.flatMap(classStrings),
  ConditionalExpression: (node) => [
    ...classStrings(node.consequent),
    ...classStrings(node.alternate),
  ],
  LogicalExpression: (node) => classStrings(node.right),
  ObjectExpression: (node) => node.properties.flatMap((p) => classStrings(p.key)),
};

/** The class names in a className value, whether a string, a template or a cn() call's strings. */
function classStrings(node) {
  const parts = node && CLASS_PARTS[node.type];
  return parts ? parts(node) : [];
}

/** Whether the string holds `text-destructive` as a class of its own, with no `hover:`-style variant. */
function hasBareDestructive(text) {
  return text.split(/\s+/).includes("text-destructive");
}

/** The JSX element's name as written, such as `p`, `CardTitle` or `XIcon`. */
function elementName(node) {
  const name = node.name;
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return name.property.name;
  return "";
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
const UI_DIR = /components[\\/]ui[\\/]/;

const errorNote = {
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
    const file = context.filename ?? context.getFilename();
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

const emptyNote = {
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
    const file = context.filename ?? context.getFilename();
    if (EMPTY_NOTE_FILE.test(file) || UI_DIR.test(file)) return {};
    return {
      JSXElement(node) {
        if (elementName(node.openingElement) !== "p" || !isMuted(node.openingElement)) return;
        if (readsEmpty(firstWords(node))) context.report({ node, messageId: "paragraph" });
      },
    };
  },
};

export default {
  meta: { name: "servenup" },
  rules: { "error-note": errorNote, "empty-note": emptyNote },
};
