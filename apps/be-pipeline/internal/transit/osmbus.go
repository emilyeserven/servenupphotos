package transit

import (
	"cmp"
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"math"
	"os"
	"path/filepath"
	"slices"
	"time"
)

// SourceOSMBus is the Line.Source of a line found on an OpenStreetMap bus
// map: a country's bus routes, read from the same extract as its rail map.
const SourceOSMBus = "osmbus"

// osmBusIDBits is how many bits of a line's ID on a bus map hold its route
// relation's OpenStreetMap ID; the bits above hold its region's place in
// Geofabrik's index, so the ID stays below 2^53 for the browser.
const osmBusIDBits = 40

// osmBusVersion is the folder of the bus maps read as this version reads
// them, beside the rail maps' (see osmRailDir).
const osmBusVersion = "bus-v1"

// osmBusFile is a bus map's file in its folder: the busMap, as gzipped JSON.
const osmBusFile = "bus-routes.json.gz"

// busMap is a country's bus routes, as kept on this computer.
type busMap struct {
	// Ways are the roads the routes run along, each its points [longitude,
	// latitude], each once however many routes use it.
	Ways [][][2]float64 `json:"ways"`
	// Routes are the bus routes, usually one direction of a line each.
	Routes []busRoute `json:"routes"`
}

// busRoute is one bus route of a bus map.
type busRoute struct {
	// ID is its route relation's OpenStreetMap ID.
	ID int64 `json:"id"`
	// Tags are the tags that name it, such as name, ref and colour.
	Tags map[string]string `json:"tags"`
	// Ways are the places in busMap.Ways of the roads it runs along.
	Ways []int `json:"ways"`
	// Stops are its stops in order.
	Stops []Stop `json:"stops"`
}

// busNet is a bus map ready to look up: each route's bounding box, and each
// route by its relation ID.
type busNet struct {
	busMap
	boxes  [][4]float64
	byID   map[int64]int
	idBase int64
}

// newBusNet is m ready to look up, its lines' IDs starting at idBase.
func newBusNet(m busMap, idBase int64) *busNet {
	n := &busNet{busMap: m, boxes: make([][4]float64, len(m.Routes)), byID: map[int64]int{}, idBase: idBase}
	for i, r := range m.Routes {
		box := [4]float64{math.Inf(1), math.Inf(1), math.Inf(-1), math.Inf(-1)}
		for _, w := range r.Ways {
			for _, p := range m.Ways[w] {
				box = [4]float64{min(box[0], p[0]), min(box[1], p[1]), max(box[2], p[0]), max(box[3], p[1])}
			}
		}
		n.boxes[i] = box
		n.byID[r.ID] = i
	}
	return n
}

// nearBox reports whether p is within about nearM of box: a quick check
// before looking at each point of a route.
func nearBox(box [4]float64, p [2]float64) bool {
	dy := nearM / 111_320.0
	dx := dy / max(math.Cos(p[1]*math.Pi/180), 0.1)
	return p[0] >= box[0]-dx && p[0] <= box[2]+dx && p[1] >= box[1]-dy && p[1] <= box[3]+dy
}

// passesNear reports whether route i's track passes within nearM of p.
func (n *busNet) passesNear(i int, p [2]float64) bool {
	if !nearBox(n.boxes[i], p) {
		return false
	}
	for _, w := range n.Routes[i].Ways {
		for _, q := range n.Ways[w] {
			if meters(p, q) <= nearM {
				return true
			}
		}
	}
	return false
}

// nearCount is how many routes' track passes within nearM of p.
func (n *busNet) nearCount(p [2]float64) int {
	count := 0
	for i := range n.Routes {
		if n.passesNear(i, p) {
			count++
		}
	}
	return count
}

// lines are the routes whose track passes within nearM of both from and to,
// sorted by number and name, as Lines answers them.
func (n *busNet) lines(from, to [2]float64) []Line {
	lines := []Line{}
	for i, r := range n.Routes {
		if !n.passesNear(i, from) || !n.passesNear(i, to) {
			continue
		}
		l := lineOf(element{ID: r.ID, Tags: r.Tags})
		l.ID, l.Source = n.idBase|r.ID, SourceOSMBus
		lines = append(lines, l)
	}
	slices.SortFunc(lines, func(a, b Line) int {
		return cmp.Or(cmp.Compare(a.Ref, b.Ref), cmp.Compare(a.Name, b.Name), cmp.Compare(a.ID, b.ID))
	})
	if len(lines) > maxLines {
		lines = lines[:maxLines]
	}
	return lines
}

