// Package routing asks an OSRM routing server for the path along streets
// between spots, so a trip line follows the streets walked or driven rather
// than going straight from photo to photo.
//
// By default it asks the OpenStreetMap routing servers FOSSGIS runs
// (https://routing.openstreetmap.de/about.html), which allow light,
// non-commercial use of about one request a second; ROUTING_URL points it at
// another server with the same paths, such as one run locally.
package routing

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/throttle"
)

// DefaultURL is the FOSSGIS routing servers' address.
const DefaultURL = "https://routing.openstreetmap.de"

// maxPoints is the most spots one request routes through.
const maxPoints = 100

// ErrNoProfile is returned for a way of travelling with no street routing,
// such as a train, which is drawn straight.
var ErrNoProfile = errors.New("no street routing for this way of travelling")

// profile is how the server routes one way of travelling.
type profile struct {
	// server is the FOSSGIS server's path for it, such as "routed-foot".
	server string
	// uTurns says whether the way can turn back at a via spot. Someone walking
	// can, so a via spot just off their way is a there-and-back; a car can't,
	// so OSRM sends it on round the block. OSRM's default (continue_straight)
	// depends on how the server was set up, so each request says which.
	uTurns bool
	// byRoad is the profile asked as well when this one's path is a long
	// detour (see detoured): a walk along a road the foot profile won't use.
	byRoad *profile
}

// profiles are the server's profile for each way of travelling it routes.
var profiles = map[string]profile{
	"walk": {server: "routed-foot", uTurns: true, byRoad: &profile{server: "routed-car", uTurns: true}},
	"bus":  {server: "routed-car"},
	"car":  {server: "routed-car"},
}

// Client asks an OSRM server for paths, at most one request per gap.
type Client struct {
	// BaseURL is the server's address, without a trailing slash.
	BaseURL string
	HTTP    *http.Client
	// Gate spaces requests out, as the server asks.
	Gate throttle.Gate
}

// New is a client for ROUTING_URL, or else DefaultURL.
func New() *Client {
	base := strings.TrimSuffix(os.Getenv("ROUTING_URL"), "/")
	if base == "" {
		base = DefaultURL
	}
	return &Client{BaseURL: base, HTTP: &http.Client{Timeout: 15 * time.Second}, Gate: throttle.Gate{Gap: time.Second}}
}

// Routes reports whether mode, such as "walk", is routed along streets.
func Routes(mode string) bool {
	_, ok := profiles[mode]
	return ok
}

// Path is the path along streets through points, each [longitude, latitude],
// in order, travelled by mode ("walk", "bus" or "car").
func (c *Client) Path(ctx context.Context, mode string, points [][2]float64) ([][2]float64, error) {
	p, ok := profiles[mode]
	if !ok {
		return nil, ErrNoProfile
	}
	if len(points) < 2 || len(points) > maxPoints {
		return nil, fmt.Errorf("can route through 2 to %d spots, not %d", maxPoints, len(points))
	}
	path, err := c.ask(ctx, p, points)
	if err != nil || p.byRoad == nil || !detoured(path, points) {
		return path, err
	}
	return c.shorterByRoad(ctx, *p.byRoad, path, points), nil
}

// ask waits its turn, then asks the server for p's path through points.
func (c *Client) ask(ctx context.Context, p profile, points [][2]float64) ([][2]float64, error) {
	if err := c.Gate.Wait(ctx); err != nil {
		return nil, err
	}
	return c.fetch(ctx, c.BaseURL+"/"+p.server+"/route/v1/driving/"+coordinates(points)+"?"+query(p))
}

// query is the route request's options for p: the whole path as GeoJSON,
// and whether it may turn back at a via spot. The "driving" in the path
// before it is OSRM's placeholder, which the server ignores; the profile is
// picked by p.server.
func query(p profile) string {
	return "overview=full&geometries=geojson&continue_straight=" + strconv.FormatBool(!p.uTurns)
}

// coordinates writes points as OSRM's path does: "lng,lat;lng,lat".
func coordinates(points [][2]float64) string {
	parts := make([]string, len(points))
	for i, p := range points {
		parts[i] = strconv.FormatFloat(p[0], 'f', 6, 64) + "," + strconv.FormatFloat(p[1], 'f', 6, 64)
	}
	return strings.Join(parts, ";")
}

// answer is the part of OSRM's route answer read.
type answer struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Routes  []struct {
		Geometry struct {
			Coordinates [][2]float64 `json:"coordinates"`
		} `json:"geometry"`
	} `json:"routes"`
}

// fetch asks for url and reads the first route's path.
func (c *Client) fetch(ctx context.Context, url string) ([][2]float64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	var a answer
	if err := json.NewDecoder(res.Body).Decode(&a); err != nil {
		return nil, fmt.Errorf("the routing server answered %s", res.Status)
	}
	if a.Code != "Ok" || len(a.Routes) == 0 || len(a.Routes[0].Geometry.Coordinates) < 2 {
		return nil, fmt.Errorf("the routing server found no route (%s %s)", a.Code, a.Message)
	}
	return a.Routes[0].Geometry.Coordinates, nil
}
