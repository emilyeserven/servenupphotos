import type { GraphPresetFile } from "@portfolio/lib/graph-presets";
import { settingEntries, settingMutations } from "@/api/data-files";
import { entryId } from "@/api/places";

function isPresetFile(value: unknown): value is GraphPresetFile {
  const file = value as Partial<GraphPresetFile> | null;
  return typeof file?.id === "string" && typeof file.name === "string";
}

/** The graph presets and preset groups as the next Commit will have them: GRAPHS.json with the changes since. */
export const graphPresetFiles = settingEntries("graphs", isPresetFile);

/**
 * The ID a new preset or group gets from its name, such as `focal-length`, with a number after it
 * when another file already has it, such as `focal-length-2`.
 */
export function newPresetId(name: string, files: GraphPresetFile[]): string {
  const base = entryId(name).slice(0, 60).replace(/-+$/, "") || "preset";
  const taken = new Set(files.map((file) => file.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

/** The order that puts a new preset or group last in the row, after the groups and the presets in none. */
export function lastOrder(files: GraphPresetFile[]): number {
  const row = files.filter((file) => file.kind === "group" || !file.group);
  return Math.max(0, ...row.map((file) => file.order)) + 1;
}

const presetMutations = settingMutations<GraphPresetFile>("graphs");

/** Saves a graph preset or preset group, new or changed, as a change waiting for Commit. */
export const savePresetMutation = presetMutations.save;

/** Removes a graph preset or preset group, as a change waiting for Commit. */
export const deletePresetMutation = presetMutations.remove;
