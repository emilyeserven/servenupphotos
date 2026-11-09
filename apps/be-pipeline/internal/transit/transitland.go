package transit

import (
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
)

// Transitland (https://www.transit.land) gathers the timetables transit
// agencies publish as GTFS, with each route's shape and stops. It's a second
// place to find a hop's or leg's line when OpenStreetMap's Overpass servers
// are busy. It needs a free API key, TRANSITLAND_API_KEY;
// TRANSITLAND_URL points it at another server.

// SourceTransitland is the Line.Source of a line found on Transitland.
const SourceTransitland = "transitland"

// DefaultTransitlandURL is Transitland's REST API.
const DefaultTransitlandURL = "https://transit.land/api/v2/rest"

// transitlandTimeout is how long Transitland gets to answer.
const transitlandTimeout = 30 * time.Second

// ErrNoTransitlandKey is returned when TRANSITLAND_API_KEY isn't set.
var ErrNoTransitlandKey = errors.New("no Transitland API key")

// TransitlandError is Transitland not answering, or answering other than 200
// OK.
type TransitlandError struct {
	// Err is what went wrong, such as a timeout or "401 Unauthorized".
	Err error
}

// Error says that Transitland didn't answer and why.
func (e *TransitlandError) Error() string {
	return "Transitland didn't answer: " + e.Err.Error()
}

// Unwrap is what went wrong.
func (e *TransitlandError) Unwrap() error { return e.Err }

// transitlandTypes are, for each mode, the GTFS route types its lines can
// have: the basic ones (https://gtfs.org/documentation/schedule/reference/#routestxt),
// 0 tram or light rail, 1 subway, 2 rail, 3 bus, 4 ferry, 11 trolleybus and
// 12 monorail, and the extended ones some feeds use instead
// (https://developers.google.com/transit/gtfs/reference/extended-route-types),
// such as 100 to 117 for railways, 400 to 405 for urban rail, 700 to 716 for
// buses and 1000 or 1200 for ferries.
var transitlandTypes = map[string]string{
	"train":  "2,0,12," + typeRange(100, 117),
	"subway": "1,0,12," + typeRange(400, 405),
	"bus":    "3,11,200,201,202,204,800," + typeRange(700, 716),
	"ferry":  "4,1000,1200",
}

// typeRange is the route types from first to last, joined by commas.
func typeRange(first, last int) string {
	types := make([]string, 0, last-first+1)
	for t := first; t <= last; t++ {
		types = append(types, strconv.Itoa(t))
	}
	return strings.Join(types, ",")
}

// tlKindNames are the OpenStreetMap kinds the basic GTFS route types are
// shown as, so the line list groups them as it does OpenStreetMap's.
var tlKindNames = map[int]string{0: "tram", 1: "subway", 2: "train", 3: "bus", 4: "ferry", 11: "trolleybus", 12: "monorail"}

// tlKind is the OpenStreetMap kind a route type is shown as, an extended type
// by its hundreds: 1xx railways as trains, 2xx coaches, 7xx and 8xx buses,
// 4xx urban rail as subways, 9xx trams, and 10xx or 12xx ferries.
func tlKind(t int) string {
	if t < 100 {
		return tlKindNames[t]
	}
	return tlExtendedKinds[t/100]
}

// tlExtendedKinds are the kinds of extended route types, by their hundreds.
var tlExtendedKinds = map[int]string{1: "train", 2: "bus", 4: "subway", 7: "bus", 8: "trolleybus", 9: "tram", 10: "ferry", 12: "ferry"}

// tlRoute is one route in a Transitland answer.
type tlRoute struct {
	ID int64 `json:"id"`
	// OnestopID is Transitland's ID for the route across feeds, such as
	// "r-wyj6-防長線": the same in two copies of one operator's feed.
	OnestopID string `json:"onestop_id"`
	ShortName string `json:"route_short_name"`
	LongName  string `json:"route_long_name"`
	Color     string `json:"route_color"`
	Type      int    `json:"route_type"`
	Agency    struct {
		Name string `json:"agency_name"`
	} `json:"agency"`
	Geometry   *tlGeometry `json:"geometry"`
	RouteStops []struct {
		Stop struct {
			Name     string      `json:"stop_name"`
			Geometry *tlGeometry `json:"geometry"`
		} `json:"stop"`
	} `json:"route_stops"`
}

