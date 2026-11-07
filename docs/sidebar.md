# Sidebar

The pipeline's sidebar (`components/app-sidebar.tsx`, with its parts in `components/sidebar/`) starts with the
**Photo Pipeline** logo, which opens the Status page (`/`), and the split **Bulk Upload** button: its main part opens
the Bulk Upload modal, and the smaller **Upload** icon on its right uploads one photo. The Bulk Upload page
(`/bulk-upload`) has no sidebar link of its own; it's linked from the upload queue and the Photo page.

Below them every page is listed under its section:

| Section       | Pages (submenu pages in parentheses)                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Images        | Photo, Gallery                                                                                                                                      |
| Pipeline      | Photos in Flight, Compare, Lightroom Albums                                                                                                         |
| Organize      | Albums (Album Suggestions), Tags (Small Tags, Tag Data), Genres (Genre Suggestions), Places (Location Names, Bulk Places, Localizations)            |
| Publish       | Instagram (Planned Posts, Caption Templates), Site Spotlight, User Likes                                                                            |
| Configuration | Settings (Status, Explore Bucket, Manage Sizes), Update Data (each of its subpages), Metadata Groups, Camera Overrides, Timeline Labels, Trip Lines |

## Submenus

A page with pages under it, such as **Tags**, has an arrow on its right. On a desktop, hovering it (or focusing it
with the keyboard) flies its submenu out to the right: the page itself, then the pages under it
(`components/sidebar/nav-flyout.tsx`), whether the sidebar is expanded or collapsed to icons. The page stays
highlighted while one of its submenu pages is open. On a phone, where there's no hover, the submenu is listed under
the page instead, open while the page or one in its submenu is showing, and the arrow shows or hides it.

A submenu page keeps its own URL (Explore Bucket is still `/bucket`); it only sits under another in the sidebar and
the breadcrumbs, which read **Organize › Tags › Small Tags**, with the middle page a link back to it. On a phone only
the open page shows in the breadcrumbs.

The pages, their icons and their submenus are `navGroups` in `components/sidebar/nav-groups.ts`; a new page needs one
entry there, with an icon, and its `url` is checked against the route tree.

> **Frontend analogy:** it's one nested config array that both the sidebar and the breadcrumbs map over, like a
> `routes` config in a router that also drives the menu.

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
