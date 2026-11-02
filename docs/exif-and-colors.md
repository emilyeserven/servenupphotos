# EXIF and color data

Open `/exif` in the pipeline UI (<http://localhost:5174/exif> with `pnpm dev:docker`, <http://localhost:5173/exif> with
`pnpm dev:pipeline`) to upload a JPEG and see its EXIF metadata and colors in two tabs. The photo streams from the client through the BFF
(`POST /api/exif`) to the Go backend (`POST /exif`), which buffers it to a temp file, reads its metadata with
[go-exiftool](https://github.com/barasher/go-exiftool), summarises its colors with
[go-colorful](https://github.com/lucasb-eyer/go-colorful), and deletes it. The response is
`{ file, exif, colors }`, where `colors` holds the average color, the share of the photo in each of 12 fixed hue
buckets (every 30° around the color wheel), a lightness histogram of the neutral pixels (too dark or unsaturated to
have a hue), the mean lightness and chroma, the peak chroma its most vivid tenth reaches, and `raw`: per-channel statistics in every color space go-colorful
supports plus hue, lightness, chroma and saturation histograms. The UI shows these in Colors and Raw color data tabs. Update Data's **Colors** saves the same `colors`, without `raw`, in each photo's JSON file;
see [Update Data](update-data.md).

exiftool runs as one long-lived process that every photo shares. A photo's metadata can be up to 64 MB of exiftool
output: a Lightroom edit with brush or AI masks stores every brush stroke in its XMP, which on its own can pass
go-exiftool's default 64 KB limit. Any field longer than 2,000 characters, such as that brush mask
(`MaskGroupBasedCorrMaskGestureDabs`), is then left out of the photo's EXIF, since nothing the pipeline shows or saves
uses it. When a read still fails partway, the backend starts a new exiftool process, so that
photo shows **could not read photo metadata** and the photos after it are read as usual.

> **Frontend analogy:** the exiftool process is like one shared `ReadableStream` reader. If one chunk is too big for
> the buffer, the reader is left mid-stream and every later `read()` fails, so the fix is a bigger buffer plus a fresh
> reader whenever one breaks.
