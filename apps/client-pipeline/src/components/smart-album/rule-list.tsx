import type { SmartRules } from "@portfolio/lib/smart-albums";
import type { TimelineLabel } from "@portfolio/lib/timeline-labels";

/** What each rule is called in the list of a Smart Album's rules. */
const RULE_NAMES: Record<string, string> = {
  country: "Country",
  state: "State",
  city: "City",
  place: "Place",
  album: "Album",
  tag: "Tag",
  genre: "Genre",
  ids: "Chosen photos",
  camera: "Camera",
  lens: "Lens",
  cameraGroup: "Camera group",
  lensGroup: "Lens group",
  iso: "ISO",
  exposure: "Exposure",
  focalLength: "Focal length",
  aperture: "Aperture",
  time: "Time of day",
  orientation: "Orientation",
  color: "Color",
  match: "Color match",
  min: "Color share at least",
  vivid: "Vividness at least",
  measure: "Vividness measure",
  label: "Trip",
  from: "Taken on or after",
  to: "Taken on or before",
};

/** A rule's value as text: a list joined with commas, chosen photos by how many. */
function valueText(key: string, value: unknown): string {
  if (!Array.isArray(value)) return String(value);
  return key === "ids" ? `${value.length} photos` : value.join(", ");
}

/** The Trip's name, or its ID when it's gone. */
function labelName(id: unknown, labels: TimelineLabel[]): string {
  return labels.find((label) => label.id === id)?.name ?? String(id);
}

/**
 * A Smart Album's rules as a list of what each filter is set to, such as "Tag: night", with the
 * Trip by its name from labels.
 */
export function RuleList({ rules, labels }: { rules: SmartRules; labels: TimelineLabel[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {Object.entries(rules).map(([key, value]) => (
        <li key={key} className="bg-muted rounded-full border px-2.5 py-0.5 text-xs">
          <span className="text-muted-foreground">{RULE_NAMES[key] ?? key}:</span>{" "}
          {key === "label" ? labelName(value, labels) : valueText(key, value)}
        </li>
      ))}
    </ul>
  );
}
