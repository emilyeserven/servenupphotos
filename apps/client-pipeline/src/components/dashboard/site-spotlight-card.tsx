import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type Group, organizeQuery } from "@/api/organize";
import { QueryResult } from "@/components/query-result";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { longDayFormat, parseIsoDate } from "@/lib/calendar";
import { type SpotlightZone, spotlightZones, zoneAlbum } from "@/lib/site-spotlight";

/** When each Site Spotlight zone was last given its album, and which album it shows. */
export function SiteSpotlightCard() {
  const organize = useQuery(organizeQuery);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Link to="/site-spotlight" className="hover:underline">
            Site Spotlight
          </Link>
        </CardTitle>
        <CardDescription>When each spot on the portfolio last got a new album.</CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={organize} pendingLabel="Reading albums…">
          {(data) => (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              {spotlightZones.map((zone) => (
                <ZoneRow key={zone.id} zone={zone} albums={data.albums} />
              ))}
            </dl>
          )}
        </QueryResult>
      </CardContent>
    </Card>
  );
}

/** One zone's album and the day it was picked. */
function ZoneRow({ zone, albums }: { zone: SpotlightZone; albums: Group[] }) {
  const album = zoneAlbum(albums, zone.id);
  return (
    <>
      <dt className="text-muted-foreground">{zone.label}</dt>
      <dd>{album ? <ZoneAlbum album={album} zone={zone.id} /> : "No album picked."}</dd>
    </>
  );
}

function ZoneAlbum({ album, zone }: { album: Group; zone: string }) {
  const day = album.spotlightUpdated?.[zone];
  return (
    <>
      <p className="font-medium">{album.name}</p>
      <p className="text-muted-foreground">
        {day
          ? `Updated ${longDayFormat.format(parseIsoDate(day))}`
          : "Picked before dates were kept"}
        {album.inFlight && ", waiting for Commit or the pull request to merge"}.
      </p>
    </>
  );
}
