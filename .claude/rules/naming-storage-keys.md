---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Storage keys

Storage keys are kebab-case with the app's prefix: `pipeline-…` in the pipeline, `servenup-…` in the portfolio. A new stored value uses `storedValue` (`@portfolio/lib/stored-value`). Renaming a key calls `moveStoredKey(old, new)` beside it so the browser keeps what it saved.
