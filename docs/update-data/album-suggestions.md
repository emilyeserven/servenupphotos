# Album suggestions

**Album suggestions** asks an LLM which albums, existing or new, up to 50 related photos belong in. It works like Bulk tagging, with the same **Photos to pick**, **Pick photos**, **Pick other photos** and **Start over** (`POST /api/data/album-suggestions/pick`, `{ skip, count }`), but only considers photos that aren't in an album (an empty or missing `albums`), and ranks the ones that go with the first photo by its tags above all: each shared [tag](../albums-and-tags.md) counts 4, then the places, city or country, genres and date count as they do for Bulk tagging. So photos with like tags come first, then photos from the same place and dates, such as one trip.

**Copy the album prompt** (`lib/album-prompt.ts`) copies one prompt for all of them: each photo by its file name, with a link to its Small version, what's known of where it was taken, when it was taken (the custom date over the EXIF one), and its tags and genres; then every existing album as a tree, with its description, and the tag, genre and metadata group names, which an album can't have. It asks the LLM to group photos that share tags first, then photos from the same place and dates, to reuse an existing album when one fits, to make a new album only for two or more of the photos, named as a visitor would see it (such as "Busan Beaches"), inside an existing album when one is a more general home for it, and to put each photo in one album at most. The answer is JSON:

```json
{
  "albums": [
    {
      "album": "Kyoto Lantern Nights",
      "description": "Lanterns and lit-up streets after dark in Kyoto.",
      "parent": "Japan",
      "photos": ["20161216_092741", "20161218_220416"]
    }
  ]
}
```

Paste the answer and **Review the albums** (`POST /api/data/album-suggestions/preview`, which saves nothing). The backend reads it as it reads a Bulk tagging answer (`parseLLMAnswer` in `github/bulktags_answer.go`) and sorts each album's name the same way (`github/albumsuggest.go`): a name matching an album's ID or name (ignoring case, or by the ID made from it) is that album; one a tag, genre or metadata group has, or with nothing to make an ID from, is left out saying why; the rest are new albums, named as the answer writes them, with an ID made from the name and the answer's description. A new album's `parent` is kept only when it names an existing album. Two entries naming the same album are merged. Photos the answer names that weren't picked are put in their albums too, and names that aren't any photo's are listed and skipped ([photos outside the batch](../copy-prompts.md#photos-outside-the-batch)).

The review lists each album with a checkbox, marked new or existing, a new one's description and a checkbox for the album it goes inside, and its photos, each with a checkbox. **Save albums for N photos** (`POST /api/data/album-suggestions`, `{ newAlbums, photos: [{ path, albums }] }`) makes the ticked new albums that still have a photo, then adds the albums to each ticked photo's `albums`, all in one save of [changes waiting for Commit](../pending-changes.md). The save takes any number of photos, so photos the answer names outside the batch, or Shared Likes and Import Book's saves, aren't held to the pick's 50. Each new album is checked as **New album** on `/albums` checks it, and nothing is saved when one can't be made or a photo can't be read.

> **Frontend analogy:** the same "dry run, then commit the edited diff" flow as Bulk tagging, with a different ranking function for which photos go in the batch: like sorting search results by a score where a shared tag is worth more than a shared city.
