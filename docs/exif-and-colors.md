# EXIF and color data

Open `/exif` in the pipeline UI (<http://localhost:5174/exif> with `pnpm dev:docker`, <http://localhost:5173/exif> with
`pnpm dev:pipeline`) to upload a JPEG and see its EXIF metadata and colors in two tabs. The photo streams from the client through the BFF
(`POST /api/exif`) to the Go backend (`POST /exif`), which buffers it to a temp file, reads its metadata with
[go-exiftool](https://github.com/barasher/go-exiftool), summarises its colors with
[go-colorful](https://github.com/lucasb-eyer/go-colorful), and deletes it. The response is
`{ file, exif, colors }`, where `colors` holds the average color, the share of the photo in each of 12 fixed hue
buckets (every 30° around the color wheel), a lightness histogram of the neutral pixels (too dark or unsaturated to
have a hue), the mean lightness and chroma, and `raw`: per-channel statistics in every color space go-colorful
supports plus hue, lightness, chroma and saturation histograms. The UI shows these in Colors and Raw color data tabs. Update Data's **Colors** saves the same `colors`, `raw` included, in each photo's JSON file;
see [Update Data](update-data.md).
