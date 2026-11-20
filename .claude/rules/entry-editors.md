---
paths:
  - "apps/client-pipeline/src/**"
---

# Entry editors

A page that edits one JSON file per entry (camera overrides, custom lenses, metadata groups, …) ends its editor with `EntryEditorButtons` (`components/entry-buttons.tsx`), passing the save and remove `mutationOptions`, `next`, `saved` and a `whyNot` function, rather than its own Save and Remove buttons. An Update Data card's preview uses `ScanPreviewBody` and `SaveButton` from `components/update-data-shared.tsx`.
