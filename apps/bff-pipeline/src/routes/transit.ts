import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";
import { relayToBackend } from "../lib/backend.js";
import {
  overpassLines,
  overpassStations,
  overpassStops,
  overpassTrack,
} from "../lib/overpass-lookups.js";
import { OverpassClient } from "../lib/overpass.js";
import { photonStationSearch } from "../lib/photon.js";
import { firstParam, pathEscape } from "../lib/query.js";
import { timeoutFor } from "../lib/timeouts.js";
import {
  type Answer,
  asksMap,
  isAnswer,
  lineIdOf,
  linesAnswer,
  nearOf,
  onlineSource,
  searched,
  settle,
  spotsOf,
  stationsAnswer,
  stopsAnswer,
  TRANSIT_TIMEOUT_MS,
  trackAnswer,
} from "../lib/transit-answers.js";
import { TransitlandClient } from "../lib/transitland.js";
import { RELAY_HEADERS } from "./relay.js";

/** The request's path parameters on a line's routes. */
interface LineParams {
  Params: { id: string };
}

/**
 * The transit look-ups a trip line's hop uses, answered here for OpenStreetMap's Overpass servers,
 * Transitland and Photon (see docs/bff-routes.md). A request for a rail or bus map
 * (`?source=mlit|osmrail|osmbus`) is relayed to the Go backend, which downloads and reads those
 * maps, as is `GET /transit/downloads`, which the catch-all relay handles.
 */
export const transitRoutes: FastifyPluginAsync = async (app) => {
  const overpass = new OverpassClient({ urls: env.overpassUrls, log: app.log });
  const transitland = new TransitlandClient({
    url: env.transitlandUrl,
    key: env.transitlandKey,
    log: app.log,
  });
  const photon = { url: env.photonUrl, log: app.log };

  /** Relays a rail or bus map request to the Go backend, as the catch-all relay would. */
  function relay(request: FastifyRequest, reply: FastifyReply) {
    const path = request.url.replace(/^\/api/, "");
    return relayToBackend(reply, app.log, path, {
      method: "GET",
      timeoutMs: timeoutFor(path),
      relayHeaders: RELAY_HEADERS,
    });
  }

  /** Sends an answer. */
  function send(reply: FastifyReply, answer: Answer) {
    return reply.code(answer.status).send(answer.body);
  }

  app.get("/transit/lines", async (request, reply) => {
    if (asksMap(request.query)) return relay(request, reply);
    const spots = spotsOf(request.query);
    if (isAnswer(spots)) return send(reply, spots);
    const source = onlineSource(request.query);
    const mode = firstParam(request.query, "mode");
    const signal = AbortSignal.timeout(TRANSIT_TIMEOUT_MS);
    const answer = await settle(
      () =>
        source === ""
          ? overpassLines(overpass, mode, spots.from, spots.to, signal)
          : transitland.lines(mode, spots.from, spots.to, signal),
      linesAnswer,
    );
    if (answer.status === 200) reply.header("x-transit-searched", pathEscape(searched(source)));
    return send(reply, answer);
  });

  /**
   * The line a track or stops request asks about, or undefined once it has been relayed to Go (a
   * rail or bus map) or answered with a 400 (not a line's ID).
   */
  async function lineAsked(
    request: FastifyRequest<LineParams>,
    reply: FastifyReply,
  ): Promise<number | undefined> {
    if (asksMap(request.query)) {
      await relay(request, reply);
      return undefined;
    }
    const id = lineIdOf(request.params.id);
    if (!isAnswer(id)) return id;
    await send(reply, id);
    return undefined;
  }

  app.get<LineParams>("/transit/lines/:id/track", async (request, reply) => {
    const id = await lineAsked(request, reply);
    if (id === undefined) return reply;
    const spots = spotsOf(request.query);
    if (isAnswer(spots)) return send(reply, spots);
    const signal = AbortSignal.timeout(TRANSIT_TIMEOUT_MS);
    const transitlandAsked = onlineSource(request.query) !== "";
    const answer = await settle(
      () =>
        transitlandAsked
          ? transitland.track(id, spots.from, spots.to, signal)
          : overpassTrack(overpass, id, spots.from, spots.to, signal),
      trackAnswer,
    );
    return send(reply, answer);
  });

  app.get<LineParams>("/transit/lines/:id/stops", async (request, reply) => {
    const id = await lineAsked(request, reply);
    if (id === undefined) return reply;
    const signal = AbortSignal.timeout(TRANSIT_TIMEOUT_MS);
    const transitlandAsked = onlineSource(request.query) !== "";
    const answer = await settle(
      () =>
        transitlandAsked ? transitland.stops(id, signal) : overpassStops(overpass, id, signal),
      stopsAnswer,
    );
    return send(reply, answer);
  });

  app.get("/transit/stations", async (request, reply) => {
    const near = nearOf(request.query);
    if (isAnswer(near)) return send(reply, near);
    const mode = firstParam(request.query, "mode");
    const name = firstParam(request.query, "q");
    const signal = AbortSignal.timeout(TRANSIT_TIMEOUT_MS);
    const answer = await settle(
      () =>
        firstParam(request.query, "source") === "photon"
          ? photonStationSearch(photon, mode, name, near, signal)
          : overpassStations(overpass, mode, name, near, signal),
      stationsAnswer,
    );
    return send(reply, answer);
  });
};
