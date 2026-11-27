import { relationLocalizationId, savedPlaces } from "@/api/places";
import { textOf } from "@portfolio/lib/values";

/** A photo's country and places, as relation words are counted from them. */
interface RelationPhoto {
  country?: unknown;
  customCountry?: unknown;
  places?: unknown;
}

/** A relation word the photos use with their places in one country, and how many photos do. */
export interface RelationUse {
  /** Its localization's ID, such as `relation-near-japan`. */
  id: string;
  word: string;
  country: string;
  photos: number;
}

/**
 * Each relation word the photos use with their places, once per country (the custom one, or else
 * the EXIF one), since a word is written one way in Japan and another in South Korea. A comma isn't
 * a word, and a photo with no country has none.
 */
export function relationUses(photos: readonly object[]): RelationUse[] {
  const uses = new Map<string, RelationUse>();
  for (const photo of photos as RelationPhoto[]) {
    const country = textOf(photo.customCountry) || textOf(photo.country);
    const words = savedPlaces(photo.places).map((place) => place.relation);
    for (const word of new Set(words.filter((w) => w && w !== "," && country))) {
      const id = relationLocalizationId(word, country);
      const use = uses.get(id) ?? { id, word, country, photos: 0 };
      use.photos++;
      uses.set(id, use);
    }
  }
  return [...uses.values()];
}
