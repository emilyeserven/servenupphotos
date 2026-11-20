---
paths:
  - "apps/client-pipeline/src/**"
---

# Keep files small

`in-flight.tsx`, `instagram-calendar.tsx`, `organize-page.tsx` and `group-detail.tsx` are already near 600 to 700 lines. The Gallery's and the photo editor's parts live in `components/gallery/` and `components/edit-in-flight/`. Put new UI in a new component file and import it, rather than growing them.
