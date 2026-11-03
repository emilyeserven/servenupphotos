# Photographer notes

Each photo file can have `notes`: plain text only for the photographer, such as what a photo shows that isn't a tag,
or an idea for it. The portfolio never shows them.

**Writing them.** The Photo page (`/exif`, and editing a photo in flight or from the Gallery) has a **Photographer
notes** box under **Comment** in the **Title and comment** card (`components/photo-notes-field.tsx`), saved as the
JSON's `"notes"` (`null` when empty) with the rest of the photo's details. [Tag library and Tag
pruning](update-data.md#tag-library) add notes too, after any already there, following a blank line: when a tag is
removed or isn't made because fewer than 3 photos would have it, the LLM writes a note on each photo saying which tag
it was, what it described and why it isn't a tag. The Tag library's prompt shows the LLM each photo's notes as well.

**Keeping them private.** The field is in every new photo file (`newPhotoJSON`, so Update Data → **Missing fields**
adds `"notes": null` to older ones) and in `ALLPHOTOS.json`, which the pipeline reads. The portfolio's Vite config has
a `private-photo-notes` plugin (`apps/portfolio/private-notes.ts`) that takes `notes` off every photo in
`ALLPHOTOS.json` and `ALLPHOTOS.local.json` as they're imported, before they become a module, so the notes never reach
the built site or the dev server's pages, and `lib/photos.ts` doesn't read them. They are still in the photo files and
`ALLPHOTOS.json` in the repository, so anyone who can read the repository can read them.

> **Frontend analogy:** it's like a `data-testid` or a dev-only prop: it lives in the source, but a build step strips
> it before anything ships to the browser.
