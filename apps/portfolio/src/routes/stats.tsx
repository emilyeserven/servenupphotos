import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, Hash } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ShowInGrid } from "@/components/show-in-grid";
import { SiteHomeLink } from "@/components/site-home-link";
import { type FocusChain, type StatFocus, StatGroupCard } from "@/components/stat-group";
import { filterWithCamera } from "@/lib/camera-filters";
import { LOCATION_KEYS } from "@/lib/photo-filters";
import { type Photo, photos } from "@/lib/photos";
import { type GroupDef, type GroupVariant, groupChains, type StatRow } from "@/lib/stat-groups";
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
  ["regions", "Regions", "regions"],
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

/** The row chosen in each linked group, such as Fast in Aperture, by the group's ID. */
type Links = Record<string, StatFocus>;

/** What a card needs from the page: the rows chosen, the variants picked, and how to change them. */
interface PageState {
  focuses: Focuses;
  variants: Variants;
  links: Links;
  onNarrow: (def: GroupDef, title: string, row: StatRow) => void;
  onClear: (id: string) => void;
  onVariant: (def: GroupDef, index: number) => void;
  onLink: (def: GroupDef, title: string, row: StatRow) => void;
  onUnlink: (id: string) => void;
}

/**
 * How the photos break down: a few headline numbers, then the Gear, Places and Time sections, each
 * with its groups, such as Cameras or Time of day, counting the photos in each value. A row opens
 * its photos on the Grid, except in a group that narrows another, such as Countries, whose rows
 * narrow that one, such as Cities, to their photos. Narrowing passes down a chain: a lens brand
 * narrows the focal lengths, and a focal length the lenses, within that brand. Linked groups, such
 * as the Exposure Triangle's, narrow each other both ways.
 */
function StatsView() {
  const [focuses, setFocuses] = useState<Focuses>({});
  const [variants, setVariants] = useState<Variants>({});
  const [links, setLinks] = useState<Links>({});
  const state: PageState = {
    focuses,
    variants,
    links,
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
    onLink: (def, title, row) => {
      const same = links[def.id]?.row.label === row.label;
      setLinks(
        same ? without(links, def.id) : { ...links, [def.id]: { title, target: def.id, row } },
      );
    },
    onUnlink: (id) => setLinks(without(links, id)),
  };
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-6">
        <div>
          <SiteHomeLink className="mb-1" />
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <Hash className="size-8 text-muted-foreground" aria-hidden />
            Numbers
          </h1>
          <p className="mt-2 text-muted-foreground">
            The photos counted by place, gear and time. Open a row to see its photos on the Grid.
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

/** A headline number's card, a link to its group's card when it has one, with an arrow on hover. */
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
      className={`${box} group relative block transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none`}
    >
      {body}
      <ArrowDown
        className="absolute top-3 right-3 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />
    </a>
  );
}

/** The chosen rows without the one for the group with the ID. */
function without<T>(chosen: Record<string, T>, id: string): Record<string, T> {
  return Object.fromEntries(Object.entries(chosen).filter(([key]) => key !== id));
}

/** Every group, to find which one narrows another. */
const ALL_GROUPS = STAT_SECTIONS.flatMap((section) => section.groups);

/** A row narrowing a group, with the photos it and the rows above it leave. */
type Step = FocusChain[number] & { photos: Photo[] };

/**
 * The rows narrowing the group, from the top down: the one chosen in the group narrowing it, after
 * the ones narrowing that group. Each step keeps only the photos the steps above it left, so a
 * third card counts within every choice above it, such as Cities within No region within the US.
 */
function focusChain(id: string, focuses: Focuses, seen = new Set<string>()): Step[] {
  const parent = ALL_GROUPS.find((def) => def.narrows === id);
  const above = parent && !seen.has(id) ? focusChain(parent.id, focuses, seen.add(id)) : [];
  const focus = focuses[id];
  return focus ? [...above, stepOf(above, focus)] : above;
}

/** The chosen row as a step below the steps above it, keeping only the photos they left. */
function stepOf(above: Step[], focus: StatFocus): Step {
  const narrowed = filterWithCamera(groupPhotos(above), focus.row.filter ?? {});
  const filter = gridFilter([...above.map((step) => step.row), focus.row], narrowed);
  return { ...focus, filter, photos: narrowed };
}

/**
 * The Grid's filter for a chain's photos: its rows' filters together, or, when they choose more
 * than one kind of place, which the Grid would match any of, the photos themselves by ID.
 */
