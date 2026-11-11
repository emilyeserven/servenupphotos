# Bio

`/bio`, **Bio** under **Publish** in the sidebar, is where the bio the portfolio will show about you is written, with
its photos in the order it shows them. The portfolio doesn't show the bio yet: for now the page only keeps it, so a
portfolio page can read it later.

## The text

**Bio** is the bio itself, written in [Markdown](https://commonmark.org/help/), with each line break kept as written,
as the portfolio's other Markdown is. **Preview** shows it rendered, and **Write** goes back to the box.

## The photos

Under **Photos**, the bio's photos are lined up in the order the bio shows them, numbered from 1. Drag a photo to
another place, or move it one place with its arrows; the **×** takes it off the bio. A photo can be one of two kinds,
mixed in any order:

- **Self-portraits**, marked **Bio only**. They aren't photo files, so they never show up on any other page of the
  portfolio or the pipeline (the Gallery, the Grid, albums, the map…). **Upload self-portraits** picks one or more
  pictures (a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF of up to 50 MB), and each is added at the end once it's
  uploaded. The box under each one is its alt text.
- **Portfolio photos**, marked **Portfolio photo**: any photo file, which stays everywhere else on the site too. The
  **Photos** drawer beside the bio lists them like the [Photo Book's](photo-book.md#the-photo-drawer), with a search,
  **Show photos already on the bio** (off at first, so each is added once) and the portfolio Grid's filters. Click a
  photo to add it at the end, or drag it onto the bio's photos. The drawer leaves out the
  [Undecided](photos-in-flight.md#undecided) photos.

## Uploading a self-portrait

Choosing a self-portrait (`POST /api/bio/portrait` → `POST /bio/portrait`, a multipart form with the file as `image`)
puts it in R2 right away, as the [gear pictures](gear-pictures.md#the-picture-and-its-sized-version) are, since the
bio file only points at it. The backend turns it upright and saves two WEBP versions at quality 90:
`bio/<hash>-<name>.webp`, at most 1800px on its long edge, the one the bio will show, and
`bio/<hash>-<name>-small.webp`, at most 500px, for the page's tiles. The hash is of the uploaded file, so a new
picture never takes an old one's link. The picture as uploaded isn't kept, so nothing from its EXIF, such as where it
was taken, ends up in the public bucket. Taking a self-portrait off the bio leaves its versions in R2.

> **Frontend analogy:** like a profile page's own image uploads, which go straight to a CDN and come back as URLs to
> keep in the profile's JSON, instead of becoming posts in the feed.

## The file

The bio is one file, `bio/bio.json`, and **Commit** combines it into `bio/BIO.json` (a list with the one bio in it),
as it does the other [changes waiting for Commit](pending-changes.md). Every change on the page is saved
(`PUT /api/bio/bio` → `PUT /bio/{id}`) under a second after the last one, so typing saves once; the note beside
**Photos** says **Saving…** until it has, and **Saved for Commit** after.

```json
{
  "id": "bio",
  "text": "# Hi, I'm Emily\n\nI photograph **cities**, trains and the people in them.",
  "photos": [
    {
      "portrait": {
        "image": "https://cdn.servenupphotos.net/bio/1a2b3c4d5e6f-me-in-seoul.webp",
        "small": "https://cdn.servenupphotos.net/bio/1a2b3c4d5e6f-me-in-seoul-small.webp",
        "width": 1200,
        "height": 1800,
        "alt": "Me holding a camera on a Seoul street"
      }
    },
    { "photo": "apps/portfolio/src/data/photos/DSCF4800.json" }
  ]
}
```

- **`id`** is always `bio`: there's one bio.
- **`text`** is the bio in Markdown, up to 20,000 characters.
- **`photos`** are in the order the bio shows them, up to 200. Each has either **`photo`**, a portfolio photo's file
  path, or **`portrait`**, a self-portrait: the links of its two versions, the large one's **`width`** and
  **`height`** in pixels, and its **`alt`** text (up to 1000 characters, or `""`). A photo can be on the bio once.

`apps/client-pipeline/src/lib/bio.ts` makes the changes (`addPortrait`, `moveBioPhoto`, …),
`apps/be-pipeline/internal/github/bio.go` checks and saves the file, and `apps/be-pipeline/internal/storage/bio.go`
makes the self-portraits' versions.
