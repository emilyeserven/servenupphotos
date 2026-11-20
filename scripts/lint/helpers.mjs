/**
 * What the repository's own oxlint rules (`scripts/lint/rules/`) share: reading a JSX element's
 * name and class names, and the paths a rule leaves alone.
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
export function classStrings(node) {
  const parts = node && CLASS_PARTS[node.type];
  return parts ? parts(node) : [];
}

/** The JSX element's name as written, such as `p`, `CardTitle` or `XIcon`. */
export function elementName(node) {
  const name = node.name;
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") return name.property.name;
  return "";
}

/** The path of the file a rule is looking at. */
export function fileOf(context) {
  return context.filename ?? context.getFilename();
}

/** shadcn/ui's generated components, which every rule leaves alone. */
export const UI_DIR = /components[\\/]ui[\\/]/;
