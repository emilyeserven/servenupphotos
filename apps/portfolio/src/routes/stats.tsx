import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { SiteHomeLink } from "@/components/site-home-link";
import { StatGroupCard } from "@/components/stat-group";
import { type StatSection, statSections, type StatTotals, statTotals } from "@/lib/stats";

export const Route = createFileRoute("/stats")({
  component: StatsView,
});

// Worked out once: the photos only change with a new build.
const SECTIONS = statSections();
const TOTALS = statTotals();

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
 * with its groups, such as Cameras or Time of day, counting the photos in each value.
 */
function StatsView() {
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
            The photos counted by gear, place and time. Open a row to see its photos.
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
          {SECTIONS.map((section) => (
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
      {SECTIONS.map((section) => (
        <StatsSection key={section.id} section={section} />
      ))}
    </div>
  );
}

/** One section, such as Gear, with its groups as cards. */
function StatsSection({ section }: { section: StatSection }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
        {section.title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{section.description}</p>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.groups.map((group) => (
          <StatGroupCard key={group.title} group={group} />
        ))}
      </div>
    </section>
  );
}
