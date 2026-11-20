import { Link } from "@tanstack/react-router";
import { MapPinIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { PhotoRow } from "@/components/quality-check/photo-parts";
import { Button } from "@/components/ui/button";
import { count } from "@/components/update-data-shared";
import type { AutogroupPhoto } from "@/lib/compare-autogroup";
import { type MissingPlace, type MissingPlaceReason, missingPlaces } from "@/lib/missing-places";
import { useNoPlaceFoundStore } from "@/stores/no-place-found";
import { SectionTitle } from "@/components/section-title";

/** How many photos the list shows until **Show all** is pressed. */
const SHOWN_AT_FIRST = 30;

/** What each reason says on a photo's row. */
const REASON_TEXT: Record<MissingPlaceReason, string> = {
  hasGps: "Has a GPS position: Bulk Places can find its place",
  noPlaceFound: "Bulk Places' LLM found no place for it",
  noGps: "No GPS position: add one or a place on the Photo page",
  markedNoGps: "Marked as going without GPS: add a place on the Photo page",
};

/**
 * The places check: lists the chosen photos with no saved place, with why, so they can be given
 * one on the Photo page or, with a GPS position, in Bulk Places. Nothing is measured or saved.
 */
export function MissingPlacesCheck({ photos }: { photos: AutogroupPhoto[] }) {
  const noPlaceFound = useNoPlaceFoundStore((state) => state.paths);
  const missing = useMemo(
    () => missingPlaces(photos, new Set(noPlaceFound)),
    [photos, noPlaceFound],
  );
  const bulk = missing.filter((item) => item.reason === "hasGps").length;
  return (
    <section className="flex flex-col gap-3">
      <SectionTitle>Places</SectionTitle>
      <p className="text-muted-foreground max-w-prose text-sm">
        Lists the photos that aren&apos;t in a saved place yet. The ones with a GPS position can get
        theirs from Bulk Places; the rest need a place or a position on the Photo page.
      </p>
      <p className="text-sm">{foundText(missing.length, photos.length)}</p>
      {bulk > 0 && <BulkPlacesLink count={bulk} />}
      {missing.length > 0 && <MissingList key={missing.length} missing={missing} />}
    </section>
  );
}

/** How many of the photos have no place. */
function foundText(missing: number, total: number): string {
  if (missing === 0) return `Every one of ${count(total, "photo")} has a place.`;
  return `${count(missing, "photo")} of ${total} ${missing === 1 ? "has" : "have"} no place.`;
}

/** Opens Bulk Places, which picks photos with a GPS position and no place. */
function BulkPlacesLink({ count: n }: { count: number }) {
  return (
    <Button variant="outline" className="self-start" asChild>
      <Link to="/bulk-places">
        <MapPinIcon />
        Find places for {count(n, "photo")} in Bulk Places
      </Link>
    </Button>
  );
}

/** The photos without a place, the first 30 until **Show all** is pressed. */
function MissingList({ missing }: { missing: MissingPlace[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? missing : missing.slice(0, SHOWN_AT_FIRST);
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y rounded-xl border">
        {shown.map((item) => (
          <MissingRow key={item.entry.key} item={item} />
        ))}
      </ul>
      {shown.length < missing.length && (
        <Button variant="ghost" className="self-start" onClick={() => setAll(true)}>
          Show all {missing.length}
        </Button>
      )}
    </div>
  );
}

/** One photo without a place: its Small version, name, why, and a link to the Photo page. */
function MissingRow({ item }: { item: MissingPlace }) {
  return (
    <PhotoRow entry={item.entry}>
      <p className="text-muted-foreground">{REASON_TEXT[item.reason]}</p>
    </PhotoRow>
  );
}
