import { Link } from "@tanstack/react-router";
import type { SocialCalendar, SocialPhoto } from "@/api/publish";
import { PhotoFiles } from "@/components/photo-files";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type Spotlight, useSpotlight } from "@/components/use-spotlight";
import { type SpotlightZone, placeInZone, spotlightZones, zonePhotos } from "@/lib/site-spotlight";

/**
 * The Photo page's card for the spotlight zones the photo at path is in, such as the homepage's,
 * each a checkbox. Like Site Spotlight's changes, they're kept in the app until **Commit**, apart
 * from the page's own Save changes; a photo put in a zone goes to the end of its order.
 */
export function SpotlightCard({ path }: { path: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Spotlight</CardTitle>
        <CardDescription>
          The spots on the portfolio that show this photo. Changes are kept in the app until you{" "}
          <strong>Commit</strong>, without Save changes. A photo you add goes to the end; change the
          order on{" "}
          <Link to="/site-spotlight" className="underline underline-offset-4">
            Site Spotlight
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent>
        <PhotoFiles>{(files) => <ZoneChoices files={files} path={path} />}</PhotoFiles>
      </CardContent>
    </Card>
  );
}

function ZoneChoices({ files, path }: { files: SocialCalendar; path: string }) {
  const spotlight = useSpotlight(files.photos);
  const photo = files.photos.find((p) => p.path === path);
  if (!photo) {
    return (
      <p className="text-muted-foreground text-sm">
        This photo&apos;s file wasn&apos;t among the photo files read. Save it first.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {spotlightZones.map((zone) => (
        <ZoneChoice
          key={zone.id}
          zone={zone}
          photo={photo}
          photos={files.photos}
          spotlight={spotlight}
        />
      ))}
    </ul>
  );
}

interface ZoneChoiceProps {
  zone: SpotlightZone;
  photo: SocialPhoto;
  photos: SocialPhoto[];
  spotlight: Spotlight;
}

/** One zone's checkbox, with the photo's place among the zone's photos while it's in it. */
function ZoneChoice({ zone, photo, photos, spotlight }: ZoneChoiceProps) {
  const { unsaved, order, toggle } = spotlight;
  const place = placeInZone(photos, unsaved, order, zone.id, photo.path);
  const count = zonePhotos(photos, unsaved, order, zone.id).length;
  const id = `spotlight-${zone.id}`;
  return (
    <li className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={place !== null}
        onChange={(event) => toggle(photo, zone.id, event.target.checked)}
      />
      <label htmlFor={id} className="flex flex-col gap-0.5 text-sm">
        <span className="font-medium">{zone.label}</span>
        <span className="text-muted-foreground">
          {place === null ? zone.description : `Number ${place} of ${count}.`}
        </span>
      </label>
    </li>
  );
}