// tlGeometry is a GeoJSON geometry: a route's LineString or MultiLineString,
// or a stop's Point, each point [longitude, latitude].
type tlGeometry struct {
	Type        string          `json:"type"`
	Coordinates json.RawMessage `json:"coordinates"`
}

// lines are g's lines: one for a LineString, each for a MultiLineString, and
// none for anything else.
func (g *tlGeometry) lines() [][][2]float64 {
	var out [][][2]float64
	switch {
	case g == nil:
	case g.Type == "MultiLineString":
		_ = json.Unmarshal(g.Coordinates, &out)
	case g.Type == "LineString":
		var line [][2]float64
		if json.Unmarshal(g.Coordinates, &line) == nil {
			out = [][][2]float64{line}
		}
	}
	return out
}

// point is g's point when it's a Point.
func (g *tlGeometry) point() ([2]float64, bool) {
	var p [2]float64
	if g == nil || g.Type != "Point" || json.Unmarshal(g.Coordinates, &p) != nil {
		return p, false
	}
	return p, true
}

// transitlandKey is TRANSITLAND_API_KEY.
func transitlandKey() string {
	return strings.TrimSpace(os.Getenv("TRANSITLAND_API_KEY"))
}

// transitlandURL is TRANSITLAND_URL, or else DefaultTransitlandURL.
func transitlandURL() string {
	return cmp.Or(strings.TrimSpace(os.Getenv("TRANSITLAND_URL")), DefaultTransitlandURL)
}

// TransitlandLines are the routes of mode's kinds with a stop within nearM of
// both from and to, each [longitude, latitude], as lines sorted by number and
// name.
func (c *Client) TransitlandLines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	types, ok := transitlandTypes[mode]
	if !ok {
		return nil, ErrNoKind
	}
	near, err := c.routesNear(ctx, types, from)
	if err != nil {
		return nil, err
	}
	there, err := c.routesNear(ctx, types, to)
	if err != nil {
		return nil, err
	}
	return bothNear(near, there), nil
}

// routesNear are the routes of the GTFS types with a stop within nearM of at.
func (c *Client) routesNear(ctx context.Context, types string, at [2]float64) ([]tlRoute, error) {
	q := url.Values{
		"lat":         {fmt.Sprintf("%f", at[1])},
		"lon":         {fmt.Sprintf("%f", at[0])},
		"radius":      {fmt.Sprint(nearM)},
		"route_types": {types},
		"limit":       {"100"},
	}
	return c.askTransitland(ctx, "/routes?"+q.Encode())
}

// bothNear are the routes in both lists, as lines sorted by number and name,
// at most maxLines.
func bothNear(a, b []tlRoute) []Line {
	ids := map[int64]bool{}
	for _, r := range b {
		ids[r.ID] = true
	}
	lines := []Line{}
	for _, r := range firstCopies(a) {
		if ids[r.ID] {
			lines = append(lines, tlLine(r))
		}
	}
	slices.SortFunc(lines, func(x, y Line) int {
		return cmp.Or(cmp.Compare(x.Ref, y.Ref), cmp.Compare(x.Name, y.Name), cmp.Compare(x.ID, y.ID))
	})
	return lines[:min(len(lines), maxLines)]
}

// firstCopies are routes with each route listed once, when Transitland has
// two copies of an operator's feed and so the same route twice under different
// IDs.
func firstCopies(routes []tlRoute) []tlRoute {
	seen := map[string]bool{}
	return slices.DeleteFunc(slices.Clone(routes), func(r tlRoute) bool {
		dup := r.OnestopID != "" && seen[r.OnestopID]
		seen[r.OnestopID] = true
		return dup
	})
}

// tlLine is r as a Line, named by its long name, or else its number, with
// its agency as where it runs from.
func tlLine(r tlRoute) Line {
	name := cmp.Or(r.LongName, r.ShortName, fmt.Sprintf("Route %d", r.ID))
	colour := ""
	if r.Color != "" {
		colour = "#" + strings.TrimPrefix(r.Color, "#")
	}
	return Line{
		ID: r.ID, Name: name, Ref: r.ShortName, Colour: colour,
		Kind: tlKind(r.Type), From: r.Agency.Name, Source: SourceTransitland,
	}
}