// route is the route line id names, false when this map has none.
func (n *busNet) route(id int64) (busRoute, bool) {
	i, ok := n.byID[id&(1<<osmBusIDBits-1)]
	if !ok {
		return busRoute{}, false
	}
	return n.Routes[i], true
}

// trackReachM is how far a ride's end can be from a bus route's mapped
// roads, in meters, and still be drawn along them.
const trackReachM = 1000

// track is route r's track from the point on it nearest from to the point
// nearest to, with from and to added at its ends, as Track is. A route whose
// roads aren't all joined, as a bus route's often aren't (a road left out, or
// roads listed out of order), is followed along its roads in the order the
// route lists them instead, each turned to carry on from the one before.
func (n *busNet) track(r busRoute, from, to [2]float64) ([][2]float64, error) {
	lines := make([][][2]float64, 0, len(r.Ways))
	for _, w := range r.Ways {
		lines = append(lines, n.Ways[w])
	}
	path := newLinesGraph(lines).between(from, to)
	if len(path) < 2 {
		var err error
		if path, err = alongRoute(chainWays(lines), from, to); err != nil {
			return nil, err
		}
	}
	return append(append([][2]float64{from}, path...), to), nil
}

// chainWays are a route's roads as one line, in the order it lists them,
// each turned so it starts at the end nearest where the one before ended.
func chainWays(lines [][][2]float64) [][2]float64 {
	var out [][2]float64
	for i, l := range lines {
		l = slices.Clone(l)
		switch {
		case len(out) > 0:
			end := out[len(out)-1]
			if meters(end, l[len(l)-1]) < meters(end, l[0]) {
				slices.Reverse(l)
			}
		case i+1 < len(lines):
			// The first road runs toward the second.
			next := lines[i+1]
			if minMeters(l[0], next) < minMeters(l[len(l)-1], next) {
				slices.Reverse(l)
			}
		}
		if len(out) > 0 && out[len(out)-1] == l[0] {
			l = l[1:]
		}
		out = append(out, l...)
	}
	return out
}

// minMeters is how far p is from the nearest end of line.
func minMeters(p [2]float64, line [][2]float64) float64 {
	return min(meters(p, line[0]), meters(p, line[len(line)-1]))
}

// alongRoute is the stretch of chain from the point nearest from to the point
// nearest to, run backwards when to comes first; it fails, saying how far
// off they are, when either is over trackReachM from it.
func alongRoute(chain [][2]float64, from, to [2]float64) ([][2]float64, error) {
	if len(chain) == 0 {
		return nil, ErrNoTrack
	}
	a, b := nearestIndex(chain, from), nearestIndex(chain, to)
	da, db := meters(from, chain[a]), meters(to, chain[b])
	if da > trackReachM || db > trackReachM {
		return nil, fmt.Errorf("%w: the first spot is %s from the route's mapped roads and the last %s, more than %d m",
			ErrNoTrack, metersText(da), metersText(db), trackReachM)
	}
	if a <= b {
		return slices.Clone(chain[a : b+1]), nil
	}
	out := slices.Clone(chain[b : a+1])
	slices.Reverse(out)
	return out, nil
}

// metersText is a distance such as "350 m" or "2.4 km".
func metersText(m float64) string {
	if m < 1000 {
		return fmt.Sprintf("%d m", int(m))
	}
	return fmt.Sprintf("%.1f km", m/1000)
}

// osmBusMapDir is the folder of region's bus map.
func osmBusMapDir(region osmRegion) string {
	return filepath.Join(osmRailDir(), osmBusVersion, region.id)
}

// haveBusMap reports whether dir has a bus map.
func haveBusMap(dir string) bool {
	_, err := os.Stat(filepath.Join(dir, osmBusFile))
	return err == nil
}

// writeOSMBus reads the bus routes of the extract open opens and keeps them
// in dir.
func writeOSMBus(ctx context.Context, region osmRegion, open func() (io.ReadCloser, error), dir string, p *progress) error {
	start := time.Now()
	m, err := readOSMBus(ctx, open)
	slog.Info("osm bus extract read", "region", region.id, "routes", len(m.Routes), "ways", len(m.Ways), "took", time.Since(start).Round(time.Second), "err", err)
	if err != nil {
		return err
	}
	p.setStep(StepSaving, fmt.Sprintf("Saving %d bus routes along %d roads to %s", len(m.Routes), len(m.Ways), dir))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	return writeBusMap(filepath.Join(dir, osmBusFile), m)
}

