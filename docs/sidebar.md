# Sidebar

The pipeline's sidebar (`components/app-sidebar.tsx`) lists every page under its group (Pipeline, Organize, Publish,
Configuration), with the split **Upload** / **Bulk Upload** button at the top.

## Collapsing

The button left of the breadcrumbs, **Ctrl+B** (**⌘B** on a Mac), or a click on the sidebar's right edge collapses
it to a rail of icons, and the same again expands it. Collapsed:

- each page shows only its icon, and hovering it shows the page's name in a tooltip;
- the group names are hidden;
- Upload and Bulk Upload become two stacked icon buttons that open the same modals.

The choice is kept in the browser's `localStorage` under `pipeline-sidebar` (`stores/sidebar.ts`), so the sidebar
stays collapsed or expanded after a reload.

> **Frontend analogy:** it's a Zustand store with `persist`, passed to shadcn's `SidebarProvider` as a controlled
> `open` / `onOpenChange` pair, the same way you'd control a `<Dialog>`.

On a phone the sidebar is a sheet over the page instead; the same button opens and closes it, and it always shows in
full.

Each page's icon is set next to its title and URL in `navGroups`; a new page needs one.
