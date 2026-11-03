// Draws the map credit the preview image carries ("© OpenStreetMap contributors © CARTO", as the
// portfolio's map shows it) and writes it to src/attribution.ts as a PNG, since a Worker has no
// fonts to draw text with. Run it again only to change the wording:
//   pnpm --filter @servenup/map-preview-worker attribution
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright-core";

const out = path.join(import.meta.dirname, "../src/attribution.ts");
// CHROMIUM_PATH picks a browser other than the one playwright-core expects.
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(`<span id="credit" style="display:inline-block;padding:2px 6px;
  font:12px/16px system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:rgba(0,0,0,.75);
  background:rgba(255,255,255,.7);border-top-left-radius:6px">© OpenStreetMap contributors © CARTO</span>`);
const png = await page.locator("#credit").screenshot({ omitBackground: true });
await browser.close();
await writeFile(
  out,
  `// Made by scripts/make-attribution.mjs; don't edit by hand.

/** The map credit drawn in the preview image's bottom right corner, as a base64 PNG. */
export const ATTRIBUTION_PNG =
  "${png.toString("base64")}";
`,
);
