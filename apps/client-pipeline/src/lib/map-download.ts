import type { MapDownload, MapLoadStep } from "@/api/transit";

/** What a map being loaded is doing, such as "Downloading OpenStreetMap's bus map of South Korea". */
export function downloadTitle({ map, step }: Pick<MapDownload, "map" | "step">): string {
  const titles: Record<MapLoadStep, string> = {
    checking: `Looking for ${map} on this computer`,
    waiting: `Waiting to download ${map}`,
    connecting: `Connecting to download ${map}`,
    downloading: `Downloading ${map}`,
    reading: `Reading ${map}`,
    saving: `Saving ${map}`,
    failed: `Couldn't load ${map}`,
  };
  return titles[step];
}

/** A size in megabytes, such as "120 MB", or in kilobytes under one megabyte. */
function sizeText(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.ceil(bytes / 1024)} KB`;
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

/** A time as minutes and seconds, such as "1:05". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How long is left at the rate so far, such as "about 2 min left"; "" when it can't be told. */
function timeLeft({ bytes, total, rate }: MapDownload): string {
  if (!total || !rate || bytes >= total) return "";
  const seconds = (total - bytes) / rate;
  return seconds < 60 ? "under a minute left" : `about ${Math.round(seconds / 60)} min left`;
}

/**
 * How far the step has got: for a download or a read, the size so far out of the total, the speed
 * and the time left, such as "412 of 1180 MB · 6.2 MB/s · about 2 min left"; otherwise how long
 * the step has taken, such as "0:12".
 */
export function downloadDetail(d: MapDownload): string {
  if ((d.step !== "downloading" && d.step !== "reading") || (d.bytes === 0 && !d.total)) {
    return clockText(d.stepSeconds);
  }
  const done = d.step === "reading" ? " read" : "";
  const size = d.total ? `${sizeText(d.bytes)} of ${sizeText(d.total)}${done}` : sizeText(d.bytes);
  const rate = d.rate ? `${sizeText(d.rate)}/s` : "";
  return [size, rate, timeLeft(d)].filter(Boolean).join(" · ");
}

/** How much of the file is downloaded or read, from 0 to 1; undefined while that can't be told. */
export function downloadShare({ step, bytes, total }: MapDownload): number | undefined {
  if ((step !== "downloading" && step !== "reading") || !total) return undefined;
  return Math.min(bytes / total, 1);
}

/** The stages of a first download, as the card lists them. */
export const DOWNLOAD_STAGES: { step: MapLoadStep; label: string }[] = [
  { step: "connecting", label: "Connect" },
  { step: "downloading", label: "Download" },
  { step: "reading", label: "Read" },
  { step: "saving", label: "Save" },
];

/** Whether stage is done, the one running now, or still to come, while the load is at step. */
export function stageState(stage: MapLoadStep, step: MapLoadStep): "done" | "now" | "next" {
  const order = DOWNLOAD_STAGES.map((s) => s.step);
  const at = order.indexOf(step);
  const i = order.indexOf(stage);
  if (at < 0) return "next";
  return i < at ? "done" : i === at ? "now" : "next";
}

/** Where a file comes from, such as "download.geofabrik.de/asia/south-korea-latest.osm.pbf". */
export function sourceText(url: string | undefined): string {
  return url ? url.replace(/^\w+:\/\//, "") : "";
}
