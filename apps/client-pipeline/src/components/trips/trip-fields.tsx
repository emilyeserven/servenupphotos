import type { Trip } from "@/api/trips";
import { Input } from "@/components/ui/input";

/** A Trip's name and its first and last days. */
export function TripFields({ trip, onChange }: { trip: Trip; onChange: (trip: Trip) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <Input
          value={trip.name}
          placeholder="Korea and Japan"
          onChange={(e) => onChange({ ...trip, name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        First day
        <Input
          type="date"
          value={trip.start}
          onChange={(e) => onChange({ ...trip, start: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Last day
        <Input
          type="date"
          value={trip.end}
          onChange={(e) => onChange({ ...trip, end: e.target.value })}
        />
      </label>
    </div>
  );
}
