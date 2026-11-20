---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Small value and date helpers

Both apps share `apps/portfolio/src/lib/values.ts` (`isObject`, `textOf` for trimmed text or "", `stringOf` for text as written or "", `clamp`) and `apps/portfolio/src/lib/dates.ts` (`isoDate`, `parseIsoDate`, `shortDate` "Nov 3, 2026", `weekdayDate` "Tue, Nov 3, 2026", `dateTimeText` for a moment such as an upload time). Import them (`@portfolio/lib/…` from the pipeline) instead of writing a local copy, and add a new date look to `dates.ts` rather than building an `Intl.DateTimeFormat` or a `date-fns` `format` in a component.
