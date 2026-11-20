---
paths:
  - "apps/client-pipeline/src/**"
---

# Errors

Show every failure with `ErrorNote` (`components/error-note.tsx`): pass it the `Error` (or a sentence written for the page) and it shows the message in red with `role="alert"`, plus GitHub's answer when a GitHub call failed. `QueryResult`, `SaveNote` and `SaveState` already use it. Don't write `text-destructive` or `{x.error.message}` into JSX; the `servenup/error-note` lint rule (`scripts/lint/servenup-plugin.mjs`) flags both. Red that isn't an error (an icon, a removed count) takes an `oxlint-disable-next-line servenup/error-note` comment saying why.
