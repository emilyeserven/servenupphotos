import type { TripVisit } from "@/api/trip-lines";
import { VISIT_ICONS } from "@/components/trip-lines/visit-icons";

/** The places visited between two photos, as small icons named on hover; nothing when none. */
export function VisitChips({ visits }: { visits: TripVisit[] }) {
  if (visits.length === 0) return null;
  return (
    <span className="flex flex-col gap-0.5" aria-label="Places visited here">
      {visits.map((v, i) => (
        <VisitChip key={i} visit={v} />
      ))}
    </span>
  );
}

function VisitChip({ visit }: { visit: TripVisit }) {
  const Icon = VISIT_ICONS[visit.kind];
  const name = visit.name || "Unnamed place";
  return (
    <span
      title={name}
      className="flex size-6 items-center justify-center rounded-full border border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{name}</span>
    </span>
  );
}
