import { mutationOptions } from "@tanstack/react-query";
import type { CombinedData } from "@/api/photos";
import { entryId } from "@/api/places";
import { requestJson } from "@/api/settings";
import type { FileChange } from "@/lib/optimistic";

/** A photo field a metadata group can group the values of, as the photo files name it. */
export type MetaField = "camera" | "lens" | "focalLength" | "aperture" | "exposure" | "iso";

/** One value of a metadata field, as the photo files have it: a string or a number. */
export type MetaValue = string | number;

/** A field the Metadata Groups page has a tab for. */
export interface MetaFieldInfo {
  field: MetaField;
  /** The tab's title, such as "Focal lengths". */
  title: string;
  /** One value's name, such as "focal length". */
  one: string;
  /** Whether the photo files have its values as numbers. */
  numeric: boolean;
  /**
   * Whether its values read as numbers (an exposure such as "1/250" as seconds), so its groups are
   * a range chosen with a slider rather than a list of values.
   */
  ranged: boolean;
  /** An example group, for the name field's help. */
  example: string;
}

/** The fields, in the order the page's tabs show them. */
export const META_FIELDS: MetaFieldInfo[] = [
  {
    field: "camera",
    title: "Cameras",
    one: "camera",
    numeric: false,
    ranged: false,
    example: "Canon bodies",
  },
  {
    field: "lens",
    title: "Lenses",
    one: "lens",
    numeric: false,
    ranged: false,
    example: "Canon lenses, or one lens for each way EXIF spells it",
  },
  {
    field: "focalLength",
    title: "Focal lengths",
    one: "focal length",
    numeric: true,
    ranged: true,
    example: "Wide angle, for 10 to 24 mm",
  },
  {
    field: "aperture",
    title: "Apertures",
    one: "aperture",
    numeric: true,
    ranged: true,
    example: "Wide open, for f/1.4 to f/2.8",
  },
  {
    field: "exposure",
    title: "Exposures",
    one: "exposure",
    numeric: false,
    ranged: true,
    example: "Long exposure, for 1 s and longer",
  },
  {
    field: "iso",
    title: "ISO",
    one: "ISO",
    numeric: true,
    ranged: true,
    example: "Low light, for ISO 1600 and up",
  },
];

/** A range of numbers: focal lengths in mm, apertures as f-numbers, ISO, or exposures in seconds. */
export interface MetaRange {
  min: number;
  max: number;
}

/**
 * A metadata group file: a named set of values of one photo field, such as "Wide angle" for focal
 * lengths 10 to 24, or every EXIF spelling of one lens. A group can be inside another of its field. Commit combines them into METAINFO.json.
 */
export interface MetaGroup {
  /** Made from the field and the name when the group is made, and kept after that. */
  id: string;
  name: string;
  description: string;
  field: MetaField;
  /** The ID of the group of the same field this one is in, such as "Canon" for "Canon kit lenses"; "" for none. */
  parent?: string;
  /** The values in the group, as the photo files have them; empty for a range. */
  values: MetaValue[];
  /** For a focal length, aperture, exposure or ISO group, every value from min to max, both included. */
  range?: MetaRange;
}

/** What saving or removing a metadata group did; nothing is saved when it already had that content. */
interface MetaGroupResult {
  path: string;
  /** The file as saved, or null when it was removed. */
  data: MetaGroup | null;
  /** The file before, or null when it's new. */
  before: MetaGroup | null;
  changed: boolean;
}

function isMetaGroup(value: unknown): value is MetaGroup {
  const v = value as Partial<MetaGroup> | null;
  return typeof v?.id === "string" && Array.isArray(v.values);
}

/** METAINFO.json as the next Commit will have it, with the changes since. */
function metaFile(data: CombinedData) {
  return (data.head ?? data.base).metainfo;
}

/** The metadata groups as the next Commit will have them: METAINFO.json with the changes since. */
export function metaGroups(data: CombinedData | undefined): MetaGroup[] {
  const entries = data ? metaFile(data).data : undefined;
  return (entries ?? []).filter(isMetaGroup);
}

/** The ID a new group gets, such as `focal-length-wide-angle`. */
export function metaGroupId(field: MetaField, name: string): string {
  const prefix = field.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  return `${prefix}-${entryId(name)}`.slice(0, 100).replace(/-+$/, "");
}

/** The change a save or removal made, for the combined lists; a new file has no `before`. */
function metaChange({ path, data, before }: MetaGroupResult): FileChange[] {
  const change: FileChange = { kind: "metainfo", path, after: data };
  return [before === null ? change : { ...change, before }];
}

const metaMeta = {
  saves: (result: unknown) => (result as MetaGroupResult).changed,
  changes: (result: unknown) => metaChange(result as MetaGroupResult),
};

/** Saves a metadata group, new or changed, as a change waiting for Commit. */
export const saveMetaGroupMutation = mutationOptions({
  mutationKey: ["metainfo", "save"],
  scope: { id: "photo-data-entries" },
  meta: metaMeta,
  mutationFn: (group: MetaGroup) =>
    requestJson<MetaGroupResult>(`/api/metainfo/${encodeURIComponent(group.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(group),
    }),
});

/** Removes a metadata group, as a change waiting for Commit. */
export const deleteMetaGroupMutation = mutationOptions({
  mutationKey: ["metainfo", "delete"],
  scope: { id: "photo-data-entries" },
  meta: metaMeta,
  mutationFn: (id: string) =>
    requestJson<MetaGroupResult>(`/api/metainfo/${encodeURIComponent(id)}`, { method: "DELETE" }),
});
