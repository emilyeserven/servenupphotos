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
 * `servenup/reading-label`: a read's pending words start with "Reading" and name what's read, as
 * `QueryResult`'s `pendingLabel` and `ReadingNote`'s `label` do. It flags a `pendingLabel` or a
 * `ReadingNote` `label` that doesn't start with "Reading", and JSX text that starts with "Loading".
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

const readingLabel = {
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
    const file = context.filename ?? context.getFilename();
    if (UI_DIR.test(file)) return {};
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

export default {
  meta: { name: "servenup" },
  rules: { "error-note": errorNote, "reading-label": readingLabel },
};
