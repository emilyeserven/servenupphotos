import { useAlbumPage } from "@/components/album-page/album-page";
import { GroupPhotosCard, isReadableAlbum } from "@/components/group-detail";
import { SmartAlbumCard } from "@/components/smart-album/smart-album-card";

/** An album's Photos tab: its Smart Album rules, then the photos in it. */
export function AlbumPhotosTab() {
  const { kind, group, organize } = useAlbumPage();
  return (
    <>
      {isReadableAlbum(kind, group) && <SmartAlbumCard album={group} />}
      <GroupPhotosCard kind={kind} group={group} albums={organize.albums} />
    </>
  );
}
