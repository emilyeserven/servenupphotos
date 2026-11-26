import { CornerDownRightIcon } from "lucide-react";
import { type Group, albumDescendants, albumTree } from "@/api/organize";
import { AlbumDeleteCard } from "@/components/album-delete";
import { useAlbumPage } from "@/components/album-page/album-page";
import { AlbumVisibilityCard } from "@/components/album-visibility-card";
import { AboutCard, GroupLink } from "@/components/group-detail/about-card";
import { ParentCard } from "@/components/group-detail/parent-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentPhotos, photoCounts } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";
import { EmptyNote } from "@portfolio/components/empty-note";
import { count } from "@portfolio/lib/words";

/**
 * An album's Info tab: what it is and its parent, beside whether the portfolio shows it, its
 * sub-albums, and deleting it.
 */
export function AlbumInfoTab() {
  const { kind, group, organize } = useAlbumPage();
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-6">
        <AboutCard kind={kind} group={group} organize={organize} />
        {!group.error && <ParentCard kind={kind} group={group} organize={organize} />}
      </div>
      <div className="flex min-w-0 flex-col gap-6">
        <AlbumSideCards album={group} albums={organize.albums} />
      </div>
    </div>
  );
}

/**
 * An album's cards under its parent: whether the portfolio shows it, its sub-albums, and deleting
 * it.
 */
function AlbumSideCards({ album, albums }: { album: Group; albums: Group[] }) {
  return (
    <>
      {!album.error && <AlbumVisibilityCard album={album} albums={albums} />}
      <SubAlbumsCard album={album} albums={albums} />
      {!album.error && <AlbumDelete album={album} albums={albums} />}
    </>
  );
}

/** Every album inside this one, at any depth, each under its parent, with how many photos it has. */
function SubAlbumsCard({ album, albums }: { album: Group; albums: Group[] }) {
  const inside = albumDescendants(albums, album.id);
  // The album's own row comes first; the rest are its sub-albums, one level less deep.
  const rows = albumTree(albums.filter((a) => a.id === album.id || inside.has(a.id))).slice(1);
  const countOf = useAlbumPhotoCounts();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sub-albums{rows.length > 0 && ` (${rows.length})`}</CardTitle>
        <CardDescription>
          Albums inside this one. To add one, give it this album as its parent.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {rows.length === 0 ? (
          <EmptyNote>No sub-albums yet.</EmptyNote>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.map(({ group, depth }) => (
              <SubAlbumRow
                key={group.id}
                album={group}
                depth={depth - 1}
                count={countOf?.(group.id)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** The album's Delete album card, with how many photos list it. */
function AlbumDelete({ album, albums }: { album: Group; albums: Group[] }) {
  const countOf = useAlbumPhotoCounts();
  return <AlbumDeleteCard album={album} albums={albums} photoCount={countOf?.(album.id)} />;
}

/** How many photos in ALLPHOTOS.json list an album, by ID; undefined until it's read. */
function useAlbumPhotoCounts(): ((id: string) => number) | undefined {
  const combined = useCombinedData();
  const current = combined.data ? currentPhotos(combined.data) : undefined;
  if (!current) return undefined;
  const counts = photoCounts(current.photos, "albums");
  return (id) => counts.get(id) ?? 0;
}

function SubAlbumRow({ album, depth, count }: { album: Group; depth: number; count?: number }) {
  return (
    <li
      className="flex items-start gap-2 py-2 first:pt-0 last:pb-0"
      style={{ paddingLeft: `${depth * 1.25}rem` }}
    >
      {depth > 0 && (
        <CornerDownRightIcon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <GroupLink kind="albums" group={album} />
        {album.description && (
          <p className="text-muted-foreground truncate text-xs">{album.description}</p>
        )}
      </div>
      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {photoCountText(count)}
      </span>
    </li>
  );
}

function photoCountText(n?: number): string {
  if (n === undefined) return "…";
  return count(n, "photo");
}
