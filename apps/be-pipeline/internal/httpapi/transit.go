package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/transit"
)

// transitFinder looks up the transit lines on the rail and bus maps (see
// transit.New): the ones near two spots, and one's track between them. The
// BFF answers the Overpass, Transitland and Photon look-ups itself and relays
// only these (docs/bff-routes.md).
type transitFinder interface {
	MLITLines(ctx context.Context, mode string, from, to [2]float64) ([]transit.Line, error)
	MLITTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error)
	MLITStops(ctx context.Context, id int64) ([]transit.Stop, error)
	OSMRailLines(ctx context.Context, mode string, from, to [2]float64) ([]transit.Line, error)
	OSMRailTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error)
	OSMRailStops(ctx context.Context, id int64) ([]transit.Stop, error)
	OSMBusLines(ctx context.Context, mode string, from, to [2]float64) ([]transit.Line, error)
	OSMBusTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error)
	OSMBusStops(ctx context.Context, id int64) ([]transit.Stop, error)
	RailRides(ctx context.Context, source string, id int64, from, to [2]float64) ([]transit.RouteRide, error)
	Downloads() []transit.Download
	Searched(source string, from, to [2]float64) string
}

// lineSource is the map the request asks for lines on: ?source=mlit for
// Japan's rail map, ?source=osmrail for a country's OpenStreetMap rail map,
// ?source=osmbus for its bus map, or else "" for none of them.
func lineSource(r *http.Request) string {
	switch src := r.URL.Query().Get("source"); src {
	case transit.SourceMLIT, transit.SourceOSMRail, transit.SourceOSMBus:
		return src
	}
	return ""
}

// errNoMap is a request for a source other than the rail and bus maps,
// which the BFF answers and never relays here.
var errNoMap = errors.New("the backend only looks lines up on the rail and bus maps; the BFF answers OpenStreetMap's Overpass servers and Transitland")

// linesSource is the lines look-up the request asks for.
func linesSource(finder transitFinder, r *http.Request) func(context.Context, string, [2]float64, [2]float64) ([]transit.Line, error) {
	switch lineSource(r) {
	case transit.SourceMLIT:
		return finder.MLITLines
	case transit.SourceOSMRail:
		return finder.OSMRailLines
	case transit.SourceOSMBus:
		return finder.OSMBusLines
	}
	return func(context.Context, string, [2]float64, [2]float64) ([]transit.Line, error) { return nil, errNoMap }
}

// trackSource is the track look-up the request asks for.
func trackSource(finder transitFinder, r *http.Request) func(context.Context, int64, [2]float64, [2]float64) ([][2]float64, error) {
	switch lineSource(r) {
	case transit.SourceMLIT:
		return finder.MLITTrack
	case transit.SourceOSMRail:
		return finder.OSMRailTrack
	case transit.SourceOSMBus:
		return finder.OSMBusTrack
	}
	return func(context.Context, int64, [2]float64, [2]float64) ([][2]float64, error) { return nil, errNoMap }
}

// stopsSource is the stops look-up the request asks for.
func stopsSource(finder transitFinder, r *http.Request) func(context.Context, int64) ([]transit.Stop, error) {
	switch lineSource(r) {
	case transit.SourceMLIT:
		return finder.MLITStops
	case transit.SourceOSMRail:
		return finder.OSMRailStops
	case transit.SourceOSMBus:
		return finder.OSMBusStops
	}
	return func(context.Context, int64) ([]transit.Stop, error) { return nil, errNoMap }
}

// transitTimeout is how long one look-up may take, waiting for its map to
// download and be read included; a look-up that runs out answers that the
// map is still loading, and the page asks again.
const transitTimeout = 100 * time.Second

// trackAnswer is a transit line's track between two spots.
type trackAnswer struct {
	// Path is the track, each point [longitude, latitude].
	Path [][2]float64 `json:"path"`
	// Rides are the lines a rail map's route rides one after another, each
	// with its stretch of the track and the station it changed at; none for
	// a route of one line, or from another source.
	Rides []transit.RouteRide `json:"rides,omitempty"`
}

// searchedHeader is the header of a lines answer that says what was
// searched (see transit.Client.Searched), path-escaped so any name fits.
const searchedHeader = "X-Transit-Searched"

// handleTransitLines answers the lines of ?mode= ("train", "subway", "bus"
// or "ferry") whose track passes near both ?from= and ?to=, each
// "longitude,latitude", on the rail or bus map ?source= names.
func handleTransitLines(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		from, to, ok := spotsParam(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		lines, err := linesSource(finder, r)(ctx, r.URL.Query().Get("mode"), from, to)
		if errors.Is(err, transit.ErrNoKind) {
			writeError(w, http.StatusBadRequest, noKindMessage(lineSource(r)))
			return
		}
		if err != nil {
			writeLookupError(w, "look up lines", err)
			return
		}
		w.Header().Set(searchedHeader, url.PathEscape(finder.Searched(lineSource(r), from, to)))
		writeJSON(w, http.StatusOK, lines)
	}
}

