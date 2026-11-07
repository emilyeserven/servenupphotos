import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { useMemo } from "react";
import { CameraFilterBar } from "@/components/camera-filters";
import { NoMatchingPhotos } from "@/components/photo-filters";
import { SiteHomeLink } from "@/components/site-home-link";
import { StatGroupCard } from "@/components/stat-group";
import type { StatFilters } from "@/components/stat-row";
import { type CameraFilters, filterWithCamera, parseCameraFilters } from "@/lib/camera-filters";
import { parseFilters, type PhotoFilters } from "@/lib/photo-filters";
import { photos } from "@/lib/photos";
import { type StatSection, statSections, type StatTotals, statTotals } from "@/lib/stats";

export const Route = createFileRoute("/stats")({
  validateSearch: (search: Record<string, unknown>): PhotoFilters & CameraFilters => ({
    ...parseFilters(search),
    ...parseCameraFilters(search),
  }),
  component: StatsView,
});

/** The headline numbers, in the order they're shown. */
const TOTAL_LABELS: [keyof StatTotals, string][] = [
  ["photos", "Photos"],
  ["countries", "Countries"],
  ["cities", "Cities"],
  ["cameras", "Cameras"],
  ["years", "Years"],
];

/**
 * How the photos break down: a few headline numbers, then the Gear, Places and Time sections, each
 * with its groups, such as Cameras or Time of day, counting the photos in each value. It has the
 * Grid's filters, and counts only the photos they leave; a row sets its own filter.
 */
function StatsView() {
  const search = Route.useSearch();
  const shown = useMemo(() => filterWithCamera(photos, search), [search]);
  const sections = useMemo(() => statSections(shown), [shown]);
  const totals = statTotals(shown);
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
            The photos counted by gear, place and time. Pick a row to count only its photos, or see
            them on the Grid.
          </p>
        </div>
        <CameraFilterBar photos={photos} />
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3">
          {TOTAL_LABELS.map(([key, label]) => (
            <div key={key} className="rounded-xl border bg-card px-4 py-3 shadow-sm">
              <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold tabular-nums tracking-tight">{totals[key]}</dd>
            </div>
          ))}
        </dl>
        <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
          {sections.map((section) => (
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
      <NoMatchingPhotos count={shown.length} />
      {shown.length > 0 &&
        sections.map((section) => (
          <StatsSection key={section.id} section={section} filters={search} />
        ))}
    </div>
  );
}

/** One section, such as Gear, with its groups as cards. */
function StatsSection({ section, filters }: { section: StatSection; filters: StatFilters }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
        {section.title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{section.description}</p>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.groups.map((group) => (
          <StatGroupCard key={group.title} group={group} filters={filters} />
        ))}
      </div>
    </section>
  );
}
