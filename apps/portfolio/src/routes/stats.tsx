import { createFileRoute } from "@tanstack/react-router";
import { ChartColumn } from "lucide-react";
import { useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { type FocusChain, type StatFocus, StatGroupCard } from "@/components/stat-group";
import { filterWithCamera } from "@/lib/camera-filters";
import { photos } from "@/lib/photos";
import type { GroupDef, GroupVariant, StatRow } from "@/lib/stat-groups";
import { type StatSection, STAT_SECTIONS, type StatTotals, statTotals } from "@/lib/stats";

export const Route = createFileRoute("/stats")({
  component: StatsView,
});

// Worked out once: the photos only change with a new build.
const TOTALS = statTotals(photos);

/** A headline number: what it counts, its name, and the group it jumps to, if any. */
type TotalDef = [keyof StatTotals, string, string?];

/** The headline numbers, in the order they're shown, each but Photos jumping to its group. */
const TOTAL_LABELS: TotalDef[] = [
  ["photos", "Photos"],
  ["countries", "Countries", "countries"],
  ["cities", "Cities", "cities"],
  ["cameras", "Cameras", "cameras"],
  ["years", "Years", "year"],
];

/** The ID of a group's card on the page, for the headline numbers to jump to. */
function cardAnchor(id: string): string {
  return `stat-${id}`;
}

/** The row chosen in a group that narrows another, by the narrowed group's ID. */
type Focuses = Record<string, StatFocus & { from: string }>;

/** Which variant each group with variants shows, by the group's ID; the first when it isn't set. */
type Variants = Record<string, number>;

/** What a card needs from the page: the rows chosen, the variants picked, and how to change them. */
interface PageState {
  focuses: Focuses;
  variants: Variants;
  onNarrow: (def: GroupDef, title: string, row: StatRow) => void;
  onClear: (id: string) => void;
  onVariant: (def: GroupDef, index: number) => void;
}

/**
 * How the photos break down: a few headline numbers, then the Gear, Places and Time sections, each
 * with its groups, such as Cameras or Time of day, counting the photos in each value. A row opens
 * its photos on the Grid, except in a group that narrows another, such as Countries, whose rows
 * narrow that one, such as Cities, to their photos. Narrowing passes down a chain: a lens type
 * narrows the focal lengths, and a focal length the lenses, within that type.
 */
function StatsView() {
  const [focuses, setFocuses] = useState<Focuses>({});
  const [variants, setVariants] = useState<Variants>({});
  const state: PageState = {
    focuses,
    variants,
    onNarrow: (def, title, row) => {
      const target = def.narrows!;
      const current = focuses[target];
      const same = current?.row.label === row.label && current.from === def.id;
      const next = { title, target, row, from: def.id };
      setFocuses(same ? without(focuses, target) : { ...focuses, [target]: next });
    },
    onClear: (id) => setFocuses(without(focuses, id)),
    onVariant: (def, index) => {
      setVariants({ ...variants, [def.id]: index });
      setFocuses(without(focuses, def.narrows ?? ""));
    },
  };
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
        <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-3">
          {TOTAL_LABELS.map((total) => (
            <TotalCard key={total[0]} total={total} />
          ))}
        </div>
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
        <StatsSection key={section.id} section={section} state={state} />
      ))}
    </div>
  );
}

/** A headline number's card, a link to its group's card when it has one. */
function TotalCard({ total: [key, label, group] }: { total: TotalDef }) {
  const body = (
    <>
      <span className="block text-xs font-medium text-muted-foreground">{label}</span>
      <span className="block text-2xl font-semibold tabular-nums tracking-tight">
        {TOTALS[key]}
      </span>
    </>
  );
  const box = "rounded-xl border bg-card px-4 py-3 shadow-sm";
  if (!group) return <div className={box}>{body}</div>;
  return (
    <a
      href={`#${cardAnchor(group)}`}
      className={`${box} block transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none`}
    >
      {body}
    </a>
  );
}

/** The focuses without the one for the group with the ID. */
function without(focuses: Focuses, id: string): Focuses {
  return Object.fromEntries(Object.entries(focuses).filter(([key]) => key !== id));
}

/** Every group, to find which one narrows another. */
const ALL_GROUPS = STAT_SECTIONS.flatMap((section) => section.groups);

/**
 * The rows narrowing the group, from the top down: the one chosen in the group narrowing it, after
 * the ones narrowing that group, each with the filter for its photos and those above it.
 */
function focusChain(id: string, focuses: Focuses, seen = new Set<string>()): FocusChain {
  const parent = ALL_GROUPS.find((def) => def.narrows === id);
  const above = parent && !seen.has(id) ? focusChain(parent.id, focuses, seen.add(id)) : [];
  const focus = focuses[id];
  if (!focus) return above;
  const filter = Object.assign({}, ...above.map((f) => f.filter), focus.row.filter);
  return [...above, { ...focus, filter }];
}

/** The photos a group counts: the ones the rows narrowing it leave, or every photo. */
function groupPhotos(chain: FocusChain) {
  const last = chain.at(-1);
  return last ? filterWithCamera(photos, last.filter) : photos;
}

/** One section, such as Gear, with its groups as cards. */
function StatsSection({ section, state }: { section: StatSection; state: PageState }) {
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
        {section.title}
      </h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{section.description}</p>
      <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {section.groups.map((def) => (
          <div key={def.id} id={cardAnchor(def.id)} className="scroll-mt-20">
            <DefCard def={def} state={state} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** How a group is made: its picked variant's way, or its own. */
function buildOf(def: GroupDef, variants: Variants) {
  return def.variants?.[variants[def.id] ?? 0]?.build ?? def.build;
}

/** A group's card, counting the photos the rows narrowing it leave. */
function DefCard({ def, state }: { def: GroupDef; state: PageState }) {
  const chain = focusChain(def.id, state.focuses);
  return (
    <StatGroupCard
      group={buildOf(def, state.variants)(groupPhotos(chain))}
      title={def.variants && <VariantSelect def={def} variants={def.variants} state={state} />}
      focuses={chain}
      {...narrowing(def, state)}
      onClearFocus={state.onClear}
    />
  );
}

/** A dropdown of a group's variants in place of its title, such as Lenses by type; for a group that has them. */
function VariantSelect({
  def,
  variants,
  state,
}: {
  def: GroupDef;
  variants: GroupVariant[];
  state: PageState;
}) {
  return (
    <select
      aria-label="Group by"
      value={state.variants[def.id] ?? 0}
      onChange={(event) => state.onVariant(def, Number(event.target.value))}
      className="-ml-1 cursor-pointer rounded-md bg-transparent px-1 font-semibold tracking-tight outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {variants.map((variant, index) => (
        <option key={variant.label} value={index}>
          {variant.label}
        </option>
      ))}
    </select>
  );
}

/** For a group that narrows another: its chosen row's label and what a click on a row does. */
function narrowing(def: GroupDef, state: PageState) {
  if (!def.narrows) return {};
  const target = state.focuses[def.narrows];
  const title = narrowedTitle(def.narrows);
  return {
    chosen: target?.from === def.id ? target.row.label : undefined,
    onNarrow: (row: StatRow) => state.onNarrow(def, title, row),
  };
}

/** What the narrowed group is called in its X's label, such as "cities". */
function narrowedTitle(id: string): string {
  return ALL_GROUPS.find((g) => g.id === id)?.build([]).title ?? id;
}
