# The automatic line

The automatic line is one walk through the day's photos in the order they were taken, broken where two photos are more than 2 hours apart, with a `car` drive across a big jump (two photos more than 15 km apart and taken within 6 hours of each other) and a `transit` hop where moving between two (more than 300 m apart) was faster than 6 km/h (`autoSegments` in `be-pipeline/internal/github/triplines_auto.go`). `GET /api/triplines/<day>/auto` answers it for the day as the next Commit would draw it.

A file with `"auto": true` keeps it on: it's worked out again at every Commit, so a photo added to that day later joins the line. Its `segments` hold the line as it was last worked out: when it's turned on, and again at each Commit when the photos draw it differently (`refreshAutoLines`), so the file and `TRIPLINES.json` show it as drawn.

The automatic line passes through the day's [trip stops](trip-stops.md) put on the route the way a line drawn by hand does: a stop after a photo the line walks on from becomes a via spot with `visit` on that walk (`withStopVias` in `triplines_auto_stops.go`, and the same in the editor's `lib/trip-stops-kept.ts`). A stop after a walk's last photo, or on a hop or drive, stays a pin.

> **Frontend analogy:** the segments are a cached copy of a derived value, like persisting a `useMemo` result next to its inputs and refreshing it whenever they change.
