import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Group,
  type OrganizeResponse,
  type SpotlightOrientation,
  albumDescendants,
  organizeQuery,
  setSpotlightAlbumMutation,
} from "@/api/organize";
import { GroupPhotoGrid, useGroupPhotos } from "@/components/group-photo-grid";
import { albumPhotoOrder } from "@/lib/album-photo-order";
import { GroupCombobox } from "@/components/group-picker";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotlightOrientationPicker } from "@/components/spotlight-orientation";
import { ZoneFocus } from "@/components/zone-focus";
import {
  type SpotlightZone,
  spotlightZones,
  zoneAlbum,
  zoneOrientation,
} from "@/lib/site-spotlight";

/** Picks the album each spotlight zone of the portfolio shows, such as the homepage's. */
export function SiteSpotlight() {
  const organize = useQuery(organizeQuery);
  return (
    <QueryResult query={organize} pendingLabel="Reading albums from GitHub…">
      {(data) => <Zones organize={data} />}
    </QueryResult>
  );
}

function Zones({ organize }: { organize: OrganizeResponse }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Each spot shows the photos of one album, its sub-albums&apos; included, in the order the
        portfolio gives the album. Picking an album saves the spot in its file&apos;s{" "}
        <code>spotlightZones</code> as a change waiting for <strong>Commit</strong>, from the sync
        button at the top right. Add photos to an album on the Gallery or a photo&apos;s page.
      </p>
      {spotlightZones.map((zone) => (
        <ZoneCard key={zone.id} zone={zone} albums={organize.albums} />
      ))}
    </div>
  );
}

/** One zone: a picker for its album, and the photos the zone shows from it. */
function ZoneCard({ zone, albums }: { zone: SpotlightZone; albums: Group[] }) {
  const queryClient = useQueryClient();
  const save = useMutation({
    ...setSpotlightAlbumMutation,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: organizeQuery.queryKey }),
  });
  const album = zoneAlbum(albums, zone.id);
  const id = `spotlight-${zone.id}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{zone.label}</CardTitle>
        <CardDescription>{zone.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex max-w-md flex-col gap-1.5">
          <label htmlFor={id} className="font-medium">
            Album
          </label>
          <GroupCombobox
            id={id}
            kind="albums"
            multiple={false}
            value={album ? [album.id] : []}
            disabled={save.isPending}
            placeholder="No album"
            onChange={(next) => save.mutate({ zone: zone.id, album: next[0] ?? null })}
          />
          {save.isError && <p className="text-destructive">{save.error.message}</p>}
        </div>
        {album ? (
          <ZoneAlbum
            album={album}
            albums={albums}
            zone={zone}
            saving={save.isPending}
            onOrientation={(orientation) =>
              save.mutate({ zone: zone.id, album: album.id, orientation })
            }
          />
        ) : (
          <p className="text-muted-foreground">{zone.fallback}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface ZoneAlbumProps {
  album: Group;
  albums: Group[];
  zone: SpotlightZone;
  saving: boolean;
  onOrientation: (orientation: SpotlightOrientation) => void;
}

/** The zone's album: which of its photos come first, and the photos the zone shows from it. */
function ZoneAlbum({ album, albums, zone, saving, onOrientation }: ZoneAlbumProps) {
  return (
    <>
      <SpotlightOrientationPicker
        value={zoneOrientation(album, zone.id)}
        disabled={saving}
        onPick={onOrientation}
      />
      <AlbumPhotos album={album} albums={albums} zone={zone} />
    </>
  );
}

interface AlbumPhotosProps {
  album: Group;
  albums: Group[];
  zone: SpotlightZone;
}

/**
 * The photos in album and its sub-albums, in the order the zone shows them, to pick one and set
 * its focus point in the zone; or why there are none.
 */
function AlbumPhotos({ album, albums, zone }: AlbumPhotosProps) {
  const ids = new Set([album.id, ...albumDescendants(albums, album.id)]);
  const { combined, photos } = useGroupPhotos("albums", ids);
  if (!photos?.length) return <GroupPhotoGrid combined={combined} photos={photos} />;
  return <ZoneFocus zone={zone} photos={albumPhotoOrder(photos, album.photoOrder)} />;
}
