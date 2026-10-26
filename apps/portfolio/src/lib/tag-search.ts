import type { TagEntry, TagSection } from "@/lib/tag-list";

/** Whether the tag's name or description has the text in it, whatever its case. */
function matches(entry: TagEntry, text: string): boolean {
  const { name, description = "" } = entry.tag;
  return `${name} ${description}`.toLowerCase().includes(text);
}

/**
 * The section as a search for the text shows it: whole when its parent tag matches; else with only
 * the tags under it that match and without the parent's own photos; else nothing.
 */
function searchSection(section: TagSection, text: string): TagSection[] {
  if (matches(section.parent, text)) return [section];
  const children = section.children.filter((entry) => matches(entry, text));
  return children.length > 0 ? [{ ...section, own: [], children }] : [];
}

/**
 * The sections whose tags have the search text in their name or description, ignoring case and
 * the spaces around it; every section for an empty search. A parent tag stays to head the tags
 * under it that match.
 */
export function searchTags(sections: TagSection[], query: string): TagSection[] {
  const text = query.trim().toLowerCase();
  if (text === "") return sections;
  return sections.flatMap((section) => searchSection(section, text));
}
