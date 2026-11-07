# Lightroom Albums

`/lightroom-albums`, under **Workflow** in the sidebar, lists your Lightroom folders and albums (Lightroom Classic's
collection sets and collections, or Lightroom's folders and albums) so you can keep a **stage** and **notes** on
each album, such as which ones are still being culled and which are ready to upload.

## Getting the list

Neither Lightroom has a way in that the pipeline can use. Lightroom's API is only open to approved partner apps
([Lightroom partner APIs](https://github.com/AdobeDocs/lightroom-partner-apis)), and Lightroom Classic's catalog is an
undocumented database that Lightroom locks while it's open. So an LLM reads the list from screenshots instead:

1. Open every folder you want in Lightroom's album panel.
2. Take a screenshot, scroll so the last two or three rows still show at the top, take the next, and so on to the
   bottom. The rows two screenshots share are how the LLM stitches them together without listing an album twice.
3. **Copy the prompt** (`lib/lightroom-albums-prompt.md`) and send it to an LLM with the screenshots, in order.
4. Paste its answer under **Import** and press **Read the list**.

The answer is a JSON tree. Each item has a `path`, every name from the top down joined with `/`, such as
`Travel/Busan, South Korea`. Items the LLM couldn't read clearly come with a note, shown next to the name with a
warning icon, and a folder that was closed in the screenshots says its albums weren't read.

## Importing again

Importing a new list (a fresh LLM answer after you've added albums in Lightroom, say) matches albums by `path`.
**Read the list** says how many albums are new and how many keep their stage and notes, and lists the albums with a
stage or notes that aren't in the new list, since **Use this list** drops them. **Cancel** leaves the page as it was.
Renaming an album or moving it to another folder in Lightroom changes its path, so it's dropped and comes back as
new.

## Stages and notes

Each album has a **Stage** (No stage, Not started, Culling, Editing, Ready to upload, Uploaded, Done) and a notes
box. The buttons above the tree show how many albums are at each stage and, when pressed, only those albums, inside
the folders that hold them.

## Kept on this computer only

The list, stages and notes are kept in this browser's `localStorage` (`stores/lightroom-albums.ts`, under
`pipeline-lightroom-albums`). Nothing on the page calls the backend, R2 or GitHub, and **Commit** never includes it.
To carry on another computer, press **Export**, which downloads `lightroom-albums-<date>.json`, and load that file
under **Import** there. An exported file has the same shape as the LLM's answer plus each album's stage and notes,
so importing it brings those along. **Forget the list** clears it from this browser after asking.

> **Frontend analogy:** this page is a plain client-only Zustand store with `persist`, like a to-do app with no
> server. Export and Import are the "sync": you download the store as JSON and load it into another browser's
> store, where it's merged by key (the album's `path`) instead of overwriting work that's only on that side.