function gridFilter(rows: StatRow[], narrowed: Photo[]): Step["filter"] {
  const filter = Object.assign({}, ...rows.map((row) => row.filter));
  const places = LOCATION_KEYS.filter((key) => key in filter);
  if (places.length < 2) return filter;
  return { ids: narrowed.map((photo) => photo.id) };
}

/** The photos a group counts: the ones the rows narrowing it leave, or every photo. */
function groupPhotos(chain: Step[]): Photo[] {
  return chain.at(-1)?.photos ?? photos;
}

/** One section, such as Gear, with its groups as cards: each chain of narrowing groups on a row of its own. */
function StatsSection({ section, state }: { section: StatSection; state: PageState }) {
  const runs = sectionRuns(section.groups);
  const only = runs.length === 1 ? runs[0] : undefined;
  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-20">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`${section.id}-title`} className="text-xl font-semibold tracking-tight">
          {section.title}
        </h2>
        {only && <ShowInGrid filter={runFilter(only, state)} />}
      </div>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">{section.description}</p>
      <div className="flex flex-col gap-4">
        {runs.map((run) => (
          <GroupRun key={run.defs[0]!.id} run={run} state={state} boxed={runs.length > 1} />
        ))}
      </div>
    </section>
  );
}

/**
 * A row of a section's cards: a chain whose cards narrow each other down, linked cards that narrow
 * each other both ways, or cards on their own; a chain or linked cards can have a title.
 */
interface Run {
  kind: "alone" | "down" | "linked";
  title?: string;
  defs: GroupDef[];
}

/** A section's groups as rows: each chain on its own, and the groups on their own between them together. */
function sectionRuns(groups: GroupDef[]): Run[] {
  const runs: Run[] = [];
  for (const chain of groupChains(groups)) {
    const run = runOf(chain);
    const last = runs.at(-1);
    if (joinsLast(run, last)) last!.defs.push(...chain);
    else runs.push(run);
  }
  return runs;
}

/** A run of groups: linked, narrowing down, or one group on its own. */
function runOf(chain: GroupDef[]): Run {
  const first = chain[0]!;
  const kind = first.linked ? "linked" : chain.length > 1 ? "down" : "alone";
  return { kind, title: first.linked ?? first.runTitle, defs: chain };
}

/** Whether a run of one card goes on with the cards on their own before it. */
function joinsLast(run: Run, last: Run | undefined): boolean {
  return run.kind === "alone" && last?.kind === "alone";
}

/** A chain's columns on a desktop, one per card. */
const CHAIN_COLUMNS: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3" };

/**
 * A row of cards. A chain, such as Year, Season and Month, has a bar from each card to the one it
 * narrows, and linked cards a short one between each: across on a desktop, down on a phone. A
 * titled run sits in a box under its title, unless it's the section's only run, with a Show in Grid
 * button opposite the title once a value is chosen on its cards; the section's only run has it
 * opposite the section's title.
 */
function GroupRun({ run, state, boxed }: { run: Run; state: PageState; boxed: boolean }) {
  const cards = run.defs.map((def, index) => (
    <div
      key={def.id}
      id={cardAnchor(def.id)}
      className={`relative min-w-0 scroll-mt-20 ${index > 0 ? RUN_LINES[run.kind] : ""}`}
    >
      <DefCard def={def} state={state} />
    </div>
  ));
  if (run.kind === "alone") {
    return <div className="grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards}</div>;
  }
  const row = (
    <div
      className={`grid items-start gap-6 lg:items-stretch lg:[&>div>section]:h-full ${CHAIN_COLUMNS[run.defs.length] ?? CHAIN_COLUMNS[3]}`}
    >
      {cards}
    </div>
  );
  if (!boxed) return row;
  return (
    <RunBox title={run.title} button={<ShowInGrid filter={runFilter(run, state)} />}>
      {row}
    </RunBox>
  );
}

/**
 * The Grid's filter for a run's photos: every value chosen on its linked cards, or every row
 * chosen down its chain; undefined for cards on their own.
 */
function runFilter(run: Run, state: PageState): Record<string, unknown> | undefined {
  if (run.kind === "linked") return linkFilter(run.defs.flatMap((def) => linkOf(def, state.links)));
  return focusChain(run.defs.at(-1)!.id, state.focuses).at(-1)?.filter;
}

/** The row chosen on a linked card, as a list of it or of none. */
function linkOf(def: GroupDef, links: Links): StatFocus[] {
  const link = links[def.id];
  return link ? [link] : [];
}

