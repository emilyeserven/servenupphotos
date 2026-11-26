---
paths:
  - "apps/client-pipeline/src/**"
---

# Keep files small

`instagram-calendar.tsx` is already over 500 lines. The Gallery's and the photo editor's parts live in `components/gallery/` and `components/edit-in-flight/`; a page whose file grew too big keeps its parts in a folder of the same name beside it, as `organize-page/`, `group-detail/`, `thumbnail-crop/` and `place-fields/` do. Put new UI in a new component file and import it, rather than growing them.
