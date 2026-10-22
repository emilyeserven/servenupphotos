# Bulk Upload

**Bulk Upload** (`/bulk-upload`, or the right half of the sidebar's **Upload** button, which opens it in a modal) adds
many photos to the batch at once. Drop JPEGs on it or click it to choose them,
and each one goes through the same steps as a photo on the [Photo page](saving-to-github.md), with defaults in place of
the choices made there:

1. **Analyze**: its EXIF and colors are read (`POST /api/exif`).
2. **Check**: it's looked for in the saved photo data, `ALLPHOTOS.json` on the Settings branch and the open **Add photo
   data** pull request's files, exactly as the Photo page does. A photo already there is skipped and links to where it
   was found. When a place can't be read, the photo is still added, with a warning.
3. **Upload**: the photo, its resized versions and its Square Thumbnail go to R2 (`POST /api/upload`). The Square
   Thumbnail is cut from the middle square, as the Photo page starts with.
4. **Add to Batch**: its JSON is saved to the photo data pull request (`POST /api/photos/github`), named after its file
   name and without a title, so the portfolio shows its file name. It's in no albums, tags or places yet.

Photos go one at a time, in the order they were chosen, so their saves never race each other to open the pull request.
Each row shows the step it's on, and the bar above them how many are done. The top-right sync button counts each added
photo as it's saved, the same as with Add to Batch, and **Commit** adds them all to `ALLPHOTOS.json` at once.

Once a photo is added, its **Edit** button opens it on Edit Photo to give it a title, a different square, albums or
tags. The queue keeps going while you're there, or with the modal closed, and is still there when you come back, on the page
or in the modal (until the app is reloaded).

The main half of the sidebar's **Upload** button opens a modal for one photo instead; choosing it opens it on the Photo
page, analyzed as if it had been chosen there.

When a step fails, the row says why and **Retry** picks up from that step: a photo that was uploaded isn't uploaded
again. Anything but a JPEG fails straight away. When R2 already has a different photo under the same name, the row
links to it; **Keep name** uploads it anyway (as the Photo page's "keep the name"), or rename the file and drop it
again. **Clear finished** takes the added and skipped photos off the list, and an added photo's × hides just that one once you're done with it (it stays in the batch).

> **Frontend analogy:** it's a download manager's queue. Every file is a row with its own progress and its own retry
> button, but only one downloads at a time, and a failed one doesn't hold up the rest.

## The upload queue

Bulk Upload's queue is the app's one upload queue. The Photo page's **Upload & save** button (next to Upload to R2 and
Save, until the photo is uploaded there) hands the analyzed photo to it with its title and other details, its square,
albums and tags, and the queue uploads it and saves its JSON while you go on to other pages. Changes made on the Photo
page after that aren't saved with it; change it afterward with Edit. While the queue has anything in it, the Status page
shows it, with the same rows and buttons.

## Choosing a photo on the Photo page

Until a photo is chosen, a **Saved photo** card sits beside the Photo page's upload card. Its **Choose a saved photo**
opens a modal listing the photos in the photo data pull request (marked "In the batch") and those in the portfolio, with a
search by title or file name; picking one opens it on Edit Photo. Once a photo is chosen, the card goes away and a
**Choose another photo** button next to the page's title (and Edit Photo's) opens the same modal, with an **Upload**
tab for a new photo from this computer.

## Progress on the sync button

Dropping photos in the Bulk Upload modal closes it, so you can carry on while they upload. While any photo in the queue
isn't done yet, the top-right sync button starts with a ring of how many are, such as "2/6", and its panel lists the
queue above the batch's counts, with the same rows and buttons and a link to the Status page.
