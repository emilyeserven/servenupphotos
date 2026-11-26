# Bulk tagging

**Bulk tagging** tags up to 50 photos with one LLM prompt, or every photo without tags with **No limit**. The card first says how many photo files have no tags yet (`POST /api/data/bulk-tags/untagged`, read again after each save). **Photos to pick** next to the buttons sets how many each pick finds (5 at first, 1 to 50; the backend treats a missing `count` as 5 and caps it at 50, and the preview and save take any number of photos). **No limit** (`all: true`) hides the count and picks every photo without tags that's left: with **Pick photos that go together**, the first one and every photo that shares something with it; without, all of them. A big pick makes a long prompt, so make contact sheets before copying it. **Pick photos** (`POST /api/data/bulk-tags/pick`, `{ skip, count, any }`) reads every photo file as the next Commit will have it and only considers photos without tags (an empty or missing `tags`), so a photo that already has tags is never picked. It picks the first of those by path, then up to `count` − 1 more that share the most with it: each shared [place](../places-and-localizations.md) counts 5, the same city 3 (or else the same country 1), each shared [genre](../photographic-genres.md) 2, and being taken the same day 3 (or else the same month 1), using the hand-written city, country and date over the EXIF ones. Photos that share nothing aren't picked. Each card says what it shares with the first photo. With **Pick photos that go together** turned off (`any: true`), it picks the first `count` photos without tags by path instead, whatever they share. **Pick other photos** sends the photos already shown as `skip`, so the next pick leaves them out; **Start over** picks from every photo again.

**Make contact sheets**, optional, puts the picked photos on numbered sheets in R2 for the prompt to link ([Contact sheets](../contact-sheets.md)).

**Copy the tag prompt** (`lib/bulk-tag-prompt.ts`) copies one prompt for all of them: each photo by its file name (without `.json`), with a link to its Small version, what's known of where it was taken, and the tags it already has, then the same rules, existing tags and **Already filtered** list as one photo's [tag prompt](../albums-and-tags.md#suggest-tags) (`TAG_RULES` and `tagListsSection` in `lib/tag-prompt.ts`), asking for 3 to 8 new tags each and for the answer as JSON:

```json
{
  "photos": [{ "photo": "20161216_092741", "tags": ["shotengai", "lanterns"] }],
  "definitions": [
    { "tag": "shotengai", "definition": "a Japanese shopping street", "parent": "covered-street" }
  ]
}
```

Paste the answer and **Review the tags** (`POST /api/data/bulk-tags/preview`, which saves nothing). The backend reads the JSON object in it (from the first `{` to the last `}`, so a code block or words around it are fine) and sorts each photo's names as pasting into a Tags field does (`github/bulktags_answer.go`): a name matching a tag's ID or name (ignoring case, or by the ID made from it) is that tag; one an album, genre or metadata group has, or with nothing to make an ID from, is left out saying why; the rest are new tags in lowercase kebab-case, with their definitions as descriptions. A parent that isn't a tag yet is made too, before the tag under it. Photos the answer names that weren't picked are found among every photo and reviewed after the picked ones, and names that aren't any photo's are listed and skipped ([photos outside the batch](../copy-prompts.md#photos-outside-the-batch)).

The review lists the new tags, each with a checkbox and one for its parent, then each photo with a checkbox per tag to add, marking the new ones, and the tags it already has. **Save tags for N photos** (`POST /api/data/bulk-tags`) makes the ticked new tags, parents first, and adds the ticked tags to each photo's `tags` after the ones it has, all in one save of [changes waiting for Commit](../pending-changes.md). Each new tag is checked as **New tag** on `/tags` checks it, and nothing is saved when one can't be made or a photo can't be read. Once saved, the list of new tags is hidden, since they're made.

> **Frontend analogy:** it's the single-photo paste flow batched: a "dry run" mutation that returns a diff for the user to edit (like a form's preview step), then one mutation that commits the edited diff.
