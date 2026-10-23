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
  /** An example group, for the name field's help. */
  example: string;
}

/** The fields, in the order the page's tabs show them. */
export const META_FIELDS: MetaFieldInfo[] = [
  { field: "camera", title: "Cameras", one: "camera", numeric: false, example: "Canon bodies" },
  {
    field: "lens",
    title: "Lenses",
    one: "lens",
    numeric: false,
    example: "EF-S 10-18mm, for each way EXIF spells it",
  },
  {
    field: "focalLength",
    title: "Focal lengths",
    one: "focal length",
    numeric: true,
    example: "Wide angle, for 10 to 24 mm",
  },
  { field: "aperture", title: "Apertures", one: "aperture", numeric: true, example: "Wide open" },
  {
    field: "exposure",
    title: "Exposures",
    one: "exposure",
    numeric: false,
    example: "Long exposure",
  },
  { field: "iso", title: "ISO", one: "ISO", numeric: true, example: "Low light" },
];

/**
 * A metadata group file: a named set of values of one photo field, such as "Wide angle" for focal
 * lengths 10 to 24, or every EXIF spelling of one lens. Commit combines them into METAINFO.json.
 */
export interface MetaGroup {
  /** Made from the field and the name when the group is made, and kept after that. */
  id: string;
  name: string;
  description: string;
  field: MetaField;
  values: MetaValue[];
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
