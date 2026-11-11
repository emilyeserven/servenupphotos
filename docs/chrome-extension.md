# Edit in Pipeline (Chrome extension)

A small Chrome extension whose toolbar button, on any page of the portfolio, opens the pipeline at the page that edits
what that page shows: the photo editor for a photo, an album's page for an album, Places for a map page, and so on. It
uses [Quick Edit](quick-edit.md)'s matching, so the two always agree.

## Getting it

**Settings** (`/settings`) has an **Edit in Pipeline (Chrome extension)** card with **Download extension** and the
steps to install it: unzip, open `chrome://extensions`, turn on **Developer mode**, **Load unpacked** and pick the
`servenup-edit-in-pipeline` folder, then pin it. To update it, replace the folder's files and click the extension's
reload arrow.

The zip is made in the page (`lib/chrome-extension.ts`, zipped by `lib/zip.ts`) for the pipeline at the page's own
address (`location.origin`), which is written into the extension's `background.js`. So it works however the pipeline
is opened, including over plain HTTP on `localhost` or a local network address: the download is a `blob:` link, and
nothing in it needs HTTPS (no `crypto.subtle` or clipboard). Opening the pipeline at another address means downloading
the extension again.

> **Frontend analogy:** it's like a "Download config" button that builds a JSON file with `new Blob()` and
> `URL.createObjectURL()` instead of fetching one from the server, with the app's own URL filled in.

## What the button does

The extension has two files: `manifest.json` (Manifest V3, permissions `activeTab` and `declarativeContent`, so it can
read no page until clicked and adds no warning on install) and `background.js`, its service worker. The button is
greyed out except on `servenupphotos.net` (and `www.`), `localhost` and `127.0.0.1`. A click opens, in a new tab next
to the current one:

```
<pipeline>/quick-edit?url=<the tab's link>
```

The pipeline's `/quick-edit` page (`routes/quick-edit.tsx`) runs `quickEditTarget` on `url` before it draws and
redirects straight to its page, so the click lands on the editor. A link with nothing to edit, such as
`/grid?size=large`, stays on `/quick-edit` with the link, why it can't open, and Quick Edit's field to paste another.

> **Frontend analogy:** `/quick-edit` is a redirect route, like a `beforeLoad` that throws `redirect()` for an old URL;
> the extension only builds the link to it.
