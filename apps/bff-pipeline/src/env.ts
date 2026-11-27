import path from "node:path";
import { DEFAULT_NOMINATIM_URL, DEFAULT_WIKIDATA_URL, serverUrl } from "./lib/area-finder.js";
import { overpassUrls } from "./lib/overpass.js";
import { DEFAULT_PHOTON_URL } from "./lib/photon.js";
import { DEFAULT_TRANSITLAND_URL } from "./lib/transitland.js";

export const env = {
  host: process.env.HOST ?? "0.0.0.0",
  port: Number(process.env.PORT ?? 8080),
  /** Base URL of the Go backend (be-pipeline). */
  apiUrl: process.env.API_URL ?? "http://localhost:8081",
  /** Built client-pipeline assets. Served only when the directory exists (i.e. production). */
  clientDist:
    process.env.CLIENT_DIST ?? path.resolve(import.meta.dirname, "../../client-pipeline/dist"),
  /** CARTO_KEY from the repo's .env, which CARTO's basemap tiles need; "" when it isn't set. */
  cartoKey: (process.env.CARTO_KEY ?? "").trim(),
  /** The Nominatim server the area search asks: NOMINATIM_URL, or else OpenStreetMap's. */
  nominatimUrl: serverUrl(process.env.NOMINATIM_URL, DEFAULT_NOMINATIM_URL),
  /** The Wikidata server the area search asks: WIKIDATA_URL, or else Wikidata's own. */
  wikidataUrl: serverUrl(process.env.WIKIDATA_URL, DEFAULT_WIKIDATA_URL),
  /** The Overpass servers the transit look-ups ask, in order: OVERPASS_URL, comma-separated, or else the public ones. */
  overpassUrls: overpassUrls(process.env.OVERPASS_URL),
  /** The Photon server station searches ask: PHOTON_URL, or else komoot's public one. */
  photonUrl: process.env.PHOTON_URL?.trim() || DEFAULT_PHOTON_URL,
  /** Transitland's REST API: TRANSITLAND_URL, or else Transitland's own. */
  transitlandUrl: process.env.TRANSITLAND_URL?.trim() || DEFAULT_TRANSITLAND_URL,
  /** TRANSITLAND_API_KEY, which Transitland's look-ups need; "" when it isn't set. */
  transitlandKey: (process.env.TRANSITLAND_API_KEY ?? "").trim(),
};
