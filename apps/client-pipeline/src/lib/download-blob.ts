/** Saves blob as a file named name on this computer, through the browser's download. */
export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  // The click starts the download at once; the link only needs to live until then.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
