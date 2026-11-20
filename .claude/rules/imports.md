---
paths:
  - "apps/*/src/**"
  - "scripts/**"
---

# Imports

`pnpm fmt` sorts imports (`sortImports` in `.oxfmtrc.json`): packages first, then `@/` and `@portfolio/`, each in alphabetical order with no blank lines between. Add an import anywhere and run `pnpm fmt`; don't order them by hand. Two pull requests that add different imports to one file then land on different lines.