// noKindMessage says why source found no lines of the hop's kind: the rail
// maps have only trains and subways, and other sources need the kind picked.
func noKindMessage(source string) string {
	switch source {
	case transit.SourceMLIT, transit.SourceOSMRail:
		return "The rail maps only have trains and subways. For a bus, look lines up on OpenStreetMap's bus map, OpenStreetMap or Transitland, or name the line yourself."
	case transit.SourceOSMBus:
		return "OpenStreetMap's bus map only has buses. For a train or subway, look lines up on a rail map, OpenStreetMap or Transitland."
	}
	return "Pick whether the hop was a train, subway, bus or ferry to find its lines, or name the line yourself."
}

// handleTransitStops answers line {id}'s stations or stops, in the order it
// runs.
func handleTransitStops(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := lineID(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		stops, err := stopsSource(finder, r)(ctx, id)
		if err != nil {
			writeLookupError(w, "get the line's stops", err)
			return
		}
		writeJSON(w, http.StatusOK, stops)
	}
}

// handleTransitDownloads answers the rail and bus maps being downloaded or
// read now, each with how far it has got, which the page shows while a
// look-up waits for one.
func handleTransitDownloads(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, finder.Downloads())
	}
}

// lineID reads the path's {id}, writing an error when it isn't a line's ID.
func lineID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "Give the line's OpenStreetMap, Transitland or rail map ID.")
		return 0, false
	}
	return id, true
}

// handleTransitTrack answers line {id}'s track between ?from= and ?to=.
func handleTransitTrack(finder transitFinder) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, ok := lineID(w, r)
		if !ok {
			return
		}
		from, to, ok := spotsParam(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), transitTimeout)
		defer cancel()
		path, err := trackSource(finder, r)(ctx, id, from, to)
		var rides []transit.RouteRide
		if err == nil {
			rides, err = finder.RailRides(ctx, lineSource(r), id, from, to)
		}
		writeTrack(w, trackAnswer{Path: path, Rides: rides}, err)
	}
}

// writeTrack answers the track, or the error that kept it from being found.
func writeTrack(w http.ResponseWriter, track trackAnswer, err error) {
	switch {
	case errors.Is(err, transit.ErrNoTrack):
		writeError(w, http.StatusUnprocessableEntity, noTrackMessage(err))
	case err != nil:
		writeLookupError(w, "get the line's track", err)
	default:
		writeJSON(w, http.StatusOK, track)
	}
}

// noTrackMessage says why a line's track couldn't be followed between two
// spots, with how far off they were when the look-up says.
func noTrackMessage(err error) string {
	const base = "That line's mapped track doesn't join those two spots"
	if detail := strings.TrimPrefix(err.Error(), transit.ErrNoTrack.Error()+": "); detail != err.Error() {
		return base + ": " + detail + ". Try another line or direction, or pick the stops it got on and off at."
	}
	return base + ". Try another line or direction."
}

// writeLookupError answers a failed look-up of what, such as "look up
// lines": a map still loading or that couldn't be read, a source this
// backend doesn't answer, or anything else.
func writeLookupError(w http.ResponseWriter, what string, err error) {
	if writeMapError(w, err) {
		return
	}
	if errors.Is(err, errNoMap) {
		writeError(w, http.StatusBadRequest, "Couldn't "+what+": "+err.Error()+".")
		return
	}
	writeError(w, http.StatusBadGateway, "Couldn't "+what+" on OpenStreetMap: "+err.Error())
}

// spotsParam reads ?from= and ?to=, writing an error when either isn't a spot.
func spotsParam(w http.ResponseWriter, r *http.Request) (from, to [2]float64, ok bool) {
	q := r.URL.Query()
	from, okFrom := parseSpot(q.Get("from"))
	to, okTo := parseSpot(q.Get("to"))
	if !okFrom || !okTo {
		writeError(w, http.StatusBadRequest, "Give from and to as longitude,latitude.")
		return from, to, false
	}
	return from, to, true
}

// parseSpot reads "longitude,latitude", false when it isn't a spot on the globe.
func parseSpot(s string) ([2]float64, bool) {
	lng, lat, found := strings.Cut(s, ",")
	x, errX := strconv.ParseFloat(strings.TrimSpace(lng), 64)
	y, errY := strconv.ParseFloat(strings.TrimSpace(lat), 64)
	if !found || errX != nil || errY != nil || x < -180 || x > 180 || y < -90 || y > 90 {
		return [2]float64{}, false
	}
	return [2]float64{x, y}, true
}

// writeMapError answers a rail or bus map failure, when err is one, and
// reports whether it did.
func writeMapError(w http.ResponseWriter, err error) bool {
	switch {
	case errors.Is(err, transit.ErrMapLoading):
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{"message": err.Error() + ".", "loading": true})
	case errors.As(err, new(*transit.RailMapError)):
		writeError(w, http.StatusServiceUnavailable, err.Error()+".")
	default:
		return false
	}
	return true
}
