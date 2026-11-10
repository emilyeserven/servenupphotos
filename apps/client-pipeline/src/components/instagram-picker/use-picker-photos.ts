import { useMemo, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { type Unsaved, dateOf, pickerChoices } from "@/lib/social-schedule";
import { isFocused, matchesFocus } from "@/lib/social-focus";
import { type Neighbors, neighborsFor } from "@/lib/social-neighbors";
import { type Suggestion, suggestionsFor } from "@/lib/social-suggestions";
import { useChangedPhotoFiles } from "@/stores/combined-data";
import { useSocialFocusStore } from "@/stores/social-focus";

/** Which photos are allowed through the Focus. */
type Allowed = (photo: SocialPhoto) => boolean;

/**
 * The unused photos most like the ones on the days before day; none when day is null, while the
 * picker is closed or something is searched for.
 */
function useSuggestions(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: Allowed,
) {
  const changed = useChangedPhotoFiles();
  return useMemo(
    () => (day === null ? [] : suggestionsFor(photos, unsaved, day, changed, allowed)),
    [photos, unsaved, day, changed, allowed],
  );
}

/**
 * The photos taken around the last photo on the calendar before day; null when day is null, while
 * the picker is closed or something is searched for.
 */
function useNeighbors(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: Allowed,
) {
  const changed = useChangedPhotoFiles();
  return useMemo(
    () => (day === null ? null : neighborsFor(photos, unsaved, day, changed, allowed)),
    [photos, unsaved, day, changed, allowed],
  );
}

/** The paths of the photos taken around the last scheduled one. */
function neighborPaths(neighbors: Neighbors | null): Set<string> {
  return new Set(neighbors?.photos.map(({ photo }) => photo.path));
}

/**
 * What the picker suggests for day: the photos taken around the last scheduled one, the most alike
 * photos that aren't among them, and whether there are any.
 */
function useSuggested(
  photos: SocialPhoto[],
  unsaved: Unsaved,
  day: string | null,
  allowed: Allowed,
) {
  const neighbors = useNeighbors(photos, unsaved, day, allowed);
  const similar = useSuggestions(photos, unsaved, day, allowed);
  const inOrder = neighborPaths(neighbors);
  const shown = similar.filter(({ photo }) => !inOrder.has(photo.path));
  return { neighbors, shown, any: shown.length > 0 || inOrder.size > 0 };
}

/** The Focus the picker filters by, and whether it's turned off for now. */
function useFocus() {
  const focus = useSocialFocusStore((state) => state.focus);
  const [ignored, setIgnored] = useState(false);
  const on = isFocused(focus) && !ignored;
  const allowed = useMemo(
    () => (on ? (photo: SocialPhoto) => matchesFocus(photo, focus) : () => true),
    [on, focus],
  );
  return { focus, ignored, setIgnored, allowed, focused: on };
}

/** The choices the Focus allows, without the ones suggested above them. */
function otherChoices(
  choices: SocialPhoto[],
  suggestions: Suggestion[],
  neighbors: Neighbors | null,
  allowed: Allowed,
): SocialPhoto[] {
  const suggested = neighborPaths(neighbors);
  for (const { photo } of suggestions) suggested.add(photo.path);
  return choices.filter((photo) => !suggested.has(photo.path) && allowed(photo));
}

/**
 * Everything the photo picker and the photo drawer list for day: the search, the boxes that show
 * scheduled photos and turn the Focus off, **Before and after**, **Suggested** and **All photos**.
 * Suggestions are left out while day is null or something is searched for.
 */
export function usePickerPhotos(photos: SocialPhoto[], unsaved: Unsaved, day: string | null) {
  const [search, setSearch] = useState("");
  // Kept between days, so opting in once shows them every time the picker opens.
  const [showScheduled, setShowScheduled] = useState(false);
  const { focus, ignored, setIgnored, allowed, focused } = useFocus();
  const searching = search.trim() !== "";
  const { neighbors, shown, any } = useSuggested(photos, unsaved, searching ? null : day, allowed);
  const choices = otherChoices(
    pickerChoices(photos, unsaved, search, showScheduled),
    shown,
    neighbors,
    allowed,
  );
  return {
    filters: { search, setSearch, showScheduled, setShowScheduled, focus, ignored, setIgnored },
    neighbors,
    suggestions: shown,
    choices,
    titled: any,
    focused,
    searching,
    hidingScheduled: !showScheduled && photos.some((p) => dateOf(unsaved, p) !== null),
    /** Clears the search and turns the Focus back on, for the next day. */
    reset: () => {
      setSearch("");
      setIgnored(false);
    },
  };
}

/** What usePickerPhotos gives the picker's lists. */
export type PickerPhotos = ReturnType<typeof usePickerPhotos>;
