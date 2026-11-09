// Sample answers for the routes in routes_triplines.go.
import { FOLDER, added, headPhotos, pendingSave } from "./shared.mjs";

/** A photo's GPS spot as [longitude, latitude], read from its "51 deg 24' 46.80\" N, …" position. */
function photoSpot(id) {
  const gps = headPhotos.find((p) => p.data.id === id)?.data.gpsPosition;
  const parts = gps?.match(/[\d.]+ deg [\d.]+' [\d.]+" [NSEW]/g) ?? [];
  const [lat, lng] = parts.map((part) => {
    const [d, m, sec] = part.match(/[\d.]+/g).map(Number);
    return (d + m / 60 + sec / 3600) * (/[SW]/.test(part) ? -1 : 1);
  });
  return lat === undefined ? undefined : [lng, lat];
}

/** The segment's via spots after a photo (or after its start, for undefined), as [longitude, latitude]. */
const viaSpots = (segment, after) =>
  (segment.via ?? []).filter((v) => v.after === after).map((v) => [v.longitude, v.latitude]);

/** A pretend street path through a segment's spots: each stretch turns one corner, like a city block. */
function blockPath(segment) {
  const spots = [
    segment.start && [segment.start.longitude, segment.start.latitude],
    ...viaSpots(segment, undefined),
    ...segment.photos.flatMap((id) => [photoSpot(id), ...viaSpots(segment, id)]),
    segment.end && [segment.end.longitude, segment.end.latitude],
  ].filter(Boolean);
  return spots.flatMap((spot, i) => (i === 0 ? [spot] : [[spot[0], spots[i - 1][1]], spot]));
}

/** The Snap to streets answer: every walk, bus or car segment gets a block-shaped path. */
const snapped = ({ body }) => ({
  line: {
    ...body,
    segments: body.segments.map((s) =>
      ["walk", "bus", "car"].includes(s.mode) ? { ...s, path: blockPath(s) } : s,
    ),
  },
  unrouted: 0,
});

/** A pretend track between ?from= and ?to=, bending out to one side like a line around a block. */
function curvedTrack({ url }) {
  const [from, to] = ["from", "to"].map((k) => url.searchParams.get(k).split(",").map(Number));
  const bend = [(from[0] + to[0]) / 2 + (to[1] - from[1]) * 0.3, (from[1] + to[1]) / 2];
  const steps = [0, 0.25, 0.5, 0.75, 1];
  const along = steps.map((t) => [
    (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * bend[0] + t ** 2 * to[0],
    (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * bend[1] + t ** 2 * to[1],
  ]);
  return { path: along };
}

/** Pretend stops along the line between photos 304 and 305, the last one a walk short of 305. */
function lineStops() {
  const [a, b] = [photoSpot(304), photoSpot(305)];
  const at = (t, dx = 0) => ({
    latitude: a[1] + (b[1] - a[1]) * t,
    longitude: a[0] + (b[0] - a[0]) * t + dx,
  });
  return [
    { name: "Namba", ...at(0.02, 0.0004) },
    { name: "Shinsaibashi", ...at(0.35, 0.002) },
    { name: "Yodoyabashi", ...at(0.65, 0.002) },
    { name: "Umeda", ...at(0.85, 0.0006) },
  ];
}

/** The sample answers for the triplines routes, keyed "METHOD /api/path". */
export function triplinesFixtures() {
  return {
    "GET /api/triplines/2026-10-26/auto": {
      id: "2026-10-26",
      day: "2026-10-26",
      auto: false,
      segments: [
        { mode: "walk", photos: [409, 410, 412, 414, 416] },
        { mode: "walk", photos: [444, 445] },
      ],
    },
    "GET /api/triplines/2026-11-01/auto": {
      id: "2026-11-01",
      day: "2026-11-01",
      auto: false,
      segments: [
        { mode: "walk", photos: [481, 482, 485, 486, 488, 469, 470, 475] },
        { mode: "transit", photos: [475, 495] },
        { mode: "walk", photos: [495, 496, 497, 471] },
      ],
    },
    "POST /api/triplines/2026-10-01/route": snapped,
    "GET /api/areas": [
      {
        name: "Upper East Side",
        place: "Upper East Side, Manhattan, New York County, New York, United States",
        kind: "neighbourhood",
        osm: "R1",
        shape: [
          [
            [
              [-73.9727, 40.7644],
              [-73.959, 40.7584],
              [-73.942, 40.782],
              [-73.955, 40.788],
              [-73.9727, 40.7644],
            ],
          ],
        ],
      },
    ],
    "GET /api/transit/lines": [
      {
        id: 1,
        name: "Midosuji Line",
        ref: "M",
        colour: "#e5171f",
        kind: "subway",
        from: "Nakamozu",
        to: "Esaka",
      },
      {
        id: 2,
        name: "Midosuji Line",
        ref: "M",
        colour: "#e5171f",
        kind: "subway",
        from: "Esaka",
        to: "Nakamozu",
      },
    ],
    "GET /api/transit/lines/1/stops": lineStops,
    "GET /api/transit/stations": [
      { name: "難波", nameEn: "Namba", latitude: 34.6654, longitude: 135.5013, km: 0.4 },
      { name: "大阪難波", nameEn: "Osaka Namba", latitude: 34.6672, longitude: 135.4986, km: 0.6 },
      { name: "南海難波", nameEn: "Nankai Namba", latitude: 34.6627, longitude: 135.5018, km: 0.8 },
    ],
    "GET /api/transit/lines/1/track": curvedTrack,
    "DELETE /api/triplines/2026-10-01": () => ({
      ...pendingSave(),
      path: `${FOLDER}/triplines/2026-10-01.json`,
      data: null,
      before: added.triplines[0].data,
      changed: true,
    }),
    "PUT /api/triplines/2026-10-01": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/triplines/2026-10-01.json`,
      data: body,
      before: added.triplines[0].data,
      changed: true,
    }),
    "DELETE /api/tripstories/story-2026-10-01": () => ({
      ...pendingSave(),
      path: `${FOLDER}/triplines/story-2026-10-01.json`,
      data: null,
      before: added.triplines[1].data,
      changed: true,
    }),
    "PUT /api/tripstories/story-2026-10-01": ({ body }) => ({
      ...pendingSave(),
      path: `${FOLDER}/triplines/story-2026-10-01.json`,
      data: body,
      before: added.triplines[1].data,
      changed: true,
    }),
  };
}