/** A run's box, in a shade a little off the page, with its title and Show in Grid button above its cards. */
function RunBox({
  title,
  button,
  children,
}: {
  title?: string;
  button: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-muted p-3 sm:p-4">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {button}
      </div>
      {children}
    </div>
  );
}

/**
 * The bar joining a chained card to the one before it, filling the gap between them in the cards'
 * border color, 1em in from each end of the card: down the row on a desktop, where the chain's
 * cards are as tall as each other, and across the card on a phone.
 */
const CHAIN_LINE =
  "before:absolute before:-top-6 before:right-[1em] before:left-[1em] before:h-6 before:bg-border lg:before:top-[1em] lg:before:bottom-[1em] lg:before:-left-6 lg:before:right-auto lg:before:h-auto lg:before:w-6";

/**
 * The bar joining a linked card to the one before it: a short one, 2rem long, in the middle of the
 * gap between them, so linked cards read apart from a chain's.
 */
const LINK_LINE =
  "before:absolute before:-top-6 before:left-1/2 before:h-6 before:w-8 before:-translate-x-1/2 before:bg-border lg:before:top-1/2 lg:before:-left-6 lg:before:h-8 lg:before:w-6 lg:before:translate-x-0 lg:before:-translate-y-1/2";

/** The bar from each card of a run to the one before it, by the run's kind. */
const RUN_LINES: Record<Run["kind"], string> = { alone: "", down: CHAIN_LINE, linked: LINK_LINE };

/** How a group is made: its picked variant's way, or its own. */
function buildOf(def: GroupDef, variants: Variants) {
  return def.variants?.[variants[def.id] ?? 0]?.build ?? def.build;
}

/**
 * A group's card, counting the photos the rows narrowing it leave. Its chip shows only the row
 * chosen in the card right above it, such as Autumn on Month, not the Year above that.
 */
function DefCard({ def, state }: { def: GroupDef; state: PageState }) {
  if (def.linked) return <LinkedCard def={def} state={state} />;
  const chain = focusChain(def.id, state.focuses);
  return (
    <StatGroupCard
      group={buildOf(def, state.variants)(groupPhotos(chain))}
      control={def.variants && <VariantSelect def={def} variants={def.variants} state={state} />}
      focuses={chain.filter((focus) => focus.target === def.id)}
      {...narrowing(def, state)}
      onClearFocus={state.onClear}
    />
  );
}

/** A group's Group by dropdown of its variants, such as By type or By brand; for a group that has them. */
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
      className="cursor-pointer rounded-md border bg-background px-1.5 py-0.5 text-xs text-muted-foreground shadow-xs outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
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

/** The rows chosen in the groups linked with the group, not its own. */
function otherLinks(def: GroupDef, links: Links): StatFocus[] {
  return ALL_GROUPS.filter((other) => other.linked === def.linked && other.id !== def.id).flatMap(
    (other) => (links[other.id] ? [links[other.id]!] : []),
  );
}

/** The filter for the photos with every one of the chosen rows. */
function linkFilter(choices: StatFocus[]): Record<string, string | string[]> {
  return Object.assign({}, ...choices.map((focus) => focus.row.filter));
}

/** A chosen row's text after "in" on another linked card, such as "Fast aperture" or "Base ISO". */
function linkText(focus: StatFocus): string {
  const title = /[a-z]/.test(focus.title) ? focus.title.toLowerCase() : focus.title;
  return `${focus.row.label} ${title}`;
}

/**
 * A linked group's card, such as Aperture: it counts the photos the rows chosen in the other groups
 * linked with it leave, and lists those choices, not its own, as "with Fast shutter speed and Base
 * ISO", each opening the photos with all of them; a click on its own row chooses it for the others.
 */
function LinkedCard({ def, state }: { def: GroupDef; state: PageState }) {
  const others = otherLinks(def, state.links);
  const filter = linkFilter(others);
  const list = filterWithCamera(photos, filter);
  const group = def.build(list);
  const count = list.length;
  const focuses = others.map((focus, index) => ({
    ...focus,
    row: { ...focus.row, label: linkText(focus), count },
    filter,
    prefix: index === 0 ? "with" : "and",
  }));
  return (
    <StatGroupCard
      group={group}
      focuses={focuses}
      chosen={state.links[def.id]?.row.label}
      onNarrow={(row) => state.onLink(def, group.title, row)}
      onClearFocus={state.onUnlink}
    />
  );
}
