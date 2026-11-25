import type { FilterOption } from "@portfolio/lib/filter-options";

/** Someone who sent the photographer their Like list, as the pipeline's User Likes page keeps them. */
export interface Liker {
  /** Their ID, such as "jane", made from their name when they were added. */
  id: string;
  /** Their name, such as "Jane". */
  name: string;
}

/**
 * The Likes filter's value for the photos anyone liked, `?liked=_anyone`. A person's ID never
 * starts with "_", so no one's list can be mistaken for it.
 */
const ANYONE = "_anyone";

/** Whether the photo is in the person's Like list, or in anyone's for {@link ANYONE}. */
export function likedBy(photo: { likedBy?: Liker[] }, value: string): boolean {
  const likers = photo.likedBy ?? [];
  return value === ANYONE ? likers.length > 0 : likers.some((liker) => liker.id === value);
}

/** The same name every way, as a person's name isn't localized. */
function named(name: string) {
  return { english: name, romanized: name, phonetic: name, native: name };
}

/**
 * The Likes filter's choices: **Liked by anyone**, then under it each person whose list has any
 * of `facet`, with how many of those photos each liked. None when no photo says who liked it, as
 * on the portfolio, which doesn't read the Like lists.
 */
export function likeOptions(facet: { likedBy?: Liker[] }[]): FilterOption[] {
  const people = new Map<string, FilterOption>();
  let anyone = 0;
  for (const photo of facet) {
    const likers = photo.likedBy ?? [];
    if (likers.length > 0) anyone += 1;
    for (const { id, name } of likers) {
      const option = people.get(id) ?? {
        key: "liked",
        value: id,
        label: named(name),
        depth: 1,
        count: 0,
      };
      option.count += 1;
      people.set(id, option);
    }
  }
  if (people.size === 0) return [];
  const top = {
    key: "liked",
    value: ANYONE,
    label: named("Liked by anyone"),
    depth: 0,
    count: anyone,
  };
  return [
    top,
    ...[...people.values()].toSorted((a, b) => a.label.english.localeCompare(b.label.english)),
  ];
}
