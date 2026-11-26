# Update Data

`/update-data`, under **Configuration** in the sidebar, holds bulk changes to the photo JSON on GitHub. Each one previews what it will change, then saves every changed file as a [change waiting for Commit](pending-changes.md), so one **Commit** sends them to the open **Add photo data** pull request (or opens one) together with `ALLPHOTOS.json` rebuilt.

Each bulk change has its own subpage, `/update-data/<name>` (such as `/update-data/image-names`), picked from a side navigation beside the card, each with its icon left of its name; on a phone the navigation is a dropdown above it. `/update-data` on its own opens the first, **Image base URL**, and the main sidebar keeps **Update Data** highlighted on every subpage. **Update Data** in the main sidebar also has a submenu of the same subpages, so hovering it opens any one directly. The list and each subpage's card are in `components/update-data/sections.tsx`, so a new bulk change is one entry there, in both navigations (`SectionsLayout` and `SectionNav` in `components/update-data/` draw the page and its navigation).

Update Data keeps the changes to the photo files as a whole: **Image base URL**, **Image names**, **Missing fields**, **Colors**, **Camera overrides**, **Localizations**, [**Times across timezones**](timezone-shift.md), [**EXIF in R2**](r2-exif.md), the one change that writes to the originals in R2 rather than the photo files, and [**Quality Check**](quality-check.md), which checks crops and asks an LLM about plates and faces, flagging the photos that fail for re-edit. The rest moved into the sidebar, next to what they change, working just as their parts below describe:

- The four tag changes, **Bulk tagging**, **Tag library**, **Tag pruning** and **Tag descriptions**, are the tag tools: each a page of its own (`/tag-tools/<name>`, `components/tag-tool-page.tsx`), listed in the **Tags** submenu under a small **Tools** header. Their list is `tagTools` in the same file. They used to share a Tag Data page with its own side navigation; an old `/tag-data` link opens Bulk tagging and `/tag-data/<name>` opens that tool.
- **Location Names** (`/location-names`) and **Bulk Places** (`/bulk-places`) are under **Places**, **Genre Suggestions** (`/genre-suggestions`) under **Genres**, and **Album Suggestions** (`/album-suggestions`) under **Albums**, each a page with just its card (`components/update-data/card-page.tsx`).

An old link to one of them, such as `/update-data/tag-library`, opens it where it is now (`movedSections`).

## Parts

Each part of Update Data has its own file in [`update-data/`](update-data):

- [Image base URL, Image names, Missing fields, Colors, Camera overrides and Location names](update-data/photo-files.md)
- [Bulk tagging](update-data/bulk-tagging.md)
- [Bulk places and photos with no place found](update-data/bulk-places.md)
- [Localizations](update-data/localizations.md)
- [Genre suggestions](update-data/genre-suggestions.md)
- [Tag library](update-data/tag-library.md)
- [Tag pruning](update-data/tag-pruning.md)
- [Tag descriptions](update-data/tag-descriptions.md)
- [Album suggestions](update-data/album-suggestions.md)
