import { createFileRoute } from "@tanstack/react-router";
import { AlbumInfoTab } from "@/components/album-page/album-info-tab";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";

/** An album page's Info tab: about it, its parent, whether the portfolio shows it, its sub-albums and deleting it. */
export const Route = createFileRoute("/albums/$id/info")({
  component: AlbumInfoTab,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});
