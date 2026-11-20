/**
 * The repository's own oxlint plugin, loaded through `jsPlugins` in `oxlint.config.ts`. Its rules
 * are the files in `scripts/lint/rules/`.
 */
import { ruleFiles } from "./load-rules.mjs";

export default {
  meta: { name: "servenup" },
  rules: Object.fromEntries(Object.entries(ruleFiles).map(([name, file]) => [name, file.default])),
};
