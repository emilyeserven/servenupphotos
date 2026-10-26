# Update Data

`/update-data`, under Configuration in the sidebar, holds bulk changes to the photo JSON on GitHub. Each one
previews what it will change, then saves every changed file as a [change waiting for Commit](pending-changes.md),
so one **Commit** sends them to the open **Add photo data** pull request (or opens one) together with `ALLPHOTOS.json`
rebuilt.

**Image base URL** moves every image URL in the photo files from one base URL to another, such as from R2's public
development URL (`https://pub-….r2.dev`) to a custom domain. It reads every photo JSON file in the photos folder
(except `ALLPHOTOS.json`) as the next Commit will have it, and lists the
origins their image URLs use (`POST /api/data/image-base-url/preview` with empty `from` and `to`). Previewing a change
lists each URL under `images` that starts with `from` (followed by nothing, `/`, `?` or `#`), with its new value
(`POST /data/image-base-url/preview`); applying it (`POST /data/image-base-url`) rewrites only those strings, keeping
the rest of each URL (query strings such as `?crop=` included) and every other byte of the file as it was. Nothing is
saved while any photo file can't be read. The images in R2 aren't touched, so connect the custom domain to the
bucket in Cloudflare first, and set the R2 **Public URL** in Settings to it so new uploads use it too.

