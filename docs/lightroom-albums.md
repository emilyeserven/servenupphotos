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
warning icon, and a folder that was closed in the screenshots says its albums weren't read. An album Lightroom keeps
on the device (**Make Available Offline**, shown in Lightroom with a small offline icon) comes back with
`"offline": true` and gets a blue **Offline** mark on the page; the Albums card says how many there are.

## Importing again

Importing a new list (a fresh LLM answer after you've added albums in Lightroom, say) matches albums by `path`.
**Read the list** says how many albums are new and how many keep their stage and notes, and lists the albums with a
stage or notes that aren't in the new list, since **Use this list** drops them. **Cancel** leaves the page as it was.
Renaming an album or moving it to another folder in Lightroom changes its path, so it's dropped and comes back as
new.

## Stages and notes

Each album has a **Stage** (No stage, Cull Round 1, Cull Round 2, Cropping, Editing, Re-editing, Done) and notes.
The Albums card shows them two ways, switched with **Tree** and **Board** (remembered in the browser):

- **Tree:** Lightroom's folders with each album's notes box and stage. The buttons above it show how many albums are
  at each stage and, when pressed, only those albums, inside the folders that hold them.
- **Board:** a Kanban board with a lane for each stage, left to right, and a **No stage** lane first. Each album is
  a card with its folder, marks and notes; drag it to another lane, or pick a stage on the card, to move it. The
  board scrolls sideways when the lanes don't fit.

A list saved before the board's lanes is read again when the page opens: **Culling** becomes **Cull Round 1**,
**Editing** and **Done** stay, and the stages that aren't lanes any more (Not started, Ready to upload, Uploaded)
become No stage.

## Next up

Once there's a list, a **Next up** panel at the top of the page suggests 3 albums to work on **Overall** and 3 at
each stage (Cull Round 1 to Re-editing, then No stage), leaving out albums that are Done (`lib/lightroom-next-up.ts`):

- **Overall** puts the albums furthest along first, so an album you've started gets finished before a new one begins,
  and the ones with no stage last.
- At the same stage, and in each stage's list, the album with fewer photos comes first, as the quicker one to finish.
  Albums whose photo count wasn't read go after the ones with a count.

The **Online / Offline** switch (remembered in the browser) says whether you have the internet. **Offline** suggests
only the albums Lightroom keeps on the device, the ones with the **Offline** mark.

> **Frontend analogy:** it's a derived selector over the store, like
> `albums.filter(notDone).toSorted(byStageDesc || bySize).slice(0, 3)`, recomputed on every render, with the
> Online / Offline switch as one more filter in front of it.

## Kept on this computer only

The list, stages and notes are kept in this browser's `localStorage` (`stores/lightroom-albums.ts`, under
`pipeline-lightroom-albums`). Nothing on the page calls the backend, R2 or GitHub, and **Commit** never includes it.
To carry on another computer, press **Export**, which downloads `lightroom-albums-<date>.json`, and load that file
under **Import** there. An exported file has the same shape as the LLM's answer plus each album's stage and notes,
so importing it brings those along. **Forget the list** clears it from this browser after asking.

> **Frontend analogy:** this page is a plain client-only Zustand store with `persist`, like a to-do app with no
> server. Export and Import are the "sync": you download the store as JSON and load it into another browser's
> store, where it's merged by key (the album's `path`) instead of overwriting work that's only on that side.
