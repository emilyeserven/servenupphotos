import {
  BusFront,
  CarTaxiFront,
  Footprints,
  type LucideIcon,
  Pause,
  Route,
  TrainFront,
  TramFront,
} from "lucide-react";
import type { Gap } from "@/lib/trip-gaps";

/** What each gap between two photos can be, as the photo strip offers it, with its icon. */
export const GAPS: { gap: Gap; label: string; icon: LucideIcon }[] = [
  { gap: "walk", label: "Keep walking", icon: Footprints },
  { gap: "break", label: "Break", icon: Pause },
  { gap: "train", label: "Train", icon: TrainFront },
  { gap: "subway", label: "Subway", icon: TramFront },
  { gap: "bus", label: "Bus", icon: BusFront },
  { gap: "car", label: "Car or taxi", icon: CarTaxiFront },
  { gap: "transit", label: "Transit (kind unknown)", icon: Route },
];

/** The gap's entry in GAPS. */
export function gapInfo(gap: Gap) {
  return GAPS.find((g) => g.gap === gap) ?? GAPS[0]!;
}
