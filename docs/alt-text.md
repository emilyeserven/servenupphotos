# Alt text

Each photo file can have `altText`: a short description of what the photo shows, such as "A paper lantern glowing
over a narrow alley at night." The portfolio gives it to the photo's images as their `alt`, so a screen reader reads
it out in place of the photo and a browser shows it when the photo can't load.

## On the portfolio

`lib/photos.ts` reads it into each photo's `alt`: the alt text, or the title when there's none (the file name for a
photo without a title). The Grid's tiles, the photo viewer, and an album's rows and strips (`fitted-photo.tsx`,
`album-rows.tsx`, `album-strip.tsx`) use it. Those album buttons used to be named "Show _title_" with an empty `alt`;
now the image inside names the button, as the Grid's tiles do, and the title stays as the tooltip. Blurred
placeholders, backdrops and the header spotlight keep `alt=""`, since they're decoration or a second copy of a photo
already described. Small thumbnails and map pins keep "Show _title_", where a whole description would be too much.

## On the Photo page

The Photo page (`/exif`, and editing a photo in flight or from the Gallery) has an **Alt text** box between
**Comment** and **Photographer notes** in the **Title and comment** card (`components/photo-alt-text-field.tsx`),
saved as the JSON's `"altText"` (`null` when empty) with the rest of the photo's details. It counts characters against
125, about what a screen reader says in one go, and marks longer text as long, but saves it anyway; the backend
refuses more than 1000.

The field is in every new photo file (`newPhotoJSON`), so Update Data → **Missing fields** adds `"altText": null` to
older ones. Unlike [photographer notes](photo-notes.md), it isn't taken out of `ALLPHOTOS.json`: the portfolio needs
it.

## Writing it for many photos

**Alt Text** (`/alt-text`, under **Photo** in the sidebar, `components/alt-text/`) writes alt text for a batch of up
to 50 photos with one LLM prompt, the way [Genre suggestions](update-data.md#genre-suggestions) works:

1. **Pick photos** (`POST /api/data/alt-text/pick`, `{ skip, count }`, `PickAltTextPhotos` in `github/alttext.go`)
   reads every photo file as the next Commit will have it and picks the first `count` (20 at first, 1 to 50) without
   alt text, by file name. Blank alt text counts as none. **Pick other photos** leaves out the ones already shown;
   **Start over** picks from the start again.
2. **Copy the alt text prompt** (`lib/alt-text-prompt.ts`) copies one prompt for all of them: each photo by its file
   name, with a link to its Small version, its title, where it was taken and its tags, to help the LLM name what it
   sees. It asks for one or two plain sentences each, subject first, under 125 characters, without "Photo of",
   guesses at who people are, hashtags or opinions, as JSON:

   ```json
   {
     "photos": [
       {
         "photo": "20161216_092741",
         "altText": "A paper lantern glowing over a narrow alley at night."
       }
     ]
   }
   ```

   Send it to an LLM that can open links and see images.

3. Paste the answer and **Review the alt text** (`POST /api/data/alt-text/preview`, which saves nothing). The review
   shows each picked photo's thumbnail next to its alt text in a box you can edit, with its length, and the alt text it
   replaces when it had some. A photo is ticked once it has text; untick any you don't want. Photos the answer names
   that weren't picked are listed and left out.
4. **Save alt text for N photos** (`POST /api/data/alt-text`, `{ photos: [{ path, altText }] }`) writes each ticked
   photo's `altText`, leaving every other byte of its file as it was, in one save of
   [changes waiting for Commit](pending-changes.md). Nothing is saved when a photo can't be read or its alt text is
   empty or over 1000 characters; a photo that already has that exact text is skipped.

> **Frontend analogy:** it's the `alt` prop you'd normally hard-code in JSX, moved into the data so every place that
> renders the photo picks it up, with a fallback (`altText || title`) like a default prop. The bulk page is a codemod
> for it: export the components missing the prop, let a reviewer (the LLM) fill them in, and review the diff before it
> lands.
