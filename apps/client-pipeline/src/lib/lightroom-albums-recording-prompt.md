The attached video is a screen recording of the album panel in Adobe Lightroom (Lightroom Classic's **Collections**
panel, or the **My Albums** panel in Lightroom). The list is scrolled from top to bottom. Read the whole list and write
it out as a tree.

## How to read the video

- **Go through the whole recording.** The list is longer than one screen. Each item usually shows up in several frames
  as the list scrolls. List every item once, in the order it appears from top to bottom.
- **Use the overlap between frames** to stitch the screens together. Items that repeat as the list scrolls are the
  same item, not duplicates. If two items have the same name, count them as different only when they sit in
  different folders or at different places in the list.
- **Nesting:** an item is inside the folder above it when it's indented further in. A disclosure triangle or chevron
  marks a folder (Lightroom Classic: collection set; Lightroom: folder). A folder icon or a stacked-photos icon
  marks a folder too. A plain album or collection icon marks an album.
- **Smart Collections** (Lightroom Classic, gear icon on the collection) are albums with `"smart": true`.
- **Offline albums:** in Lightroom, an album kept on this device shows a small offline icon (a downward arrow, or a
  device or cloud-with-arrow icon) beside its name or photo count, after **Make Available Offline** or **Store
  Album Locally**. Give those albums `"offline": true`, and every other album `"offline": false`. If an icon might
  mean offline but you can't tell, use `false`, set `"uncertain": true` and say so in `"uncertainNote"`.
- **Collapsed folders:** if a folder's triangle points right (closed) the whole time it's on screen, give it
  `"collapsed": true` and `"children": []`. Don't guess what's inside it.
- **Photo counts:** use the number shown at the right of the row. Use `null` when there isn't one or you can't read it.
- **Don't invent anything.** Copy names exactly as shown, including capitals, punctuation, emoji, dates and non-English
  text. If a name is cut off with "…", or blurred by motion, write what you can read, set `"uncertain": true`, and
  say why in `"uncertainNote"`.
- Leave out Lightroom's built-in items that aren't the user's own: Lightroom Classic's **Catalog** panel (All
  Photographs, Quick Collection, Previous Import) and Lightroom's **All Photos**, **Recently Added**, **People**
  and the like. Keep only folders and albums the user made.

## What to write

First, a JSON code block exactly in this shape:

```json
{
  "source": "lightroom-classic",
  "items": [
    {
      "name": "Travel",
      "kind": "folder",
      "path": "Travel",
      "photoCount": null,
      "collapsed": false,
      "children": [
        {
          "name": "Busan, South Korea",
          "kind": "album",
          "path": "Travel/Busan, South Korea",
          "photoCount": 214,
          "smart": false,
          "offline": false,
          "stage": null,
          "notes": ""
        }
      ]
    }
  ]
}
```

- `source` is `"lightroom-classic"` or `"lightroom"`, depending on which app the recording shows. Use `"unknown"` if
  you can't tell.
- `kind` is `"folder"` or `"album"`. Only folders have `children` and `collapsed`. Only albums have `smart`,
  `offline`, `stage` and `notes`.
- `path` is every name from the top of the tree down to this item, joined with `/`. It's how the item will be matched
  again on the next import, so keep it exact.
- Always write `stage` as `null` and `notes` as `""`. The user fills these in later.
- Add `"uncertain": true` and `"uncertainNote": "…"` only to items you're unsure about.

After the JSON, write a short check list in plain text:

1. How many folders and how many albums you found, and how many albums are offline.
2. Every item marked uncertain, with its path and the reason.
3. Any part of the list that scrolled past too quickly to read, or that may be missing (for example, "the video jumps
   from _Japan 2024_ to _Weddings_, so there may be items between them"), with the item names on either side.
