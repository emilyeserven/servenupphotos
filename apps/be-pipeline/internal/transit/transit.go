// Package transit finds the bus, subway and train lines OpenStreetMap maps
// (route relations, https://wiki.openstreetmap.org/wiki/Relation:route) near
// two spots, and the track of one of them between those spots, so a trip
// line's hop can follow the line actually ridden instead of going straight.
//
// It asks an Overpass API server (https://wiki.openstreetmap.org/wiki/Overpass_API),
// by default the public overpass-api.de, which asks for light use; requests
// are spaced a second apart. When a server is busy or down it waits a little
// and tries the next public mirror (see ask.go), and it keeps each answer for a
// day (see internal/memo). OVERPASS_URL, a comma-separated list, points it at other
// servers.
package transit

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/memo"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/throttle"
)

// DefaultURLs are the public Overpass API servers asked, in order: the main
// one, then mirrors that hold the whole planet
// (https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).
var DefaultURLs = []string{
	"https://overpass-api.de/api/interpreter",
	"https://overpass.private.coffee/api/interpreter",
	"https://maps.mail.ru/osm/tools/overpass/api/interpreter",
}

// ErrNoKind is returned for a way of travelling with no mapped lines, such as
// a walk, or for "transit", whose kind of line has to be picked first.
var ErrNoKind = errors.New("no transit lines for this way of travelling")

// routeKind is what a mode's lines are mapped as.
type routeKind struct {
	// routes are the OpenStreetMap route values its lines can have, as a regex
	// alternation, such as "bus|trolleybus|coach".
	routes string
	// ways are the Overpass tag filters for the ways its lines run on, such as
	// "[railway]", so the look-up skips the buildings and paths nearby.
	ways []string
}

// rail, road and ferry ways are the ways trains, buses and ferries run on.
const (
	railWays  = "[railway]"
	roadWays  = "[highway]"
	ferryWays = "[route=ferry]"
)

// routeKinds are what each mode's lines are mapped as. A transit hop of no
// known kind isn't here: looking for every kind at once is slow on the public
// servers, so its kind is picked first.
var routeKinds = map[string]routeKind{
	"train":  {"train|light_rail|monorail|tram", []string{railWays}},
	"subway": {"subway|light_rail|monorail|tram", []string{railWays}},
	"bus":    {"bus|trolleybus|coach", []string{roadWays}},
	"ferry":  {"ferry", []string{ferryWays}},
}

// Line is one transit line OpenStreetMap maps: usually one direction of one
// route, such as the Midosuji Line toward Esaka.
type Line struct {
	// ID is the route relation's OpenStreetMap ID.
	ID int64 `json:"id"`
	// Name is the line's name, such as "Midosuji Line: Nakamozu → Esaka".
	Name string `json:"name"`
	// Ref is its short number or letter, such as "M"; "" when none.
	Ref string `json:"ref,omitempty"`
	// Colour is the line's color as a hex code, such as "#e5171f"; "" when none.
	Colour string `json:"colour,omitempty"`
	// Kind is OpenStreetMap's route value, such as "subway".
	Kind string `json:"kind"`
	// From and To are where the line starts and ends; "" when not mapped.
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
}

// Client asks Overpass API servers, at most one request per gap, trying the
// next server when one is busy or down.
type Client struct {
	// BaseURLs are the servers' interpreter addresses, asked in order.
	BaseURLs []string
	HTTP     *http.Client
	// Gate spaces requests out, as the servers ask.
	Gate throttle.Gate
	// Waits are how long to wait before each try after the first; the last
	// one repeats. None means trying again straight away.
	Waits []time.Duration
	// Cache keeps answers already given, by query; nil keeps none.
	Cache *memo.Cache[[]element]
}

// New is a client for OVERPASS_URL's servers, or else DefaultURLs.
func New() *Client {
	return &Client{
		BaseURLs: serverURLs(os.Getenv("OVERPASS_URL")),
		HTTP:     &http.Client{},
		Gate:     throttle.Gate{Gap: time.Second},
		Waits:    []time.Duration{time.Second, 3 * time.Second},
		Cache:    memo.New[[]element](cacheFor, cacheSize),
	}
}

// serverURLs are the comma-separated addresses in list, or else DefaultURLs.
func serverURLs(list string) []string {
	var urls []string
	for u := range strings.SplitSeq(list, ",") {
		if u = strings.TrimSpace(u); u != "" {
			urls = append(urls, u)
		}
	}
	if len(urls) == 0 {
		return DefaultURLs
	}
	return urls
}

// Kinds reports whether mode, such as "subway", has transit lines to look up.
func Kinds(mode string) bool {
	_, ok := routeKinds[mode]
	return ok
}

// element is one OpenStreetMap element in an Overpass answer.
type element struct {
	Type    string            `json:"type"`
	ID      int64             `json:"id"`
	Tags    map[string]string `json:"tags"`
	Members []member          `json:"members"`
	// Lat and Lon are a node's spot.
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
	// Center is a way's or relation's middle, when asked for with "out center".
	Center *struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	} `json:"center"`
}

// member is one member of a route relation, with its geometry.
type member struct {
	Type     string `json:"type"`
	Ref      int64  `json:"ref"`
	Role     string `json:"role"`
	Geometry []struct {
		Lat float64 `json:"lat"`
		Lon float64 `json:"lon"`
	} `json:"geometry"`
}

// query runs an Overpass QL query and reads its elements, from the cache
// when it was asked before.
func (c *Client) query(ctx context.Context, ql string) ([]element, error) {
	if elements, ok := c.Cache.Get(ql); ok {
		slog.Info("overpass answer from memory", "elements", len(elements))
		return elements, nil
	}
	slog.Info("overpass query", "ql", ql)
	elements, err := c.ask(ctx, ql)
	if err == nil {
		c.Cache.Put(ql, elements)
	}
	return elements, err
}

// askOnce posts ql to the server at base and reads its elements.
func (c *Client) askOnce(ctx context.Context, base, ql string) ([]element, error) {
	if err := c.Gate.Wait(ctx); err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, tryTimeout)
	defer cancel()
	body := strings.NewReader(url.Values{"data": {ql}}.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, slowOr(ctx, err)
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	if res.StatusCode != http.StatusOK {
		return nil, &StatusError{Code: res.StatusCode, Status: res.Status}
	}
	var a struct {
		Elements []element `json:"elements"`
	}
	if err := json.NewDecoder(res.Body).Decode(&a); err != nil {
		return nil, slowOr(ctx, errUnreadable)
	}
	return a.Elements, nil
}
