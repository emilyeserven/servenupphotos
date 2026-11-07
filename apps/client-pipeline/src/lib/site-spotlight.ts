import type { Group, SpotlightOrientation } from "@/api/organize";

/** A spot on the portfolio that shows the photos of the album picked for it. */
export interface SpotlightZone {
  /** What the album JSON's spotlightZones holds, such as "homepage". */
  id: string;
  label: string;
  /** Where the zone's photos show. */
  description: string;
  /** What the portfolio shows there while no album is picked. */
  fallback: string;
  /** Whether the zone fills the homepage, which the preview of a phone and a computer shows. */
  homepage?: boolean;
}

/** Every spotlight zone, in the order the Site Spotlight page lists them. */
export const spotlightZones: SpotlightZone[] = [
  {
    id: "homepage",
    label: "Homepage",
    description: "Fades in and out, one photo at a time, behind the portfolio's homepage.",
    fallback: "No album picked, so the homepage shows the 5 newest photos.",
    homepage: true,
  },
  {
    id: "timeline-header",
    label: "Timeline Header",
    description:
      "Fades in and out, one photo at a time, above the Timeline's title, up to 30% of the screen's height, fading into the page at the bottom.",
    fallback: "No album picked, so the Timeline starts with its title.",
  },
  {
    id: "grid-header",
    label: "Grid Header",
    description:
      "Fades in and out, one photo at a time, above the Grid's title and filters, up to 30% of the screen's height, fading into the page at the bottom.",
    fallback: "No album picked, so the Grid starts with its title.",
  },
];

/** The album picked for the zone, the first that lists it when several do; undefined for none. */
export function zoneAlbum(albums: Group[], zone: string): Group | undefined {
  return albums.find((album) => !album.error && album.spotlightZones?.includes(zone));
}

/** Whether any spotlight zone has an album picked for it. */
export function hasSpotlightAlbum(albums: Group[]): boolean {
  return spotlightZones.some((zone) => zoneAlbum(albums, zone.id) !== undefined);
}

/** Which photos the album puts first in the zone; a zone it saves nothing for matches the screen. */
export function zoneOrientation(album: Group | undefined, zone: string): SpotlightOrientation {
  return album?.spotlightOrientation?.[zone] ?? "screen";
}
