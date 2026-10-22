import { Building2Icon, GlobeIcon, MapPinIcon } from "lucide-react";
import type { RegionKind } from "@/lib/region-tree";
import { cn } from "@/lib/utils";

/** Each kind's icon, and what it's called for screen readers and tooltips. */
const ICONS = {
  country: { Icon: GlobeIcon, label: "Country", color: "text-sky-600 dark:text-sky-400" },
  city: { Icon: Building2Icon, label: "City", color: "text-violet-600 dark:text-violet-400" },
  place: { Icon: MapPinIcon, label: "Place", color: "text-emerald-600 dark:text-emerald-400" },
} as const;

/** A globe for a country, a building for a city, or a pin for a place. */
export function RegionIcon({ kind, className }: { kind: RegionKind; className?: string }) {
  const { Icon, label, color } = ICONS[kind];
  return <Icon role="img" aria-label={label} className={cn("size-4 shrink-0", color, className)} />;
}
