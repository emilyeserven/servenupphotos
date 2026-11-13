import type { GraphStat } from "@portfolio/lib/graph-data";

/**
 * The Graph's stats with each ID once: a Numbers page group whose ID is also a camera setting's,
 * such as the Exposure Triangle's Aperture ranges, gets `-ranges` added to its ID and " ranges" to
 * its label, so the camera setting (every value) keeps the plain ID that presets and links use.
 */
export function uniqueStats(numbers: GraphStat[], settings: GraphStat[]): GraphStat[] {
  const taken = new Set(settings.map((stat) => stat.id));
  const renamed = numbers.map((stat) =>
    taken.has(stat.id) ? { ...stat, id: `${stat.id}-ranges`, label: `${stat.label} ranges` } : stat,
  );
  return [...renamed, ...settings];
}
