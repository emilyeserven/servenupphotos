---
paths:
  - "scripts/lint/**"
  - "oxlint.config.ts"
---

# Lint rules

One of the repository's own oxlint rules is one file, `scripts/lint/rules/<rule-name>.mjs`: its default export is the rule, its `severity` export is `"warn"` or `"error"`, and the comment at its top says what it flags and what it leaves alone. The file name is the rule's name, so `error-note.mjs` is `servenup/error-note`. The plugin (`scripts/lint/servenup-plugin.mjs`) and `oxlint.config.ts` read that folder, so adding a rule never edits either. What rules share goes in `scripts/lint/helpers.mjs`.
