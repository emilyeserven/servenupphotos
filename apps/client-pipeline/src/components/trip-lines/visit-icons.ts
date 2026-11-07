import {
  Coffee,
  Landmark,
  type LucideIcon,
  MapPin,
  ShoppingBag,
  Star,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import type { VisitKind } from "@/api/trip-lines";

/** The icon each sort of trip stop shows, on the map and in the list. */
export const VISIT_ICONS: Record<VisitKind, LucideIcon> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Wine,
  shop: ShoppingBag,
  museum: Landmark,
  sight: Star,
  other: MapPin,
};
