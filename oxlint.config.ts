import { defineConfig } from "oxlint";
import { ruleFiles } from "./scripts/lint/load-rules.mjs";

/**
 * The repository's own rules (`scripts/lint/rules/<name>.mjs`), each turned on as `servenup/<name>`
 * at the severity its file exports. Adding a rule file is all it takes to turn a rule on.
 */
const ownRules = Object.fromEntries(
  Object.entries(ruleFiles).map(([name, file]) => [`servenup/${name}`, file.severity]),
);

export default defineConfig({
  plugins: ["typescript", "react", "import", "unicorn", "oxc"],
  jsPlugins: ["./scripts/lint/servenup-plugin.mjs"],
  categories: {
    correctness: "error",
    suspicious: "warn",
  },
  rules: {
    "react/react-in-jsx-scope": "off",
    "import/no-unassigned-import": [
      "warn",
      {
        allow: ["**/*.css"],
      },
    ],
    "no-alert": "error",
    // A function passed as a prop that returns JSX (`tile={(photo) => <Tile … />}`) is a render
    // prop the child calls, not a component React mounts, so it can't remount anything.
    "react/no-unstable-nested-components": ["warn", { allowAsProps: true }],
    ...ownRules,
  },
  ignorePatterns: ["**/dist/**", "**/routeTree.gen.ts"],
  overrides: [
    {
      files: ["apps/client-pipeline/src/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                name: "@/lib/pasted-json",
                importNames: ["parsePastedJson"],
                message:
                  "Read a pasted LLM answer with readPastedObject or readPastedList, so every answer box finds the JSON and says the same thing when it can't (.claude/rules/pasted-llm-answers.md).",
              },
            ],
          },
        ],
      },
    },
    {
      // shadcn/ui's generated components, which aren't edited by hand.
      files: ["**/components/ui/**"],
      rules: {
        "no-underscore-dangle": "off",
      },
    },
    {
      files: [
        "apps/client-pipeline/src/api/viewer-likes.ts",
        "apps/client-pipeline/src/lib/pasted-json.test.ts",
      ],
      rules: {
        "no-restricted-imports": "off",
      },
    },
  ],
});
