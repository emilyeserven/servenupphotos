import { useMemo } from "react";
import type { SocialPhoto } from "@/api/publish";
import {
  type UnsavedOrder,
  type UnsavedZones,
  SPOTLIGHT_ORDER,
  SPOTLIGHT_ZONES,
  appendChanges,
  moveChanges,
  orderChange,
  orderOf,
  unsavedOrderFromEdits,
  unsavedZonesFromEdits,
  zoneChange,
  zonePhotos,
  zonesOf,
} from "@/lib/site-spotlight";
import { useLocalEditsStore } from "@/stores/local-edits";

/** Puts a photo in a zone or takes it out. */
export type Toggle = (photo: SocialPhoto, zone: string, on: boolean) => void;

/** The zones and order as changed in the app, and how to change them. */
export interface Spotlight {
  unsaved: UnsavedZones;
  order: UnsavedOrder;
  toggle: Toggle;
  /** Saves list, a zone's photos in their order, with the photo at from moved to to. */
  move: (list: SocialPhoto[], from: number, to: number) => void;
}

/**
 * The spotlight zones and order changed in the app and not committed yet, kept with its other
 * local edits so the sync button counts them and **Commit** saves them.
 */
export function useSpotlight(photos: SocialPhoto[]): Spotlight {
  const edits = useLocalEditsStore((state) => state.edits);
  const setField = useLocalEditsStore((state) => state.setField);
  const unsaved = useMemo(() => unsavedZonesFromEdits(edits), [edits]);
  const order = useMemo(() => unsavedOrderFromEdits(edits), [edits]);
  const toggle: Toggle = (photo, zone, on) => {
    setField(SPOTLIGHT_ORDER, orderChanges({ unsaved, order, photos }, photo, zone, on));
    setField(SPOTLIGHT_ZONES, [zoneChange(unsaved, photo, zone, on)]);
  };
  const move: Spotlight["move"] = (list, from, to) =>
    setField(SPOTLIGHT_ORDER, moveChanges(list, from, to));
  return { unsaved, order, toggle, move };
}

/** The zones and order as they are before a change, and every photo file. */
interface Current {
  unsaved: UnsavedZones;
  order: UnsavedOrder;
  photos: SocialPhoto[];
}

/**
 * The order edits for putting photo in zone or taking it out: a photo without a place goes to the
 * end of the zone's order; one taken out of its last zone loses its place; otherwise it keeps it.
 */
function orderChanges(current: Current, photo: SocialPhoto, zone: string, on: boolean) {
  const { unsaved, order, photos } = current;
  const others = zonesOf(unsaved, photo).filter((z) => z !== zone);
  if (!on) return others.length > 0 ? [] : [orderChange(photo, null)];
  if (orderOf(order, photo) !== null) return [];
  return appendChanges(zonePhotos(photos, unsaved, order, zone), photo);
}
