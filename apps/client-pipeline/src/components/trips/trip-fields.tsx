import type { Trip } from "@/api/trips";
import { Input } from "@/components/ui/input";

/** A Trip's name, as the Timeline shows it, and its first and last days. */
export function TripFields({ trip, onChange }: { trip: Trip; onChange: (trip: Trip) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Name, as the Timeline shows it</span>
        <Input
          value={trip.name}
          placeholder="Japan"
          onChange={(e) => onChange({ ...trip, name: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">First day</span>
        <Input
          type="date"
          value={trip.start}
          onChange={(e) => onChange({ ...trip, start: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Last day, included</span>
        <Input
          type="date"
          value={trip.end}
          min={trip.start}
          onChange={(e) => onChange({ ...trip, end: e.target.value })}
        />
      </label>
    </div>
  );
}
