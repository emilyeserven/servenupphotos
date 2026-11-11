# Pixelating faces

The Photo page (`/exif?edit=<path>`) has a **Pixelate faces** card for a photo already in R2. It hides faces behind
blocks of color on every resized version, the Square Thumbnail and its Thumbnail Preview, so the portfolio never shows
them. The original JPEG in R2 isn't changed (see [What isn't hidden](#what-isnt-hidden)).

## Picking the faces

- **Find faces** sends `POST /api/photos/bucket/faces/detect` with the photo's `key`. The backend downloads the
  original, shrinks it to 1200 px on its longest edge and runs [Pigo](https://github.com/esimov/pigo), a pure-Go face
  finder (MIT), on it, then answers with a box for each face, a little larger than Pigo's square so it reaches the
  hairline and chin, largest first. Nothing is saved. Finding again only adds faces that aren't boxed yet.
- **Dragging** anywhere on the photo outside a box draws a new one; **Add a box** puts one in the middle of the part
  of the photo in view (zoomed in and scrolled, that's the middle of what's on screen, sized to it).
- A box can be dragged to move it, and the picked one has corner handles to resize it. A focused box moves with the
  arrow keys (Shift for bigger steps). **Hide boxes** shows the preview without their outlines.
- **Zoom** with the − and + buttons under the photo (up to 800%), or Ctrl (⌘ on a Mac) + scroll or a trackpad pinch,
  which zooms toward the pointer. **Fit** goes back to the whole photo. Zoomed in, scroll to move around, or turn on
  **Move around** to drag the photo instead of drawing a box (the only way on a phone). The preview is drawn sharper
  as it zooms, up to 4096 px on its longest edge.
- **Full screen** opens the same editor filling the window, with the photo as large as it fits and the list of areas
  beside it (below it on a phone), for drawing small faces more precisely. It edits the same areas as the card, so
  closing it (Esc or the close button) keeps every change, and it can save from there too.

Pigo only finds faces looking roughly at the camera. Faces turned to the side, small in the frame, or partly hidden
(sunglasses, masks, hands) are easily missed, so the boxes are a starting point to check by eye, not a guarantee.

> **Frontend analogy:** Pigo is like a very fast hand-written CSS selector for faces. Its "cascade" file
> (`internal/versions/cascade/facefinder`, copied from Pigo's repository and embedded in the binary with `go:embed`)
> is thousands of tiny yes/no checks such as "is this pixel brighter than that one?". It slides a square over the photo
> at many sizes, and a square that passes enough checks is a face. No machine learning runs at request time and no
> model is downloaded, which keeps the backend a single Go binary with no C libraries.

## Shapes and keep areas

Every new area, drawn, added or found, starts as a **Circle** with **Whole blocks** edges. Each area in the list has
these choices:

- **Pixelate** or **Keep as is**. A keep area leaves what's under it as the photo has it, even where a face's
  pixelation covers it, for hair, a hat or a background that doesn't need hiding. Keep areas are applied after every
  face, whatever their order. **Add a keep area** puts one in the middle of the view; any drawn box can be switched to one. Their
  outlines are sky blue and they're named "Keep 2" rather than "Face 2".
- **Box** or **Circle**. A circle is the circle (an oval, when the box isn't square) that fits in the box, drawn with
  round corners over the preview. It works for keep areas too.
- **Turn**, from -180° to 180°: turns the box or circle clockwise about its middle. Drag the round arrow handle on the
  picked box's right side (Shift for 15° steps), or use the area's **Turn** slider. The blocks stay square with the
  photo, starting at the top left of the turned area's bounds; only what's inside the turned area is pixelated.
- For a pixelated circle or a turned box, its edge: **Inside the circle** (or **Inside the box**) pixelates only the
  pixels inside it, so the edge keeps its shape and the corners keep the photo. **Whole blocks** pixelates every block
  the area touches, whole, so the edge is a staircase of blocks whose corners reach past it.

On the wire, an area adds `shape: "circle"`, `edge: "blocks"`, `rotation: <degrees>` and `keep: true` to its
`{ x, y, width, height, blocks }` (each left out for the default: box, inside, not turned, pixelate). `x`, `y`, `width`
and `height` are the box before it's turned. In R2 metadata a circle adds `,circle` or `,circle-blocks` (a box in whole
blocks `,box-blocks`), a turned area `,rot<degrees>` and a keep area `,keep` after its five numbers, in that order. A
photo can have up to 30 areas, so they fit in R2's 2 KB of metadata.

> **ELI5:** turning a box is like turning a cookie cutter before pressing it into the dough. The grid of blocks is the
> same squared-up grid either way; the cutter only decides which of its squares (or which pixels) get pixelated.

## Density

Each box has its own **Density** slider: how many blocks fit across the box's longer side, from 3 to 40 (8 to start).
Fewer blocks hide more. Next to it is roughly how many pixels of the original each block covers.

The photo above the list is a live preview, drawn in the browser on a `<canvas>`: each box is shrunk to one pixel per
block and stretched back with smoothing off. The backend averages every block exactly, so the versions can look a
touch different from the preview, but the blocks fall in the same places.

> **ELI5:** pixelating is like looking at a face through a window made of big frosted glass squares. Each square
> shows only one color, the average of everything behind it. The bigger the squares (the fewer blocks), the less of
> the face you can make out.

## Saving

**Pixelate every version** (or **Remake versions without pixelation** once every area is removed) sends
`POST /api/photos/bucket/versions` with the `key` and `faces`, a list of the areas as above, in pixels of
the photo turned upright from its EXIF orientation. Giving `faces` always remakes every version, whatever `versions`
asks for, so none still shows a face. The backend decodes the original, pixelates every box on the full-size photo,
then makes each version from that, so even the Preview only ever has the blocks to show. The Square Thumbnail keeps its
saved crop.

Each version is uploaded with the faces in its R2 metadata (`x-amz-meta-faces`, `x,y,width,height,blocks` per face,
joined by `;`), the same way the Square Thumbnail keeps its crop. Then the photo's JSON is saved through the Photo
page's own save, with every version's URL marked `?faces=<stamp>` and the areas in its `faces` field (left out once
there are none). The versions keep their keys when they're remade,
so the new URLs make browsers and Cloudflare's cache fetch the pixelated versions instead of the old ones (R2 ignores
the mark). Other unsaved changes on the page stay unsaved.

The card starts from the photo JSON's `faces`, so the areas can be edited again later from the photo data alone. A photo
pixelated before the JSON kept them has none there; for it, the card reads them back from R2 with
`GET /api/photos/bucket/faces?key=<key>` (a `HEAD` of the Square Thumbnail). Manage Sizes and moving the Square
Thumbnail's crop still read the R2 metadata, which every remade version carries.

> **Frontend analogy:** the metadata is like a `data-*` attribute on each image: it travels with the file itself, so
> anything that remakes the file later can read it back without asking the photo's JSON.

## Remaking versions keeps the faces hidden

Every other way of remaking versions, [Manage Sizes](manage-sizes.md) and moving the Square Thumbnail's crop on the
Photo page among them, reads the faces saved with the Square Thumbnail and pixelates them again, so remaking a version
never brings a face back.

## What isn't hidden

- **The original JPEG.** It stays as it was in R2, and its URL is in the photo's JSON as `images.full` (and so in
  `ALLPHOTOS.json`, which is public). The portfolio doesn't show it, but anyone reading the data could open it. Upload a
  version with the face already hidden (from Lightroom, say) when the original itself must not show it.
- **Cached copies.** Someone who loaded a version before it was pixelated may still have it in their browser cache.
  The new URL marks mean the portfolio itself never asks for the old copy again.
- **Uploads.** Faces are pixelated after upload, from the Photo page; the upload page and the upload queue don't
  pixelate. The versions sit in R2 unpixelated until then, but nothing links to them before the photo's JSON is
  committed.
