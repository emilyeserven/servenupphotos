import { type ZipEntry, zipFiles } from "@/lib/zip";

/** The folder the extension's zip unpacks to, which Chrome's Load unpacked asks for. */
export const EXTENSION_FOLDER = "servenup-edit-in-pipeline";

/** The hosts the extension's button is lit on: the portfolio, and a copy of it on this computer. */
const PORTFOLIO_HOSTS = ["servenupphotos.net", "www.servenupphotos.net", "localhost", "127.0.0.1"];

/** The extension's manifest: one toolbar button, and no access to any page until it's clicked. */
function manifest(pipelineOrigin: string): string {
  return `${JSON.stringify(
    {
      manifest_version: 3,
      name: "Edit in Pipeline",
      version: "1.0",
      description: `Opens the photo pipeline (${pipelineOrigin}) at the page that edits what you're looking at on the portfolio.`,
      action: { default_title: "Edit in the pipeline" },
      background: { service_worker: "background.js" },
      permissions: ["activeTab", "declarativeContent"],
    },
    null,
    2,
  )}\n`;
}

/**
 * The extension's service worker. It lights the button only on the portfolio, and a click opens
 * the pipeline's `/quick-edit` with the tab's link, next to the tab, where Quick Edit's own
 * matching (`lib/quick-edit.ts`) picks the page.
 */
function background(pipelineOrigin: string): string {
  const conditions = PORTFOLIO_HOSTS.map(
    (host) =>
      `new chrome.declarativeContent.PageStateMatcher({ pageUrl: { hostEquals: "${host}" } })`,
  ).join(",\n          ");
  return `// Made by the pipeline's Settings page for the pipeline at this address.
const PIPELINE = ${JSON.stringify(pipelineOrigin)};

// The button is greyed out except on the portfolio.
chrome.runtime.onInstalled.addListener(() => {
  chrome.action.disable();
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [
          ${conditions},
        ],
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
});

// A click opens the pipeline's Quick Edit for this tab's link, in a new tab beside it.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url) return;
  chrome.tabs.create({
    url: PIPELINE + "/quick-edit?url=" + encodeURIComponent(tab.url),
    index: tab.index + 1,
    openerTabId: tab.id,
  });
});
`;
}

/** The extension's files, each in its folder, for the pipeline at this address (`location.origin`). */
export function chromeExtensionFiles(pipelineOrigin: string): ZipEntry[] {
  return [
    { path: `${EXTENSION_FOLDER}/manifest.json`, text: manifest(pipelineOrigin) },
    { path: `${EXTENSION_FOLDER}/background.js`, text: background(pipelineOrigin) },
  ];
}

/** The extension as a zip, ready to unpack and load in Chrome. */
export function chromeExtensionZip(pipelineOrigin: string): Blob {
  return new Blob([zipFiles(chromeExtensionFiles(pipelineOrigin))], { type: "application/zip" });
}
