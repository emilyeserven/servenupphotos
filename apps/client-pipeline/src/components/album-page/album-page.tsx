import { Outlet } from "@tanstack/react-router";
import { createContext, useContext } from "react";
import { AlbumTabs } from "@/components/album-page/album-tabs";
import { type GroupDetailProps, GroupDetailPage } from "@/components/group-detail";

const AlbumContext = createContext<GroupDetailProps | undefined>(undefined);

/**
 * One album's page: its name, then the Photos, Info and Layout tabs, each its own address under
 * `/albums/<id>`, with the open tab's cards under them once the album is read.
 */
export function AlbumPage({ id }: { id: string }) {
  return (
    <GroupDetailPage kind="albums" id={id} tabs={<AlbumTabs id={id} />}>
      {(found) => (
        <AlbumContext.Provider value={found}>
          <Outlet />
        </AlbumContext.Provider>
      )}
    </GroupDetailPage>
  );
}

/** The album the open tab shows, with every album, tag and genre; only inside `AlbumPage`. */
export function useAlbumPage(): GroupDetailProps {
  const found = useContext(AlbumContext);
  if (!found) throw new Error("An album tab is only shown inside its album's page.");
  return found;
}
