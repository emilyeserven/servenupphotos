---
paths:
  - "apps/client-pipeline/src/**"
---

# Loading

Show every read with `QueryResult` (`components/query-result.tsx`): it takes a TanStack Query result or a hook shaped like one (`useCombinedData`, `useSessionData`), shows `pendingLabel` while pending, `ErrorNote` when it fails, and the data once it's there. The label starts with "Reading" and names the thing ("Reading the photo JSON…", "Reading settings…"), never "Loading…". Where a page shows what it could read beside an error, so `QueryResult` doesn't fit, use its `ReadingNote` for the pending words. `Skeleton` is only for photo tiles (a grid of Square Thumbnails, Photos in Flight's placeholders); `Spinner` is only inside a button or beside an action the user started, never for a read. The `servenup/reading-label` lint rule flags a label that doesn't start with "Reading" and JSX text starting with "Loading".
