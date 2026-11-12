import { DownloadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { chromeExtensionZip, EXTENSION_FOLDER } from "@/lib/chrome-extension";

/** Saves the extension's zip, made for the pipeline at this page's own address. */
function downloadExtension() {
  const url = URL.createObjectURL(chromeExtensionZip(window.location.origin));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${EXTENSION_FOLDER}.zip`;
  link.click();
  // The click starts the download at once; the link only needs to live until then.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Settings' Edit in Pipeline card: downloads the Chrome extension whose toolbar button, on the
 * portfolio, opens this pipeline's page for what the tab shows (`docs/chrome-extension.md`).
 */
export function ChromeExtensionCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit in Pipeline (Chrome extension)</CardTitle>
        <CardDescription>
          A toolbar button for Chrome: on any page of the portfolio, click it to open the page here
          that edits what you're looking at, the way Quick Edit does with a pasted link. It opens
          the pipeline at{" "}
          <span className="font-medium text-foreground">{window.location.origin}</span>, so download
          it again if you open the pipeline at another address.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div>
          <Button type="button" onClick={downloadExtension}>
            <DownloadIcon aria-hidden />
            Download extension
          </Button>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            Unzip it. You get a folder named <code>{EXTENSION_FOLDER}</code>.
          </li>
          <li>
            In Chrome, go to <code>chrome://extensions</code> and turn on{" "}
            <span className="text-foreground">Developer mode</span> (top right).
          </li>
          <li>
            Click <span className="text-foreground">Load unpacked</span> and pick that folder. To
            update it, replace the folder's files and click the extension's reload arrow.
          </li>
          <li>
            Pin it from the puzzle-piece menu. Its button lights up on the portfolio, and a click
            opens the editor in a new tab.
          </li>
        </ol>
      </CardContent>
    </Card>
  );
}
