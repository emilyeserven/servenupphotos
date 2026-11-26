import { AlbumLayoutCard } from "@/components/album-layout/album-layout-card";
import { useAlbumPage } from "@/components/album-page/album-page";
import { byHand } from "@/components/group-detail/photos-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyNote } from "@portfolio/components/empty-note";

/** An album's Layout tab: its covers and the rows the portfolio shows it in. */
export function AlbumLayoutTab() {
  const { kind, group, organize } = useAlbumPage();
  if (byHand(kind, group)) return <AlbumLayoutCard album={group} albums={organize.albums} />;
  return (
    <Card>
      <CardContent>
        <EmptyNote>
          {group.error
            ? "This album's file couldn't be read, so its layout and covers can't be changed."
            : "No layout or covers for a Smart Album: its rules decide its photos, and the portfolio shows them one after another."}
        </EmptyNote>
      </CardContent>
    </Card>
  );
}
