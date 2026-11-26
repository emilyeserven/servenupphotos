# Genre suggestions

**Genre suggestions** suggests [photographic genres](../photographic-genres.md) for a batch of up to 50 photos with one LLM prompt. It works like Bulk tagging, and shares its pick controls, paste box and review. **Photos to pick** starts at 50 (1 to 50; the backend treats a missing `count` as 50). **Pick photos** (`POST /api/data/genre-suggestions/pick`, `{ skip, count }`) reads every photo file as the next Commit will have it and picks the first `count` photos without genres (an empty or missing `genres`) by file name, which for camera files is the order they were taken, as Bulk tagging does with **Pick photos that go together** off: a genre is judged one photo at a time. **Pick other photos** leaves out the ones already shown; **Start over** picks from the start again.

**Photos to pick from** chooses which photos: **Photos without genres** (the default, as above) or **Photos with genres**, to look at their genres again. The second picks photos that have genres (`reassign: true`), and **In genre** narrows it to the photos in one genre or any of its subgenres (`genre: "architecture"`), which is how a genre's photos get sorted into new subgenres. Changing the choice starts the pick over.

**Make contact sheets**, optional, puts the picked photos on numbered sheets in R2 for the prompt to link ([Contact sheets](../contact-sheets.md)).

**Copy the genre prompt** (`lib/genre-prompt.ts`) copies one prompt for all of them: each photo by its file name, with a link to its Small version, its title and what's known of where it was taken, and its tags, then every genre there is with its description, each [subgenre](../photographic-genres.md#subgenres) indented under its genre (the prompt asks for the subgenre alone when it fits, since it already counts as its genre). It asks for 1 to 3 genres a photo, from that list when one fits, and only otherwise for a new genre that photographers would recognize (such as Night or Food, never a subject or a place), in Title Case, described once in `newGenres`. When several photos share a more specific kind of a genre there is, it can suggest a new subgenre, naming its broader genre in `parent`:

```json
{
  "photos": [{ "photo": "20161216_092741", "genres": ["Street", "Night"] }],
  "newGenres": [
    { "genre": "Night", "parent": "", "description": "Photos taken after dark." },
    {
      "genre": "Traditional architecture",
      "parent": "Architecture",
      "description": "Temples and old houses."
    }
  ]
}
```

With **Photos with genres**, the prompt also lists each photo's genres now and asks for every genre it should have, the ones it keeps too, since the list replaces its genres.

Paste the answer and **Review the genres** (`POST /api/data/genre-suggestions/preview`, which saves nothing). The backend reads it as it reads a Bulk tagging answer (`github/genresuggest.go`): a name matching a genre's ID or name (ignoring case, or by the ID made from it) is that genre; one an album, tag or metadata group has is left out saying why; the rest are new genres, named as the answer first wrote them, with their descriptions, and the parent the answer gave each, found by a genre's ID or name or another new genre's (none when it's neither). Reassigning (`reassign: true`), a photo's suggested genres include the ones it has, since they replace them. The review lists the new genres with a checkbox each and a dropdown of the genre each goes under (**Top level**, then every genre, then the other new genres), starting at the answer's parent, then each photo as a row with its image on the left and, on the right, a dropdown for each genre the answer suggested, starting at that genre. Each dropdown lists **No genre** and then every genre, with the new ones still ticked marked "(new)", so a suggestion can be swapped for another genre or left out; a photo the answer gave no genre gets one dropdown starting at **No genre**. Unticking a new genre turns its dropdowns to **No genre**. **Save genres for N photos** (`POST /api/data/genre-suggestions`) makes the ticked new genres, each under its parent (checked as **New genre** on `/genres` checks one), and adds the genres the dropdowns show (each once) to each photo's `genres` after the ones it has, in one save of [changes waiting for Commit](../pending-changes.md). Reassigning, each row also says the genres the photo has now, and the save (`reassign: true`) makes the dropdowns' genres the photo's `genres`, in their place; a photo whose dropdowns are all **No genre** is left as it is. Nothing is saved when a genre can't be made or a photo can't be read.

**Progress.** While **Missing fields** or **Colors** reads (its preview, or saving), the card says what it's doing and how far it has got, with a bar once it can count: reading the photo files from GitHub (no count), asking GitHub when the files were created (50 files a query, only files not asked before), then reading the originals in R2, such as "Reading each photo's colors from its original in R2: 42 of 150". The backend keeps each task's latest progress in memory (`github.WithProgress`, kept by `readProgress` in `be-pipeline/internal/httpapi/progress.go`), and the page asks `GET /api/data/progress/{task}` (`missing-fields` or `colors`) every half second until the read answers.

> **Frontend analogy:** the progress is polled, like a `useQuery` with `refetchInterval: 500` next to the slow request, rather than streamed. The slow request stays an ordinary JSON answer; a second, cheap endpoint just reads a variable the first one keeps updating.

> **Frontend analogy:** it's a codemod for your data: a find-and-replace across every file, with a dry-run diff before it opens (or adds to) a pull request.
