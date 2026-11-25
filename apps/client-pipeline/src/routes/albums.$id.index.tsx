import { createFileRoute } from "@tanstack/react-router";
import { AlbumPhotosTab } from "@/components/album-page/album-photos-tab";
import { AlbumCrumbs } from "@/components/sidebar/route-crumbs";

/** An album page's Photos tab, at the album's own address: its Smart Album card and its photos. */
export const Route = createFileRoute("/albums/$id/")({
  component: AlbumPhotosTab,
  staticData: { wide: true, crumbs: AlbumCrumbs },
});
