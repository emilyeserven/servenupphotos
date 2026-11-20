import type { TripVisit } from "@/api/trip-lines";
import { END_GAPS, GapPicker } from "@/components/trip-lines/gap-picker";
import { GAPS } from "@/components/trip-lines/modes";
import { VisitChips } from "@/components/trip-lines/visit-chips";
import type { Gap } from "@/lib/trip-gaps";
import { type StopWay, stopWay } from "@/lib/stop-insert";

/** Changes how a trip stop was reached from the point before it. */
export type OnStopWay = (visit: TripVisit, way: StopWay) => void;

interface StopsWithWaysProps {
  /** The trip stops between two photos, in route order. */
  visits: TripVisit[];
  /** The gap between the two photos: each stop's way until it has its own. */
  gap: Gap;
  /** Changes a stop's way; left out, the ways only show. */
  onWay?: OnStopWay;
  onMove?: (visit: TripVisit, by: -1 | 1) => void;
  onOff?: (visit: TripVisit) => void;
  /** Shows each way as a menu, as between groups, rather than as an icon, as between photos. */
  menus?: boolean;
}

/**
 * The trip stops between two photos, each after the way it was reached from the point before it,
 * so the stretch between two stops (such as a ropeway's two stations) has a way of its own. The
 * way after the last stop is the gap's, shown after them.
 */
export function StopsWithWays({ visits, gap, onWay, menus, ...chip }: StopsWithWaysProps) {
  return (
    <>
      {visits.map((visit, i) => (
        <span key={i} className={menus ? "flex flex-col items-center gap-1" : "flex items-center"}>
          <WayPicker visit={visit} gap={gap} onWay={onWay} menus={menus} />
          <VisitChips visits={[visit]} hideWays {...chip} />
        </span>
      ))}
    </>
  );
}

interface WayPickerProps {
  visit: TripVisit;
  gap: Gap;
  onWay?: OnStopWay;
  menus?: boolean;
}

/** One stop's way, as an icon with a menu or as a menu; none in a break or a wander. */
function WayPicker({ visit, gap, onWay, menus }: WayPickerProps) {
  const way = stopWay(visit, gap);
  if (!way) return null;
  const change = onWay && ((w: StopWay) => onWay(visit, w));
  const Control = menus ? WayMenu : WayIcon;
  return <Control way={way} name={wayName(visit)} onWay={change} />;
}

/** What screen readers call a stop's way picker. */
function wayName(visit: TripVisit): string {
  return `How ${visit.name || "the trip stop"} was reached`;
}

/** A stop's way as an icon with a menu under it, like a gap's between two photos. */
function WayIcon({ way, name, onWay }: WayMenuProps) {
  return (
    <GapPicker
      gap={way}
      index={0}
      name={name}
      choices={END_GAPS}
      onGap={onWay && ((_, g) => onWay(g as StopWay))}
    />
  );
}

/** The ways a stop can be reached, as the menu between groups names them. */
const WAYS = GAPS.filter((g) => g.gap !== "break" && g.gap !== "wander");

interface WayMenuProps {
  way: StopWay;
  name: string;
  onWay?: (way: StopWay) => void;
}

/** A stop's way as a menu, like the gap's between two groups. */
function WayMenu({ way, name, onWay }: WayMenuProps) {
  return (
    <select
      aria-label={name}
      title={name}
      disabled={!onWay}
      className="border-input bg-background h-8 rounded-md border px-1 text-xs"
      value={way}
      onChange={(e) => onWay?.(e.target.value as StopWay)}
    >
      {WAYS.map((w) => (
        <option key={w.gap} value={w.gap}>
          {w.label}
        </option>
      ))}
    </select>
  );
}
