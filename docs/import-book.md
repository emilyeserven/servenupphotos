# Import Book

`/photo-books/import`, **Import Book** on the [Photo Books](photo-book.md) page, rebuilds a photo book made before (in a print shop's own software, say) as an album and a photo book in the pipeline. An LLM reads the old book, a PDF or images of its pages, against a catalog of the website's photos, says which of the book's photos aren't on the website, and lays out each page; its answer is pasted back and saved as [changes waiting for Commit](pending-changes.md).

## The prompt

The **Read the book with an LLM** card makes the prompt:

- **PDF / Page images** says how the old book is sent. Page images are screenshots, scans or photos of its pages in order; an image of a two-page spread counts as two pages, left then right. Both ask for the same JSON.
- **Taken from** and **Taken to** limit the catalog to the photos taken between those days, both included, so a book of one trip doesn't list every photo. With either set, photos with no date taken are left out. Both empty lists every photo.
- **Make contact sheets** is optional, as on the other prompts ([Contact sheets](contact-sheets.md)): the LLM looks through a few numbered sheets of the catalog instead of opening each photo's link.

The catalog is every photo file the pipeline reads (in flight ones too, not the [Undecided](photos-in-flight.md#undecided) ones), oldest first, one line each: its JSON file's name in quotes (the name the answer uses), its Small version's link, and its title, day taken, city and country, and orientation, which help tell similar shots apart. The prompt also lists the planner's page layouts from `LAYOUTS` in `lib/photo-book.ts`, so a new layout reaches the prompt on its own.

The LLM is asked to:

1. pick the closest layout for every page with photos, splitting a page with more photos than any layout holds into pages that follow one another, and leaving out the cover and pages without photos,
2. match each printed photo to a website photo by what it shows, allowing for a different crop or edit, and only when it's sure,
3. give a printed photo that isn't on the website an empty `"photo"` and a description, and list it under `notOnWebsite`,
4. copy each page's heading as its title, and a photo's printed caption only when it says more than its title and facts (place, date, camera, settings), since the book's [caption template](caption-templates.md) writes those.

The prompt is `bookImportPrompt` in `lib/book-import-prompt.ts`.

## The answer

```json
{
  "book": { "name": "Serven Up Photos Vol. 3", "description": "A year of favorite photos." },
  "notOnWebsite": [
    { "page": 4, "printedTitle": "Snowy Park", "description": "A snowy park by a river." }
  ],
  "pages": [
    {
      "page": 4,
      "layout": "pair-left",
      "title": "WINTER",
      "photos": [
        { "photo": "IMG_0412", "printedTitle": "Betty (Dan's Truck)", "caption": null },
        {
          "photo": "",
          "printedTitle": "Snowy Park",
          "caption": null,
          "description": "A snowy park by a river."
        }
      ]
    }
  ]
}
```

**Read the book** reads it like every other pasted answer ([Pasting the answer](copy-prompts.md#pasting-the-answer)), with `readBookImport` in `lib/book-import.ts`:

- Photos are matched by name with `matchName`, among every photo file rather than only the catalog's, so an answer to a prompt with other dates still matches. Its original file's name (such as `DSCF4800.JPG`) works too. A name that isn't any photo's is listed as skipped, and its place is left empty.
- A layout the planner doesn't have becomes a full page for one photo, or two photos on the left for more. A page with more photos than its layout holds goes on as many pages as it needs, the title on the first.
- A photo already placed earlier in the book leaves its later place empty, since a book holds each photo once.

The review shows how many pages and photos there are, the photos not on the website with their pages, and each page with its layout, title and photos (a dashed box for one not on the website).

## Saving

**Name** names both the album and the photo book, the book's name from the answer at first. **Make the album and photo book** saves, one step after another (`importSaves` in `lib/book-import-save.ts`, saved by `useImportBook`):

1. The album, with every matched photo. A new album gets the answer's description and starts hidden on the portfolio, as working albums do ([Showing or hiding on the portfolio](albums-and-tags.md#showing-or-hiding-on-the-portfolio)), unless **Hide the new album on the portfolio** is unticked. When an album already has the name, the photos are added to it instead. All the photos go in one save (`POST /api/data/album-suggestions`, the same save [Album suggestions](update-data.md#album-suggestions) uses, which takes any number of photos).
2. A new album's photo order, the book's order (`PUT /api/organize/albums/<id>/photo-order`), so the book's photo drawer lists them in it.
3. The photo book (`PUT /api/photobooks/<id>`), its ID made from the name, with the album picked and every page as the answer laid it out, all of them in the book (`order`) in the old book's order. Empty places stay empty for the photos not on the website.

With no matched photos, only the book is saved, with no album. Once saved, the page links to the new book's **Book** tab.

> **Frontend analogy:** it's three `mutateAsync` calls in a row inside one mutation, rather than one endpoint that does it all. Each one is still its own mutation with `meta.saves`, so the combined lists show each change as soon as it's saved, as any other save does.