// transitlandRoute is route id with its shape and stops.
func (c *Client) transitlandRoute(ctx context.Context, id int64) (tlRoute, error) {
	routes, err := c.askTransitland(ctx, fmt.Sprintf("/routes/%d", id))
	if err != nil {
		return tlRoute{}, err
	}
	if len(routes) == 0 {
		return tlRoute{}, ErrNoTrack
	}
	return routes[0], nil
}

// TransitlandTrack is route id's shape from the point on it nearest from to
// the point nearest to, with from and to added at its ends, as Track is.
func (c *Client) TransitlandTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	r, err := c.transitlandRoute(ctx, id)
	if err != nil {
		return nil, err
	}
	path := newLinesGraph(r.Geometry.lines()).between(from, to)
	if len(path) < 2 {
		return nil, ErrNoTrack
	}
	return append(append([][2]float64{from}, path...), to), nil
}

// TransitlandStops are route id's stops in the order its shape passes them,
// each name once.
func (c *Client) TransitlandStops(ctx context.Context, id int64) ([]Stop, error) {
	r, err := c.transitlandRoute(ctx, id)
	if err != nil {
		return nil, err
	}
	return tlStops(r), nil
}

// tlStops are r's stops, ordered by where they fall along its longest shape,
// each name once.
func tlStops(r tlRoute) []Stop {
	shape := longestLine(r.Geometry.lines())
	type placed struct {
		Stop
		at int
	}
	var found []placed
	for _, rs := range r.RouteStops {
		if p, ok := rs.Stop.Geometry.point(); ok && rs.Stop.Name != "" {
			found = append(found, placed{Stop{Name: rs.Stop.Name, Latitude: p[1], Longitude: p[0]}, nearestIndex(shape, p)})
		}
	}
	slices.SortStableFunc(found, func(a, b placed) int { return cmp.Compare(a.at, b.at) })
	out := []Stop{}
	seen := map[string]bool{}
	for _, f := range found {
		if !seen[f.Name] {
			out = append(out, f.Stop)
		}
		seen[f.Name] = true
	}
	return out
}

// longestLine is the line of lines with the most points; nil with none.
func longestLine(lines [][][2]float64) [][2]float64 {
	if len(lines) == 0 {
		return nil
	}
	return slices.MaxFunc(lines, func(a, b [][2]float64) int { return cmp.Compare(len(a), len(b)) })
}

// nearestIndex is the index of the point of line nearest p; 0 with none.
func nearestIndex(line [][2]float64, p [2]float64) int {
	best := 0
	for i, q := range line {
		if meters(p, q) < meters(p, line[best]) {
			best = i
		}
	}
	return best
}

// askTransitland gets path from Transitland's REST API and reads its routes,
// from the cache when it was asked before.
func (c *Client) askTransitland(ctx context.Context, path string) ([]tlRoute, error) {
	key := transitlandKey()
	if key == "" {
		return nil, ErrNoTransitlandKey
	}
	if body, ok := c.TLCache.Get(path); ok {
		return readRoutes(body)
	}
	body, err := c.getTransitland(ctx, path, key)
	if err != nil {
		return nil, &TransitlandError{Err: err}
	}
	routes, err := readRoutes(body)
	if err == nil {
		c.TLCache.Put(path, body)
	}
	return routes, err
}

// readRoutes reads a Transitland answer's routes.
func readRoutes(body []byte) ([]tlRoute, error) {
	var a struct {
		Routes []tlRoute `json:"routes"`
	}
	if err := json.Unmarshal(body, &a); err != nil {
		return nil, &TransitlandError{Err: errors.New("its answer couldn't be read")}
	}
	return a.Routes, nil
}

// getTransitland sends one request for path with the API key and reads its
// body, logging how long it took.
func (c *Client) getTransitland(ctx context.Context, path, key string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(ctx, transitlandTimeout)
	defer cancel()
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, transitlandURL()+path, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", key)
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	body, err := c.readTransitland(req)
	slog.Info("transitland request", "path", path, "took", time.Since(start).Round(time.Millisecond), "bytes", len(body), "err", err)
	return body, err
}

// readTransitland sends req and reads its body, failing on any status but
// 200 OK.
func (c *Client) readTransitland(req *http.Request) ([]byte, error) {
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("it answered %s", res.Status)
	}
	return io.ReadAll(res.Body)
}
