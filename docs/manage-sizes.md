# Manage Sizes

`/sizes` lists every original the pipeline uploaded (`photos/<hash>-<name>.jpg`) in a table, one row per photo with
its X-Small version as a thumbnail, and one column per resized version plus one each for the Square Thumbnail and its Thumbnail Preview. A size that's already in the bucket has a
circle-arrows button that remakes it; a size that isn't (for example, one added after the photo was uploaded) has a
lightning bolt button that makes it. Hovering a row shows a circle-arrows button next to the photo's name that remakes
every size. Clicking a thumbnail opens the Medium (1200px) version, or the original when there's no Medium yet, in
a full-window view. A table too wide for the window scrolls sideways. Each button sends `POST /api/photos/bucket/versions` → `POST /photos/bucket/versions` with the original's
`key` and the `versions` to make (every version and the Square Thumbnail when left out); the backend downloads the
original from R2, resizes it exactly as an upload does, and uploads the versions over whatever was at their keys. The
Square Thumbnail and Thumbnail Preview are cut from the crop saved with the Square Thumbnail already in R2 (read with a `HEAD` of it), so remaking them keeps
the square picked on the Photo page; making one that isn't there yet, for a photo uploaded before Square Thumbnails
existed, uses the middle of the photo. It doesn't change the photo's JSON.
