# Explore Bucket

`/bucket` shows every image in the R2 bucket from Settings (`GET /api/photos/bucket` → `GET /photos/bucket`), newest
first, under any prefix: objects ending in `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` or `.avif`. Each tile shows the image
from the bucket's public URL with its key, size and upload time, and links to the full image. It needs the R2 keys,
bucket and public URL in Settings, and only reads from R2. An image whose photo data is still in the open **Add photo
data** pull request is faded with a pull request badge, and so are that photo's resized versions.

Each original is shown as a stack, with blank squares behind it standing for its resized copies (keys
`<original stem>-<version>.webp`). Clicking the stack puts the copies right after the original in the grid, largest
first, each labelled with its size (for example "Large · 1800px"); clicking it again collapses them. The key under a
tile links to the image. A resized copy whose original isn't in the bucket shows on its own, still labelled.

A photo already in `ALLPHOTOS.json` (on the base branch, or in the pull request's copy) gets a book badge
(both come from the [combined data store](combined-data-store.md)). An entry matches by its saved
`images.key`, then its `images.full` URL, then by the name stem in the original's key. An original JPEG that is neither
in flight nor in `ALLPHOTOS.json` gets a **Generate JSON** button, which opens a modal that reads the original
from R2 (`POST /api/photos/bucket/exif` with `{ "key" }` → `POST /photos/bucket/exif`) through the same EXIF and color
analysis as `POST /exif`. The JSON gets the original's URL and key and the URLs of the resized copies in the bucket, and
its `file` is the name kept in the key (`photos/<hash>-dsc0001.jpg` gives `dsc0001.jpg`). After the same
`ALLPHOTOS.json` check as Add Photo, **Save to GitHub** asks for the JSON file name and adds it to the photo data pull
request. The button only shows once both checks have run, so it needs the GitHub settings too.
