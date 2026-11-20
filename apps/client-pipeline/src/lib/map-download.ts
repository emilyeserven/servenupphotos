import type { MapDownload } from "@/api/transit";

/** What a map being loaded is doing, such as "Downloading OpenStreetMap's bus map of South Korea". */
export function downloadTitle({ map, step }: Pick<MapDownload, "map" | "step">): string {
  if (step === "downloading") return `Downloading ${map}`;
  if (step === "reading") return `Reading ${map}`;
  return `Opening ${map}`;
}

/** A size in megabytes, such as "120 MB", or in kilobytes under one megabyte. */
function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${Math.round(mb)} MB`;
}

/** A time as minutes and seconds, such as "1:05". */
function clockText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * How far a download has got, such as "120 of 310 MB · 0:45", or just the size so far when its
 * total isn't known; how long it has taken while it's being opened or read.
 */
export function downloadDetail({ step, bytes, total, seconds }: MapDownload): string {
  const time = clockText(seconds);
  if (step !== "downloading") return time;
  const size = total
    ? `${sizeText(bytes).replace(/ [KM]B$/, "")} of ${sizeText(total)}`
    : sizeText(bytes);
  return `${size} · ${time}`;
}

/** How much of the file is downloaded, from 0 to 1; undefined while that can't be told. */
export function downloadShare({ step, bytes, total }: MapDownload): number | undefined {
  if (step !== "downloading" || !total) return undefined;
  return Math.min(bytes / total, 1);
}

/** What happens during the step, said under the bar. */
export function downloadNote(step: MapDownload["step"]): string {
  if (step === "downloading") {
    return "It's downloaded once and kept on this computer, so later look-ups are quick. The lines are looked up as soon as it's ready.";
  }
  if (step === "reading") {
    return "The download is done; it's being read into lines and stops, which can take a few minutes for a large country.";
  }
  return "It's on this computer already and is being read, once per start of the pipeline.";
}
