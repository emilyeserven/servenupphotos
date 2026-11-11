# Sidebar

The pipeline's sidebar (`components/app-sidebar.tsx`, with its parts in `components/sidebar/`) starts with the
**Photo Pipeline** logo, which opens the Status page (`/`), and the split **Bulk Upload** button: its main part opens
the Bulk Upload modal, and the smaller **Upload** icon on its right uploads one photo. The Bulk Upload page
(`/bulk-upload`) has no sidebar link of its own; it's linked from the upload queue and the Photo page.

Below them every page is listed under its section, with the pages in its submenu under it. One page per line here, so
branches that add pages don't clash:

- **Images**
  - Photo
    - Alt Text
  - Gallery
  - All Photos
- **Pipeline**
  - Photos in Flight
  - Compare
  - Lightroom Albums
- **Organize**
  - Albums
    - Album Suggestions
  - Tags
    - Small Tags
    - Tools: Bulk tagging, Tag library, Tag pruning, Tag descriptions
  - Genres
    - Genre Suggestions
  - Places
    - Location Names
    - Bulk Places
    - Localizations
- **Publish**
  - Instagram
    - Planned Posts
  - Captions (the Caption Templates page)
  - Photo Book
  - Site Spotlight
  - Related Photos
  - User Likes
- **Configuration**
  - Settings
    - Status
    - Changelog
    - Explore Bucket
    - Manage Sizes
  - Update Data (each of its subpages)
  - Metadata Groups
  - Camera Overrides
  - Trip Lines

## Submenus

A page with pages under it, such as **Tags**, has an arrow on its right. On a desktop, hovering it (or focusing it
with the keyboard) flies its submenu out to the right: the page itself, then the pages under it
(`components/sidebar/nav-flyout.tsx`), whether the sidebar is expanded or collapsed to icons. The page stays
highlighted while one of its submenu pages is open. A submenu page can start a group under a small header, as the
tag tools do under **Tools** in the Tags submenu (`heading` on the page in `navGroups`). On a phone, where there's no hover, the submenu is listed under
the page instead, open while the page or one in its submenu is showing, and the arrow shows or hides it.

A submenu page keeps its own URL (Explore Bucket is still `/bucket`); it only sits under another in the sidebar and
the breadcrumbs, which read **Organize › Tags › Small Tags**, with the middle page a link back to it.

The pages, their icons and their submenus are `navGroups` in `components/sidebar/nav-groups.ts`; a new page needs one
entry there, with an icon, and its `url` is checked against the route tree.

> **Frontend analogy:** it's one nested config array that both the sidebar and the breadcrumbs map over, like a
> `routes` config in a router that also drives the menu.

## Breadcrumbs

The header's breadcrumbs start with the open page's sidebar section and page, and a route adds its own after them with
`staticData.crumbs` (`components/sidebar/route-crumbs.tsx`). Every breadcrumb but the last links back to its page;
on a phone only the last shows.

| Page                          | Breadcrumbs                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| An album, tag or genre        | **Organize › Albums › Japan › Tokyo** (an album's parents link)  |
| A day's page on Trip Lines    | **Configuration › Trip Lines › Thu, Oct 1, 2026 › Route**        |
| A Trip                        | **Configuration › Trip Lines › Trips › Japan**                   |
| Trip Lines' Trips tab         | **Configuration › Trip Lines › Trips**                           |
| Lightroom Albums' Import page | **Pipeline › Lightroom Albums › Import**                         |
| Dashboard, Bulk Upload        | **Dashboard**, **Bulk Upload** (the sidebar's header opens them) |

A route's `crumbs` is a small component that reads what it needs, such as the album's name, and hands the list to
the breadcrumbs, so a name shows as soon as the data is read (the ID until then). `fixedCrumbs("Import")` makes one
for names that never change.

> **Frontend analogy:** it's a render prop: the route supplies a component that calls its own hooks and passes its
> crumbs to a callback, so the header never calls a hook that changes from page to page.

## Collapsing

**Collapse sidebar** at the bottom of the sidebar, **Ctrl+B** (**⌘B** on a Mac), or a click on the sidebar's right
edge collapses it to a rail of icons, and the same again expands it (the button becomes **Expand sidebar**, an icon
at the bottom of the rail). Collapsed:

- each page shows only its icon, and hovering it shows the page's name in a tooltip;
- the group names are hidden;
- Bulk Upload and Upload become two stacked icon buttons that open the same modals;
- hovering the icon of a page with a submenu flies the submenu out, in place of the name tooltip.

The choice is kept in the browser's `localStorage` under `pipeline-sidebar` (`stores/sidebar.ts`), so the sidebar
stays collapsed or expanded after a reload.

> **Frontend analogy:** it's a Zustand store with `persist`, passed to shadcn's `SidebarProvider` as a controlled
> `open` / `onOpenChange` pair, the same way you'd control a `<Dialog>`.

On a phone the sidebar is a sheet over the page instead. The button left of the breadcrumbs, shown only there, opens
it; it always shows in full, so it has no collapse button.

**Theme**, just above **Collapse sidebar**, switches between light, dark and system colors ([Theme](theme.md)).

## Tab titles

Each page names the browser tab after itself, such as **Gallery · Photo Pipeline** (`components/page.tsx`). A page
about one photo puts the photo's name first, so tabs open on different photos can be told apart: the photo editor
(**Edit Photo**) shows **Amsterdam Canal · Edit Photo · Photo Pipeline**, following the title as it's typed, and the
Photo page does the same once a new photo is analyzed. A photo without a title is named by its file name without the
extension. The photo's name lives in `stores/tab-title.ts`: the page part sets it with `useTabSubject` and clears it
when it unmounts.
