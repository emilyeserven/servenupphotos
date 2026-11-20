---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Counting words

Write "1 photo, 3 photos" with `count(n, "photo")` from `@portfolio/lib/words` (`apps/portfolio/src/lib/words.ts`; `@/lib/words` inside the portfolio), passing the plural when it isn't the noun with an "s", such as `count(n, "person", "people")`. No local `plural` or `photoCount` helpers and no inline `n === 1 ? "photo" : "photos"`; `pnpm check:counts` fails on those. An inline `=== 1 ?` is still fine for a verb ("is" or "are") or for wording one differently from many ("the photo" or "3 photos").