**Missing fields** gives older photo files the fields new ones have, such as `title`, `comment`, `aperture` or
`images.thumbnail` (`POST /api/data/missing-fields/preview`, then `POST /api/data/missing-fields`). The list of fields
and their defaults is `newPhotoJSON` in `be-pipeline/internal/github/publish.go`, the same function that builds a new
photo file, so a field added there (with its default, such as `[]` for a list) is backfilled with no other change.
A missing `id` isn't a default: each file gets the next photo ID, counting up from the highest ID any photo file has, in
the order the files were created: when each was first committed on the branch the next Commit goes to (one GraphQL
query asks every file's history, 50 files at a time), or, for a file only in the pending changes, when it was saved.
Files created in the same commit go by file name. See [Photo IDs](data-model.md#photo-ids).
A missing `addedDate` isn't a default either: from the same history, each file that isn't a [draft](drafts.md) gets
the time of the commit that first added it (or, only in the pending changes, when it was saved), and a draft gets
`null`, to be dated when it gets a title. See [Date added](data-model.md#date-added).
Missing fields go where a new file has them, nested `images` fields included, and the rest of each file is kept byte
for byte; a field a file already has, even `null`, is never changed. With **Read missing camera details from the
originals in R2** on, a missing EXIF field (`exif.SanitizeFields`) is read from the photo's original at `images.key`,
as Explore Bucket reads it, instead of being added as `null`; the backend keeps each original's EXIF in memory, so
applying doesn't download them again after a preview. A missing `images.thumbnailcrop` is read from the `?crop=x,y,size`
on `images.thumbnail` when it has one, or, with that option on, from the crop saved with the Square Thumbnail in R2.

**Colors** reads each photo's colors from its original in R2 (at `images.key`) and saves them as the file's `colors`
(`POST /api/data/colors/preview`, then `POST /api/data/colors`). It's the summary the EXIF page's Colors tab shows
(`colors.Summary` in `be-pipeline/internal/colors`): the average color, the 12 hue buckets, the neutrals' lightness
histogram, the mean lightness and chroma, and `peakChroma`, the chroma the most vivid tenth of the pixels reach. The
Raw color data tab's statistics aren't saved. Only files without `colors` (or with `null`), or whose `colors` were
saved before `peakChroma` was added, are read, unless **Read the
colors of photos that already have them again** is on, such as after replacing photos' images. Each original is
downloaded and decoded, four at a time, so a first run over every photo takes a few minutes; the backend keeps each
original's colors in memory, so applying doesn't download them again after a preview. A photo whose original can't
be read, or that has no `images.key`, is listed with why and left as it is, and the rest are still saved. Only
`colors` is rewritten, and nothing is saved while any photo file can't be read. New photos get `colors` when they're
saved, so this is for older ones and for recomputing.

**Camera overrides** applies the [camera overrides](camera-overrides.md) to every photo file again, after they've
changed (`POST /api/data/camera-overrides/preview`, then `POST /api/data/camera-overrides`). Each file starts from its
EXIF values (its own, with the ones its `exifOriginals` kept laid over them), so renaming a camera again, or removing a
rule, reaches photos an older rule already changed; a field no rule sets any more goes back to its EXIF value. Each
photo's [custom lens](custom-lenses.md) is applied after the rules, so it's kept, and a changed lens reaches its photos. Only the
changed top-level fields are rewritten, and nothing is saved while any photo file can't be read.

**Location names** writes every country and city that's another name of one, such as `"United States"` for
`"United States of America"`, as the name that wins, in the photo files' `country`, `city`, `customCountry` and
`customCity` and the place files' `country` and `city` (`POST /api/data/location-names/preview`, then
`POST /api/data/location-names`). The other names are picked on the Places page; see
[Other names](places-and-localizations.md#other-names).

## Bulk tagging

**Bulk tagging** tags up to five related photos with one LLM prompt. **Pick photos** (`POST /api/data/bulk-tags/pick`)
reads every photo file as the next Commit will have it and only considers photos without tags (an empty or missing
`tags`), so a photo that already has tags is never picked. It picks the first of those by path, then up to four that
share the most with it: each shared [place](places-and-localizations.md) counts 5, the same
city 3 (or else the same country 1), each shared [genre](photographic-genres.md) 2, and being taken the same day 3
(or else the same month 1), using the hand-written city, country and date over the EXIF ones. Photos that share
nothing aren't picked. Each card says what it shares with the
first photo. **Pick other photos** sends the photos already shown as `skip`, so the next pick leaves them out;
**Start over** picks from every photo again.

**Copy the tag prompt** (`lib/bulk-tag-prompt.ts`) copies one prompt for all of them: each photo by its file name
(without `.json`), with a link to its Small version, what's known of where it was taken, and the tags it already has,
then the same rules, existing tags and **Already filtered** list as one photo's [tag prompt](albums-and-tags.md#suggest-tags)
(`TAG_RULES` and `tagListsSection` in `lib/tag-prompt.ts`), asking for 3 to 8 new tags each and for the answer as
JSON:

```json
{
  "photos": [{ "photo": "20161216_092741", "tags": ["shotengai", "lanterns"] }],
  "definitions": [
    { "tag": "shotengai", "definition": "a Japanese shopping street", "parent": "covered-street" }
  ]
}
```

Paste the answer and **Review the tags** (`POST /api/data/bulk-tags/preview`, which saves nothing). The backend reads
the JSON object in it (from the first `{` to the last `}`, so a code block or words around it are fine) and sorts
each photo's names as pasting into a Tags field does (`github/bulktags_answer.go`): a name matching a tag's ID or name
(ignoring case, or by the ID made from it) is that tag; one an album, genre or metadata group has, or with nothing to
make an ID from, is left out saying why; the rest are new tags in lowercase kebab-case, with their definitions as
descriptions. A parent that isn't a tag yet is made too, before the tag under it. Photos the answer names that weren't
picked are listed and left out.

The review lists the new tags, each with a checkbox and one for its parent, then each photo with a checkbox per tag
to add, marking the new ones, and the tags it already had. **Save tags for N photos** (`POST /api/data/bulk-tags`)
makes the ticked new tags, parents first, and adds the ticked tags to each photo's `tags` after the ones it has, all
in one save of [changes waiting for Commit](pending-changes.md). Each new tag is checked as **New tag** on `/tags`
checks it, and nothing is saved when one can't be made or a photo can't be read. Once saved, the list of new tags is hidden, since they're made.

> **Frontend analogy:** it's the single-photo paste flow batched: a "dry run" mutation that returns a diff for the
> user to edit (like a form's preview step), then one mutation that commits the edited diff.

**Progress.** While **Missing fields** or **Colors** reads (its preview, or saving), the card says what it's doing and
how far it has got, with a bar once it can count: reading the photo files from GitHub (one query, so no count),
asking GitHub when the files were created (50 files a query, only files not asked before), then reading the originals in R2,
such as "Reading each photo's colors from its original in R2: 42 of 150". The backend keeps each task's latest progress
in memory (`github.WithProgress`, kept by `readProgress` in `be-pipeline/internal/httpapi/progress.go`), and the page
asks `GET /api/data/progress/{task}` (`missing-fields` or `colors`) every half second until the read answers.

> **Frontend analogy:** the progress is polled, like a `useQuery` with `refetchInterval: 500` next to the slow
> request, rather than streamed. The slow request stays an ordinary JSON answer; a second, cheap endpoint just reads a
> variable the first one keeps updating.

> **Frontend analogy:** it's a codemod for your data: a find-and-replace across every file, with a dry-run diff before
> it opens (or adds to) a pull request.
