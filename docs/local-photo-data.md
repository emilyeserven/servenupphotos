# Portfolio with your own photo data

`pnpm dev` and `pnpm dev:docker` first run `pnpm photos:local`, which writes
`apps/portfolio/src/data/photos/ALLPHOTOS.local.json` (git-ignored). It copies `ALLPHOTOS.json` from the open **Add photo
data** pull request on the `origin` GitHub repository, so the portfolio shows the photos in flight. With no such pull
request, or when GitHub can't be reached (it says why), it combines the photo JSON files in `apps/portfolio/src/data/photos`
instead, the same way the **Combine photo data** workflow builds `ALLPHOTOS.json`: every other JSON file in the folder,
as one array sorted by file name. It does the same for places and localizations, writing `PLACES.local.json` and
`LOCALIZATIONS.local.json` in `apps/portfolio/src/data/places` and `localizations` (see
[Places and Localizations](places-and-localizations.md#on-the-portfolio)). Set `GITHUB_TOKEN` for a private repository, or if GitHub's
limit of 60 unauthenticated requests an hour runs out.

While the file has at least one photo, the portfolio's Timeline, Map and Grid show those photos instead of the
committed `apps/portfolio/src/data/photos/ALLPHOTOS.json` (the Map leaves out photos without a GPS position, the Grid photos without resized versions, and photos without a
`createDate` are left out everywhere); with no photos, or no file, they fall back to the committed
file, and the Grid shows its placeholder when that has no photos with resized versions either. The Grid loads each photo's resized versions from R2 through `srcset`, newest photo first, with the
blurred `preview` behind each one until it loads (the `thumbnailpreview` behind a Square Thumbnail, falling back to the
`preview` when it won't load). The real image fades in over it once it loads; a Square Thumbnail that won't load falls
back to the middle of the resized versions, and when nothing loads the tile stays blurred instead of showing a broken
image. Run `pnpm photos:local` again to pick up new photos; the running
portfolio reloads the file on its own.

> **Frontend analogy:** it's a local mock of the API response: the same JSON CI publishes, copied to your machine so
> the portfolio can render real data before the pull request merges.
