---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/portfolio/src/**"
---

# Empty states

A list, grid or panel with nothing in it shows `EmptyNote` (`apps/portfolio/src/components/empty-note.tsx`, imported as `@portfolio/components/empty-note` in both apps), never a hand-styled `<p>`. It has one look (muted, small); its `className` is for spacing only. Say what's missing in a full sentence ("No albums yet.", not "None yet."), then what to do next when there is something to do. A photo list that filters or search leave empty says `NO_PHOTOS_MATCH` ("No photos match these filters."). The `servenup/empty-note` lint rule flags a muted `<p>` that starts "No", "None" or "Nothing".
