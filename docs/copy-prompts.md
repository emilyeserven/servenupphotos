# Copying prompts

Many pipeline pages copy a prompt for an LLM: the bulk pages (tags, places, albums, genres, alt text, pruning tags,
small tags, the tag library, describe my style, Lightroom albums), tag descriptions, localizations, and the sparkle buttons on the
Photo page's Tags and Place fields. The Instagram caption and an uploaded photo's URL copy the same way.

The prompts that link many photos (Autogroup, Bulk Tagging, Genre Suggestions, Bulk Places and the
[Quality Check](quality-check.md)'s pixelation prompt) can link
[contact sheets](contact-sheets.md) of them too.

## Copy, or show it in a modal

Every copy button sits next to a small **Show the prompt** button (a scroll icon) that opens the whole prompt in a
modal, in a read-only box that is selected as soon as the modal opens, with its own **Copy** button. The caption and
the URL leave it out, since their pages already show the text.

Copying uses `copyText` (`lib/copy-text.ts`):

1. The Clipboard API, `navigator.clipboard.writeText`. Browsers only offer it in a _secure context_: HTTPS, or
   `localhost`.
2. When that's missing or refused, the older `document.execCommand("copy")` on a hidden text box, which still works
   over plain HTTP in today's browsers.
3. When both fail, the button opens the modal instead, so the text can be copied by hand (Ctrl+C, or ⌘C on a Mac).

On a phone or tablet (a touch screen with no mouse, `(pointer: coarse)`) over plain HTTP, step 2 is skipped and the
button opens the modal straight away, because iOS Safari can answer that it copied when nothing reached the clipboard.
In the modal, **Copy** runs the copy command on the box on screen, in the same tap, and shows "Copied" without
closing the modal, so the text can still be copied by hand if it didn't work: press and hold it, choose **Select
All**, then **Copy**. The box selects its text with `setSelectionRange`, since iOS ignores `select()` on a read-only
box.

This matters when the pipeline runs on another machine, such as a Raspberry Pi reached over Tailscale at
`http://<name>:<port>`: that address isn't a secure context, so step 1 never runs there.

> **Frontend analogy:** a secure context is like a feature flag the browser turns on only for HTTPS and localhost.
> The clipboard, service workers and camera access all sit behind it, so code that uses them needs a fallback for
> plain HTTP.

The pieces are in `components/copy-text.tsx`: `useCopyText` (the copy, the show and the modal), `CopyTextButton`
(an outlined copy button with the show button next to it) and `ShowTextButton`. `CopyPromptButton` in
`components/bulk-tagging/pick-controls.tsx` and the Photo page's `PromptCopyButton` are built on them, so a new
prompt gets the modal by using either.

## Pasting the answer

An answer copied out of a chat app often has curly double quotes (“ ”) around its keys and values instead of straight
ones, which isn't JSON. Every box that takes a pasted LLM answer reads it as it is first, and only when that fails
reads it again with every curly double quote made straight. Curly single quotes (‘ ’) are left as they are, since
the words inside the values use them. An answer that already reads keeps any curly double quotes inside its values.

### Photos outside the batch

An answer doesn't have to be about the photos the page picked. On Bulk Tagging, Bulk Places, album and genre
suggestions, alt text, Autogroup and the pixelation check, a photo the answer names that wasn't picked (or isn't in
the prompt) is looked up by its JSON file's name among every photo and reviewed after the picked ones, so an answer
copied for an earlier batch still applies to the photos it names. A picked photo the answer doesn't name is left as it
is, and a name that isn't any photo's is listed as skipped rather than failing the whole answer.

The backend previews use `answeredPhotos` (`github/answered.go`), which add the photos they find to the preview's
`photos` and return them in `others` for the review's titles and images (`withOthers` in `lib/answered-photos.ts`).
Bulk Places reads its answer in the page, so it asks `POST /api/data/photos-by-name` for the photos it didn't pick;
Autogroup and the pixelation check already have every photo in the page.

> **Frontend analogy:** it's like a form that accepts a pasted JSON patch keyed by ID: instead of rejecting the patch
> when it mentions rows that aren't on the current page, it fetches those rows and shows them in the diff too.

The answers read in the page (Place, tag descriptions, localizations, Autogroup, the pixelation check, Bulk Places,
Lightroom albums, an album layout, viewer likes) use `parsePastedJson` (`lib/pasted-json.ts`); the ones the backend
reads (Bulk Tagging, tag pruning, the tag library, album and genre suggestions, alt text) use `parseLLMAnswer`
(`github/llmanswer.go`).

> **Frontend analogy:** it's a `try { JSON.parse(text) } catch { JSON.parse(text.replace(/[“”]/g, '"')) }`, so a
> paste that was already fine is never changed.
