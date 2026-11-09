import { useNavigate } from "@tanstack/react-router";
import { CalendarPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";

/**
 * Plans a day before its photos are taken: picking a date opens its Trip Stops page, where the
 * places to stop at can be added ahead and saved. Its photos join it once they're added.
 */
export function PlanDay() {
  const [day, setDay] = useState("");
  const navigate = useNavigate();
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void navigate({ to: "/trip-lines/$day/$part", params: { day, part: "stops" } });
      }}
    >
      <DatePicker value={day} aria-label="Day to plan" className="h-8 w-48" onChange={setDay} />
      <Button type="submit" variant="outline" size="sm" disabled={!day}>
        <CalendarPlus aria-hidden />
        Plan a day
      </Button>
      <span className="text-muted-foreground text-xs">
        Add trip stops to a day before its photos are taken.
      </span>
    </form>
  );
}
