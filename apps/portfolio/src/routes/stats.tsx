import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { type StatFocus, StatGroupCard } from "@/components/stat-group";
import { filterWithCamera } from "@/lib/camera-filters";
import { photos } from "@/lib/photos";
import type { GroupDef, StatRow } from "@/lib/stat-groups";
import { type StatSection, STAT_SECTIONS, type StatTotals, statTotals } from "@/lib/stats";

export const Route = createFileRoute("/stats")({
  component: StatsView,
});

// Worked out once: the photos only change with a new build.
const TOTALS = statTotals(photos);

/** The headline numbers, in the order they're shown. */
const TOTAL_LABELS: [keyof StatTotals, string][] = [
  ["photos", "Photos"],
  ["countries", "Countries"],
  ["cities", "Cities"],
  ["cameras", "Cameras"],
  ["years", "Years"],
];

/** The row chosen in a group that narrows another, by the narrowed group's ID. */
type Focuses = Record<string, StatFocus & { from: string }>;

/**
 * How the photos break down: a few headline numbers, then the Gear, Places and Time sections, each
 * with its groups, such as Cameras or Time of day, counting the photos in each value. A row opens
 * its photos on the Grid, except in a group that narrows another, such as Countries, whose rows
 * narrow that one, such as Cities, to their photos.
 */
function StatsView() {
  const [focuses, setFocuses] = useState<Focuses>({});
  /** Narrows the group to the row's photos, or shows every photo again when it already is. */
  function narrow(def: GroupDef, title: string, row: StatRow) {
    const target = def.narrows!;
    const current = focuses[target];
    const same = current?.row.label === row.label && current.from === def.id;
    setFocuses(
      same ? without(focuses, target) : { ...focuses, [target]: { title, row, from: def.id } },
    );
  }
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-6">
        <div>
          <SiteHomeLink className="mb-1" />
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <ChartColumn className="size-8 text-muted-foreground" aria-hidden />
            Stats
          </h1>
          <p className="mt-2 text-muted-foreground">
            The photos counted by gear, place and time. Open a row to see its photos on the Grid.
          </p>
        </div>
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3">
          {TOTAL_LABELS.map(([key, label]) => (
            <div key={key} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums tracking-tight">{TOTALS[key]}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
          {STAT_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-full border px-3 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {section.title}
            </a>
          ))}
        </nav>
      </header>
      {STAT_SECTIONS.map((section) => (
        <StatsSection
          key={section.id}
          section={section}
          focuses={focuses}
          onNarrow={narrow}
          onClear={(id) => setFocuses(without(focuses, id))}
        />
      ))}
    </div>
  );
}

/** The focuses without the one for the group with the ID. */
function without(focuses: Focuses, id: string): Focuses {
  return Object.fromEntries(Object.entries(focuses).filter(([key]) => key !== id));
}

/** The photos a group counts: the ones the row narrowing it leaves, or every photo. */
function groupPhotos(focus: StatFocus | undefined) {
  return focus?.row.filter ? filterWithCamera(photos, focus.row.filter) : photos;
}

/** One section, such as Gear, with its groups as cards. */
function StatsSection({
  section,
  focuses,
  onNarrow,
  onClear,
}: {
  section: StatSection;
  focuses: Focuses;
  onNarrow: (def: GroupDef, title: string, row: StatRow) => void;
  onClear: (id: string) => void;
}) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
        {section.title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{section.description}</p>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.groups.map((def) => (
          <DefCard key={def.id} def={def} focuses={focuses} onNarrow={onNarrow} onClear={onClear} />
        ))}
      </div>
    </section>
  );
}

/** A group's card, counting the photos its focus leaves. */
function DefCard({
  def,
  focuses,
  onNarrow,
  onClear,
}: {
  def: GroupDef;
  focuses: Focuses;
  onNarrow: (def: GroupDef, title: string, row: StatRow) => void;
  onClear: (id: string) => void;
}) {
  const focus = focuses[def.id];
  return (
    <StatGroupCard
      group={def.build(groupPhotos(focus))}
      focus={focus}
      {...narrowing(def, focuses, onNarrow)}
      onClearFocus={() => onClear(def.id)}
    />
  );
}

/** For a group that narrows another: its chosen row's label and what a click on a row does. */
function narrowing(
  def: GroupDef,
  focuses: Focuses,
  onNarrow: (def: GroupDef, title: string, row: StatRow) => void,
) {
  if (!def.narrows) return {};
  const target = focuses[def.narrows];
  const title = narrowedTitle(def.narrows);
  return {
    chosen: target?.from === def.id ? target.row.label : undefined,
    onNarrow: (row: StatRow) => onNarrow(def, title, row),
  };
}

/** What the narrowed group is called in its X's label, such as "cities". */
function narrowedTitle(id: string): string {
  return (
    STAT_SECTIONS.flatMap((s) => s.groups)
      .find((g) => g.id === id)
      ?.build([]).title ?? id
  );
}
