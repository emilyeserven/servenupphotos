// The shape every backend route follows, checked by `pnpm check fixtures` (scripts/checks/fixtures.mjs).
// The rules, with examples, are in the add-pipeline-endpoint skill (.claude/skills/add-pipeline-endpoint/SKILL.md).

/** A literal path segment: lowercase words joined by hyphens, such as `contact-sheets`. */
const LITERAL_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A path parameter: a lowerCamelCase name in braces, such as `{id}` or `{day}`. */
const PARAM_SEGMENT = /^\{[a-z][a-zA-Z0-9]*\}$/;

/**
 * Words that say what the method already says, so they never end a path: saving is `PUT`,
 * deleting is `DELETE` and reading is `GET`, such as `DELETE /photos/bucket` rather than
 * `POST /photos/bucket/delete`.
 */
const METHOD_WORDS = new Set([
  "add",
  "create",
  "delete",
  "get",
  "list",
  "remove",
  "save",
  "set",
  "update",
  "write",
]);

/**
 * Steps that come before a change and only read: `pick` chooses the photos to send to an LLM and
 * `preview` shows what the change would do. Each is a `POST` next to the `POST` that makes the
 * change, at the same path without the step, such as `POST /data/alt-text/preview` and
 * `POST /data/alt-text`.
 */
const STEP_WORDS = new Set(["pick", "preview"]);

/**
 * The rules one path segment can break, in the order they're checked: whether the segment breaks
 * the rule, and the sentence saying how.
 */
const SEGMENT_RULES = [
  [(segment) => segment === "api", () => "has /api in it, which the BFF strips; leave it out"],
  [
    (segment) => METHOD_WORDS.has(segment),
    (segment) => `has "${segment}" in its path; say it with the method`,
  ],
  [
    (segment) => segment.startsWith("{") && !PARAM_SEGMENT.test(segment),
    (segment) => `names the parameter ${segment}; use lowerCamelCase`,
  ],
  [
    (segment) => !segment.startsWith("{") && !LITERAL_SEGMENT.test(segment),
    (segment) => `has the segment "${segment}"; use lowercase words joined by hyphens`,
  ],
];

/** What is wrong with one segment of a route's path, or "" when it's fine. */
function segmentProblem(segment) {
  const rule = SEGMENT_RULES.find(([breaks]) => breaks(segment));
  return rule ? rule[1](segment) : "";
}

/** What is wrong with a `pick` or `preview` step, given every route, or "" when it's fine. */
function stepProblem(method, segments, routes) {
  const step = segments.at(-1);
  if (!STEP_WORDS.has(step)) return "";
  if (method !== "POST") return `is a ${step} step, which is a POST`;
  const change = `POST /${segments.slice(0, -1).join("/")}`;
  return routes.includes(change) ? "" : `is a ${step} step with no ${change} to make the change`;
}

/**
 * Every way the routes break the route shape rules, one sentence each, such as
 * `POST /photos/bucket/delete has "delete" in its path; say it with the method`. Empty when
 * every route follows them. Each route is a `METHOD /path` pattern as the Go backend registers it.
 */
export function routeShapeProblems(routes) {
  return routes.flatMap((route) => {
    const [method, path] = route.split(" ");
    const segments = path.split("/").slice(1);
    const problems = [...segments.map(segmentProblem), stepProblem(method, segments, routes)];
    return problems.filter(Boolean).map((problem) => `${route} ${problem}`);
  });
}
