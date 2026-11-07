# Lightroom Albums

`/lightroom-albums`, under **Workflow** in the sidebar, lists your Lightroom folders and albums (Lightroom Classic's
collection sets and collections, or Lightroom's folders and albums) so you can keep a **stage** and **notes** on
each album, such as which ones are still being culled and which are ready to upload. Getting the list from
Lightroom, and Export and Import, are on a page of their own, **Lightroom Albums › Import**
(`/lightroom-albums/import`), opened with **Import or export** at the top of the page. The breadcrumb shows a page
under a sidebar page from its route's `staticData.crumbs` ([Sidebar › Breadcrumbs](sidebar.md#breadcrumbs)).

## Getting the list

Neither Lightroom has a way in that the pipeline can use. Lightroom's API is only open to approved partner apps
([Lightroom partner APIs](https://github.com/AdobeDocs/lightroom-partner-apis)), and Lightroom Classic's catalog is an
undocumented database that Lightroom locks while it's open. So an LLM reads the list from screenshots or a screen
recording instead, picked with the **Screenshots / Screen recording** switch on the Import page's prompt card:

1. Open every folder you want in Lightroom's album panel.
2. Capture the list:
   - **Screenshots:** take one, scroll so the last two or three rows still show at the top, take the next, and so on
     to the bottom. The rows two screenshots share are how the LLM stitches them together without listing an album
     twice. Cheaper to send than a video.
   - **Screen recording:** record while you scroll slowly to the bottom, pausing on each screenful. Needs an LLM that
     reads video.
3. Copy the prompt (`lib/lightroom-albums-prompt.md` for screenshots, `lib/lightroom-albums-recording-prompt.md` for a
   recording) and send it to an LLM with the screenshots, in order, or the recording. Both prompts ask for the same
   JSON, so both answers import the same way.
4. Paste its answer under **Import** and press **Read the list**. **Use this list** goes back to Lightroom Albums.

The answer is a JSON tree. Each item has a `path`, every name from the top down joined with `/`, such as
`Travel/Busan, South Korea`. Items the LLM couldn't read clearly come with a note, shown next to the name with a
warning icon, and a folder that was closed in the screenshots or recording says its albums weren't read. An album Lightroom keeps
on the device (**Make Available Offline**, shown in Lightroom with a small offline icon) comes back with
`"offline": true` and gets a blue **Offline** mark on the page; the Albums card says how many there are.

## Importing again

Importing a new list (a fresh LLM answer after you've added albums in Lightroom, say) matches albums by `path`.
**Read the list** says how many albums are new and how many keep their stage and notes, and lists the albums with a
stage or notes that aren't in the new list, since **Use this list** drops them. **Cancel** leaves the page as it was.
Albums [added by hand](#adding-albums-by-hand) that aren't in the new list are kept, put back in their folder.
Renaming an album or moving it to another folder in Lightroom changes its path, so it's dropped and comes back as
new.

## Folders

In the tree, a folder opens and closes from its name, which shows how many albums are inside it. **Expand all** and
**Collapse all** open or close every folder. Which folders are closed is remembered in the browser. Albums with no
parent folder are grouped after the folders under an italic _No Parent_, which opens and closes like a folder.

## Changing an album's parent

Each album in the tree has a **Parent** select under its stage: **No parent**, every folder there is, or **New
folder…**, which asks for a path such as `Travel/Korea` and makes the folders it needs (`moveAlbum` in
`lib/lightroom-tree.ts`). A folder that already has something with the album's name refuses the move with a message.
Folders a move leaves empty stay, as they do in Lightroom.

A moved album read from Lightroom keeps where Lightroom has it as `lightroomPath`. A new import matches it by that
path, so it keeps its stage and notes and stays where you moved it, unless the import already has something at the
moved path. Moving it back to where Lightroom has it drops `lightroomPath`.

> **Frontend analogy:** like a React list keyed by a stable ID rather than by index: the album's position (`path`)
> can change on the page, but `lightroomPath` is the key the next import reconciles against.

## Adding albums by hand

**Add album**, on the Albums card, adds an album the LLM missed or one not made in Lightroom yet: its name, its
folder (pick one that's there, type a new path such as `Travel/Japan`, which makes the folders it needs, or leave it
empty for the top), its photo count and whether it's offline. It can't share a path with a folder or album already
there. It's marked **Added by hand**, has a **Remove** button, and is saved with `"manual": true`, so importing a new
list keeps it (`lib/lightroom-tree.ts`). With no list yet, adding an album starts one.

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
each stage (Cull Round 1 to Re-editing, then No stage), leaving out albums that are Done or that Lightroom shows with 0 photos (an album whose count wasn't read stays in) (`lib/lightroom-next-up.ts`):

- **Overall** puts the albums furthest along first, so an album you've started gets finished before a new one begins,
  and the ones with no stage last.
- At the same stage, and in each stage's list, the album with fewer photos comes first, as the quicker one to finish.
  Albums whose photo count wasn't read go after the ones with a count.

The [Dashboard](dashboard.md) shows the same lists, Overview or one stage at a time.

The **Online / Offline** switch (remembered in the browser) says whether you have the internet. **Offline** suggests
only the albums Lightroom keeps on the device, the ones with the **Offline** mark, and leaves the mark off them
there, since every suggestion is offline.

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
