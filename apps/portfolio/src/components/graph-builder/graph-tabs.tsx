import { useSearch } from "@tanstack/react-router";
import { Bookmark, BookmarkPlus, type LucideIcon, SlidersHorizontal, Filter } from "lucide-react";
import { type ReactNode, useState } from "react";
import { CameraFilterBar } from "@/components/camera-filters";
import { type ConfigChange, GraphControls } from "@/components/graph-builder/graph-controls";
import { PresetPicker } from "@/components/graph-builder/preset-picker";
import { SavePresetForm } from "@/components/graph-builder/saved-presets";
import { FilterCount } from "@/components/photo-filters";
import { parseCameraFilters } from "@/lib/camera-filters";
import type { GraphConfig } from "@/lib/graph-data";
import { filterCount, parseFilters } from "@/lib/photo-filters";
import type { Photo } from "@/lib/photos";
import { type SavedGraphs, useSavedGraphs } from "@/lib/saved-graphs";
import { CONTROL_FRAME, controlButtonClass } from "@/lib/segmented-control";

/** The Graph page's tabs. */
type GraphTab = "presets" | "adjust" | "filters" | "save";

/** The tabs on the left, with their names and icons; Save as preset sits apart on the right. */
const LEFT_TABS: [GraphTab, string, LucideIcon][] = [
  ["presets", "Presets", Bookmark],
  ["adjust", "Adjust Graph", SlidersHorizontal],
  ["filters", "Filters", Filter],
];

/** How many of the site's usual filters the URL sets, for the Filters tab's badge. */
function useFilterCount(): number {
  const search = useSearch({ strict: false });
  return filterCount(parseFilters(search)) + Object.keys(parseCameraFilters(search)).length;
}

interface GraphTabsProps {
  config: GraphConfig;
  onChange: ConfigChange;
  /** Picking a preset, which the type nudge doesn't count as changing an axis. */
  onPreset: ConfigChange;
  /** Every photo, which the filters are read from. */
  photos: Photo[];
  /** The photos the filters keep, which the Range group's choices are read from. */
  list: Photo[];
}

/**
 * The Graph page's tabs over the graph: **Presets**, **Adjust Graph** and **Filters** on the left,
 * and **Save as preset** on the right. Each opens its own box under the tabs, and clicking the open
 * one again closes it. All are closed when the page opens.
 */
export function GraphTabs(props: GraphTabsProps) {
  const [tab, setTab] = useState<GraphTab | null>(null);
  const saved = useSavedGraphs();
  const filters = useFilterCount();
  const toggle = (next: GraphTab) => setTab(tab === next ? null : next);
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="Graph tools" className="flex flex-wrap items-center gap-2">
        <div className={CONTROL_FRAME}>
          {LEFT_TABS.map(([key, label, Icon]) => (
            <TabButton key={key} on={tab === key} Icon={Icon} onClick={() => toggle(key)}>
              {label}
              {key === "filters" && <FilterCount count={filters} />}
            </TabButton>
          ))}
        </div>
        <div className={`${CONTROL_FRAME} ml-auto`}>
          <TabButton on={tab === "save"} Icon={BookmarkPlus} onClick={() => toggle("save")}>
            Save as preset
          </TabButton>
        </div>
      </div>
      {tab && (
        <section role="tabpanel" aria-label={tabName(tab)} className={TAB_BOX}>
          <TabPanel {...props} tab={tab} saved={saved} onSaved={() => setTab("presets")} />
        </section>
      )}
    </div>
  );
}

/** How the box a tab opens looks. */
const TAB_BOX = "rounded-xl border bg-card p-4 text-card-foreground shadow-sm";

/** A tab's name, for its box. */
function tabName(tab: GraphTab): string {
  return LEFT_TABS.find(([key]) => key === tab)?.[1] ?? "Save as preset";
}

/** One tab: its icon and name, filled in while it's open. */
function TabButton({
  on,
  Icon,
  onClick,
  children,
}: {
  on: boolean;
  Icon: LucideIcon;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      onClick={onClick}
      className={controlButtonClass(on)}
    >
      <Icon aria-hidden />
      {children}
    </button>
  );
}

/** What the open tab shows. */
function TabPanel({
  tab,
  config,
  onChange,
  onPreset,
  photos,
  list,
  saved,
  onSaved,
}: GraphTabsProps & { tab: GraphTab; saved: SavedGraphs; onSaved: () => void }) {
  const panels: Record<GraphTab, () => ReactNode> = {
    presets: () => <PresetPicker config={config} list={list} saved={saved} onPick={onPreset} />,
    adjust: () => <GraphControls config={config} onChange={onChange} list={list} />,
    filters: () => <CameraFilterBar photos={photos} bare />,
    save: () => <SavePresetForm saved={saved} config={config} onSaved={onSaved} />,
  };
  return panels[tab]();
}
