# Quality Check

**Update Data → Quality Check** (`/update-data/quality-check`) looks for what should be fixed before a photo is
posted: a crop that isn't one of the house aspect ratios, license plates or faces that need pixelating, and a photo
without a place. A photo whose crop or pixelation fails can be flagged for [re-edit](replace-image.md#marking-a-photo-for-re-editing) with a
[photographer note](photo-notes.md) saying what failed.

At the top, **All photos** or **Draft photos** picks which photos both checks look at: every photo file from the
Gallery and Photos in Flight, with their local edits, or only the [drafts](drafts.md). Unselected photos are always
left out, since their images may be gone. It's the same list and the same choice as
[Autogroup](compare-groups.md#autogroup) (`autogroupPhotos` with nothing left out for being in a group).

## Aspect ratios

Every photo is cropped to **16:9** when it's wider than tall and **5:7** when it's taller than wide. **Check N
photos** measures each photo's Small version and lists the ones more than **1%** off their house ratio, which is room
for the Small version's size being rounded to whole pixels. A square photo is neither, so it's always listed. Each
row says the Small version's size, the ratio it is (a common crop such as 3:2 or 4:5, or else such as `1.62:1`) and
how far off it is, such as `640 × 427 (3:2), 15.7% off 16:9`. A photo whose Small version couldn't be read is listed
under the results by name.

This is plain code, not an LLM. `POST /api/photos/bucket/sizes` takes `{ urls }` and answers
`{ images: [{ url, width, height, error? }] }` in the same order. The backend (`internal/httpapi/imagesizes.go`) reads
each Small version from the [offline copy](offline-mode.md), downloading it from R2 first when it isn't kept yet,
8 at a time, and reads only the WEBP header for its size, so checking every photo is quick once they're kept. It
remembers each size by URL until the backend restarts; a remade version gets a new URL mark, so its size is read
again. Nothing is saved. The BFF waits up to 5 minutes for it ([BFF timeouts](bff-timeouts.md)).

The ratio rules are in `lib/aspect-ratio.ts` (`aspectProblem`, `checkAspectRatios`).

> **Frontend analogy:** it's `img.naturalWidth / img.naturalHeight` for every photo, done on the backend so the
> browser doesn't have to download hundreds of images. Reading only the header is like a `HEAD` request: the size is
> in the first few bytes of the file, so the pixels are never decoded.

## License plates and faces

The second check is a prompt, since finding a readable plate or a recognizable face needs eyes. It works like the
other [copied prompts](copy-prompts.md):

1. Optionally press **Make contact sheets**, so the prompt links a few numbered [contact sheets](contact-sheets.md)
   instead of making the LLM open every photo. The prompt asks it to open a photo's own link whenever a tile shows a
   car, a motorbike or people, since a plate or face too small to make out on a 240-pixel tile can still be readable.
2. **Copy the pixelation prompt** (or **Show the prompt**, which also covers plain HTTP) and paste it into a chat with
   an LLM. Each photo is listed by its JSON file's name with its Small version's link, its title, and whether some of it
   is pixelated already, so the LLM ignores the blocks of color there.
3. Paste its JSON answer back and press **Review the flagged photos**.

The prompt asks for only the photos to flag:

```json
{
  "photos": [
    {
      "photo": "20161216_092741",
      "pixelate": ["face", "license plate"],
      "reEdit": "Pixelate 2 faces and a license plate",
      "note": "The man at the café table on the left and the woman behind him face the camera; the white van's plate at the bottom right is readable."
    }
  ]
}
```

`reEdit` becomes the re-edit reason and `note` the photographer note, after `Quality Check (pixelation): `. An answer
that leaves either out gets one made from `pixelate`, such as "Pixelate face". Names that aren't photos in the
prompt are listed as left out, and a photo named twice is flagged once. The answer is read in the browser
(`readPixelationAnswer` in `lib/pixelation-prompt.ts`); nothing is sent to the backend.

Each flagged photo links to **Pixelate faces**: the Photo page's Image section (`/exif?edit=<path>&section=image`),
where the [face pixelation](face-pixelation.md) card hides faces and plates alike, since a box can go anywhere.

## Places

The **Places** section lists every chosen photo with no place row that has an ID, the same test Bulk Places and the
Dashboard's **Photos without a place** use, leaving out [casual photos](trip-lines.md#casual-photos), which only show
with their place on a Trip page. It needs no button: it's worked out in the browser from the photo data, with local
edits, so a photo given a place elsewhere drops off at once. Each row says why the photo has none, which says how to
give it one:

- **Has a GPS position**: [Bulk Places](update-data.md#bulk-places) can find its place. When any photo is like this,
  **Find places for N photos in Bulk Places** opens it.
- **Bulk Places' LLM found no place for it**: remembered in this browser ([No place found](update-data.md#no-place-found)),
  so Bulk Places doesn't pick it again.
- **No GPS position**, or **Marked as going without GPS**: add a position or a place on the Photo page.

Each row has **Open the photo**, and the list shows 30 until **Show all** is pressed. Nothing is flagged for re-edit
here, since a missing place is fixed in the data, not in Lightroom. The test is `missingPlaces` in
`lib/missing-places.ts`.

## Flagging photos that fail

The aspect ratio and pixelation checks list the photos that failed with their Small version uncropped, what failed, the re-edit reason and the
note they'll get, and a link to the Photo page. Every row starts ticked; **Flag N photos for re-edit** flags the
ticked ones as [local edits waiting for Commit](pending-changes.md), as Compare's choices are:

- `reEdit` is set with the reason, such as "Crop to 16:9", dated today. A photo already marked keeps its day, and its
  reason gets the new one after `; `, unless it already says it.
- `notes` gets the note after the ones it has, following a blank line, as Tag pruning adds them, such as
  `Quality Check (aspect ratio): the Small version is 640 × 427 (3:2), not the 16:9 crop for a landscape photo.`
  A note the photo has already isn't added again.

A photo that has both already shows **Flagged for re-edit** and can't be flagged twice. The flags show at once on the
Photo page and in Photos in Flight's **Re-edit** filter, and the next Commit saves them. The rules are in
`lib/quality-flags.ts`; the page is `components/quality-check/`.
