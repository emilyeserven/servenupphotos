# Copying prompts

Many pipeline pages copy a prompt for an LLM: the bulk pages (tags, places, albums, genres, alt text, pruning tags,
small tags, the tag library, describe my style, Lightroom albums), tag descriptions, localizations, and the sparkle buttons on the
Photo page's Tags and Place fields. The Instagram caption and an uploaded photo's URL copy the same way.

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

This matters when the pipeline runs on another machine, such as a Raspberry Pi reached over Tailscale at
`http://<name>:<port>`: that address isn't a secure context, so step 1 never runs there.

> **Frontend analogy:** a secure context is like a feature flag the browser turns on only for HTTPS and localhost.
> The clipboard, service workers and camera access all sit behind it, so code that uses them needs a fallback for
> plain HTTP.

The pieces are in `components/copy-text.tsx`: `useCopyText` (the copy, the show and the modal), `CopyTextButton`
(an outlined copy button with the show button next to it) and `ShowTextButton`. `CopyPromptButton` in
`components/bulk-tagging/pick-controls.tsx` and the Photo page's `PromptCopyButton` are built on them, so a new
prompt gets the modal by using either.
