import type { Group } from "@/api/organize";

/** A spot on the portfolio that shows the photos of the album picked for it. */
export interface SpotlightZone {
  /** What the album JSON's spotlightZones holds, such as "homepage". */
  id: string;
  label: string;
  /** Where the zone's photos show. */
  description: string;
  /** What the portfolio shows there while no album is picked. */
  fallback: string;
}

/** Every spotlight zone, in the order the Site Spotlight page lists them. */
export const spotlightZones: SpotlightZone[] = [
  {
    id: "homepage",
    label: "Homepage",
    description: "Fades in and out, one photo at a time, behind the portfolio's homepage.",
    fallback: "No album picked, so the homepage shows the 5 newest photos.",
  },
];

/** The album picked for the zone, the first that lists it when several do; undefined for none. */
export function zoneAlbum(albums: Group[], zone: string): Group | undefined {
  return albums.find((album) => !album.error && album.spotlightZones?.includes(zone));
}