// writeBusMap writes m to path as gzipped JSON, through a temporary file so a
// half-written one is never read.
func writeBusMap(path string, m busMap) error {
	f, err := os.Create(path + ".part") //nolint:gosec // the bus map's own folder
	if err != nil {
		return err
	}
	zw := gzip.NewWriter(f)
	err = json.NewEncoder(zw).Encode(m)
	if err = errors.Join(err, zw.Close(), f.Close()); err != nil {
		return err
	}
	return os.Rename(path+".part", path)
}

// readBusMap reads the bus map at path.
func readBusMap(path string) (busMap, error) {
	f, err := os.Open(path) //nolint:gosec // the bus map's own folder
	if err != nil {
		return busMap{}, err
	}
	defer f.Close() //nolint:errcheck // read-only
	zr, err := gzip.NewReader(f)
	if err != nil {
		return busMap{}, fmt.Errorf("%s couldn't be read: %w", filepath.Base(path), err)
	}
	var m busMap
	if err := json.NewDecoder(zr).Decode(&m); err != nil {
		return busMap{}, fmt.Errorf("%s couldn't be read: %w", filepath.Base(path), err)
	}
	return m, nil
}

// osmBus is the bus map of the region of Geofabrik's index holding both a and
// b, downloading and reading it first when needed.
func (c *Client) osmBus(ctx context.Context, a, b [2]float64) (*busNet, error) {
	regions, err := c.osmRegions(ctx)
	if err != nil {
		return nil, err
	}
	i, err := regionFor(regions, a, b)
	if err != nil {
		return nil, &RailMapError{Map: "OpenStreetMap's bus map", Err: err}
	}
	return c.osmRegionBus(ctx, regions, i)
}

// osmRegionBus is the bus map of the ith region.
func (c *Client) osmRegionBus(ctx context.Context, regions []osmRegion, i int) (*busNet, error) {
	region := regions[i]
	name := "OpenStreetMap's bus map of " + region.name
	return c.Buses.get(ctx, &c.progress, SourceOSMBus+"/"+region.id, name, func(p *progress) (*busNet, error) {
		dir := osmBusMapDir(region)
		if !haveBusMap(dir) {
			if err := c.readyOSMRegion(region, p); err != nil {
				return nil, err
			}
		}
		p.setStep(StepReading, "Reading the bus map saved in "+dir)
		m, err := readBusMap(filepath.Join(dir, osmBusFile))
		if err != nil {
			return nil, err
		}
		return newBusNet(m, int64(i+1)<<osmBusIDBits), nil
	})
}

// osmBusRoute is the bus map and route that line id names.
func (c *Client) osmBusRoute(ctx context.Context, id int64) (*busNet, busRoute, error) {
	regions, err := c.osmRegions(ctx)
	if err != nil {
		return nil, busRoute{}, err
	}
	i := int(id>>osmBusIDBits) - 1
	if i < 0 || i >= len(regions) {
		return nil, busRoute{}, ErrNoTrack
	}
	net, err := c.osmRegionBus(ctx, regions, i)
	if err != nil {
		return nil, busRoute{}, err
	}
	r, ok := net.route(id)
	if !ok {
		return nil, busRoute{}, ErrNoTrack
	}
	return net, r, nil
}

// OSMBusLines are, from the OpenStreetMap bus map of the country holding from
// and to, each [longitude, latitude], the bus routes passing within nearM of
// both.
func (c *Client) OSMBusLines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	if mode != "bus" {
		return nil, ErrNoKind
	}
	net, err := c.osmBus(ctx, from, to)
	if err != nil {
		return nil, err
	}
	return net.lines(from, to), nil
}

// OSMBusTrack is bus route id's track on its OpenStreetMap bus map from the
// point on it nearest from to the point nearest to, with from and to added at
// its ends, as Track is.
func (c *Client) OSMBusTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	net, r, err := c.osmBusRoute(ctx, id)
	if err != nil {
		return nil, err
	}
	return net.track(r, from, to)
}

// OSMBusStops are bus route id's stops on its OpenStreetMap bus map, in the
// order it runs.
func (c *Client) OSMBusStops(ctx context.Context, id int64) ([]Stop, error) {
	_, r, err := c.osmBusRoute(ctx, id)
	if err != nil {
		return nil, err
	}
	if r.Stops == nil {
		return []Stop{}, nil
	}
	return r.Stops, nil
}
