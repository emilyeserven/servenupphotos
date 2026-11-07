import { useState } from "react";
import { currentType } from "@/lib/graph-data";
import type { GraphPreset, PresetGraph } from "@/lib/graph-presets";

/** Where the visitor's own presets are kept in their browser. */
const STORAGE_KEY = "servenup:graph-presets";

/** Whether a stored value looks like a preset this page saved. */
function isSaved(value: unknown): value is GraphPreset {
  const preset = value as Partial<GraphPreset> | null;
  return typeof preset?.id === "string" && typeof preset.name === "string";
}

/** A saved preset with its graph's type as it is now, such as the old Dot type as Photo dots. */
function upgraded(preset: GraphPreset): GraphPreset {
  return { ...preset, graph: { ...preset.graph, type: currentType(preset.graph.type) } };
}

/** The visitor's presets from their browser; none when there are none or it can't be read. */
function readSaved(): GraphPreset[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(stored) ? stored.filter(isSaved).map(upgraded) : [];
  } catch {
    return [];
  }
}

/** Keeps the presets in the browser; they stay for this visit only when it can't. */
function writeSaved(presets: GraphPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Private windows and blocked storage: the presets still work until the page is left.
  }
}

/** The visitor's own presets, and saving and removing one. */
export interface SavedGraphs {
  presets: GraphPreset[];
  save: (name: string, graph: PresetGraph) => void;
  remove: (id: string) => void;
}

/**
 * The presets the visitor saved on the Graph page, kept in their browser's local storage and
 * shown after the site's own. Each keeps the graph's settings but not its filters.
 */
export function useSavedGraphs(): SavedGraphs {
  const [presets, setPresets] = useState(readSaved);
  const change = (next: GraphPreset[]) => {
    setPresets(next);
    writeSaved(next);
  };
  return {
    presets,
    save: (name, graph) => change([...presets, { id: `${Date.now()}`, name, graph }]),
    remove: (id) => change(presets.filter((preset) => preset.id !== id)),
  };
}
