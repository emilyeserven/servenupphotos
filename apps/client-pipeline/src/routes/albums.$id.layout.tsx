import { createFileRoute } from "@tanstack/react-router";
import { AlbumLayoutTab } from "@/components/album-page/album-layout-tab";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";

/** An album page's Layout tab: its layout and covers. */
export const Route = createFileRoute("/albums/$id/layout")({
  component: AlbumLayoutTab,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});
