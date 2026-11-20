package transit

import (
	"context"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/paulmach/osm"
)

// busRelation is a bus route relation with tags, running along ways and
// stopping at stops.
func busRelation(id osm.RelationID, route string, tags osm.Tags, ways []osm.WayID, stops ...osm.NodeID) *osm.Relation {
	r := &osm.Relation{ID: id, Tags: append(osm.Tags{{Key: "type", Value: "route"}, {Key: "route", Value: route}}, tags...)}
	for _, s := range stops {
		r.Members = append(r.Members, osm.Member{Type: osm.TypeNode, Ref: int64(s), Role: "stop"})
	}
	for _, w := range ways {
		r.Members = append(r.Members, osm.Member{Type: osm.TypeWay, Ref: int64(w)})
	}
	r.Members = append(r.Members, osm.Member{Type: osm.TypeWay, Ref: 99, Role: "platform"})
	return r
}

// road is a road way through nodes.
func road(id osm.WayID, nodes ...osm.NodeID) *osm.Way {
	w := &osm.Way{ID: id, Tags: osm.Tags{{Key: "highway", Value: "primary"}}}
	for _, n := range nodes {
		w.Nodes = append(w.Nodes, osm.WayNode{ID: n})
	}
	return w
}

// seoulBuses is a made-up Seoul: bus 7 from Seoul Station up to City Hall
// and on to Gwanghwamun, stopping at each, a bus 9 that only runs from Seoul
// Station west, a subway route, and a stop outside the extract.
func seoulBuses() busMap {
	r := newOSMBusReader()
	r.addRelation(busRelation(70, "bus", osm.Tags{{Key: "name", Value: "7: Seoul Station → Gwanghwamun"}, {Key: "ref", Value: "7"}, {Key: "colour", Value: "#3d5bab"}},
		[]osm.WayID{1, 2}, 1, 2, 3, 404))
	r.addRelation(busRelation(90, "bus", osm.Tags{{Key: "ref", Value: "9"}}, []osm.WayID{3}, 1))
	r.addRelation(busRelation(50, "subway", osm.Tags{{Key: "name", Value: "Line 1"}}, []osm.WayID{1}))
	r.addWay(road(1, 1, 2))
	r.addWay(road(2, 2, 3))
	r.addWay(road(3, 1, 4))
	r.addWay(road(4, 5, 6))
	for _, n := range []*osm.Node{
		{ID: 1, Lon: seoulStation[0], Lat: seoulStation[1], Tags: osm.Tags{{Key: "name", Value: "Seoul Station"}}},
		{ID: 2, Lon: cityHall[0], Lat: cityHall[1], Tags: osm.Tags{{Key: "name", Value: "City Hall"}}},
		{ID: 3, Lon: gwanghwamun[0], Lat: gwanghwamun[1], Tags: osm.Tags{{Key: "name:en", Value: "Gwanghwamun"}}},
		{ID: 4, Lon: 126.95, Lat: 37.555},
		{ID: 5, Lon: 0, Lat: 0},
	} {
		r.addNode(n)
	}
	return r.busMap()
}

var (
	seoulStation = [2]float64{126.9707, 37.5547}
	cityHall     = [2]float64{126.9779, 37.5663}
	gwanghwamun  = [2]float64{126.9769, 37.5759}
)

func TestOSMBusReader(t *testing.T) {
	m := seoulBuses()
	if len(m.Routes) != 2 || len(m.Ways) != 3 {
		t.Fatalf("routes = %+v, ways = %d; want the two bus routes and the three roads they run along", m.Routes, len(m.Ways))
	}
	seven := m.Routes[0]
	if seven.Tags["ref"] != "7" || len(seven.Ways) != 2 {
		t.Errorf("bus 7 = %+v", seven)
	}
	if len(seven.Stops) != 3 || seven.Stops[0].Name != "Seoul Station" || seven.Stops[2].Name != "Gwanghwamun" {
		t.Errorf("bus 7's stops = %+v; want three, the one outside the extract left out", seven.Stops)
	}
}

// writeSeoulBuses writes seoulBuses as South Korea's bus map, with the made-up
// index beside it, so the look-ups read it rather than downloading.
func writeSeoulBuses(t *testing.T) {
	t.Helper()
	dir := t.TempDir()
	t.Setenv("OSM_RAIL_DIR", dir)
	if err := os.WriteFile(filepath.Join(dir, geofabrikIndexFile), []byte(koreaIndex), 0o600); err != nil {
		t.Fatal(err)
	}
	region := filepath.Join(dir, osmBusVersion, "south-korea")
	if err := os.MkdirAll(region, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := writeBusMap(filepath.Join(region, osmBusFile), seoulBuses()); err != nil {
		t.Fatal(err)
	}
}

func TestOSMBusLines(t *testing.T) {
	writeSeoulBuses(t)
	c := &Client{HTTP: http.DefaultClient}
	ctx := context.Background()
	lines, err := c.OSMBusLines(ctx, "bus", seoulStation, gwanghwamun)
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].Ref != "7" || lines[0].Source != SourceOSMBus || lines[0].Colour != "#3d5bab" {
		t.Fatalf("lines = %+v", lines)
	}
	if lines[0].ID>>osmBusIDBits != 1 || lines[0].ID&(1<<osmBusIDBits-1) != 70 {
		t.Errorf("ID %d doesn't name South Korea's route 70", lines[0].ID)
	}
	track, err := c.OSMBusTrack(ctx, lines[0].ID, seoulStation, cityHall)
	if err != nil || len(track) != 4 {
		t.Errorf("track = %v, %v", track, err)
	}
	stops, err := c.OSMBusStops(ctx, lines[0].ID)
	if err != nil || len(stops) != 3 {
		t.Errorf("stops = %+v, %v", stops, err)
	}
	if _, err := c.OSMBusStops(ctx, 1<<osmBusIDBits|12345); !errors.Is(err, ErrNoTrack) {
		t.Errorf("a route not on the map: err = %v", err)
	}
	if _, err := c.OSMBusLines(ctx, "train", seoulStation, gwanghwamun); !errors.Is(err, ErrNoKind) {
		t.Errorf("a train: err = %v", err)
	}
	if lines, err := c.OSMBusLines(ctx, "bus", seoulStation, busan); err != nil || len(lines) != 0 {
		t.Errorf("Seoul to Busan = %+v, %v; no bus passes near both", lines, err)
	}
	searched := c.Searched(SourceOSMBus, seoulStation, busan)
	if !strings.Contains(searched, "bus map of South Korea (2 bus routes") || !strings.Contains(searched, "2 pass within 500 m of the first end and 0 within 500 m of the last") {
		t.Errorf("searched = %q", searched)
	}
}

func TestBusTrackFollowsUnjoinedRoads(t *testing.T) {
	// Three roads east, listed in order but the middle one drawn backwards,
	// with a gap of a few meters before the last, as a route missing a short
	// road is.
	m := busMap{
		Ways: [][][2]float64{
			{{127.000, 37.5}, {127.001, 37.5}},
			{{127.002, 37.5}, {127.001, 37.5}},
			{{127.00205, 37.5}, {127.003, 37.5}},
		},
		Routes: []busRoute{{ID: 1, Ways: []int{0, 1, 2}}},
	}
	n := newBusNet(m, 0)
	from, to := [2]float64{127.0001, 37.5001}, [2]float64{127.0029, 37.5001}
	path, err := n.track(m.Routes[0], from, to)
	if err != nil || len(path) != 7 || path[1] != m.Ways[0][0] || path[5] != m.Ways[2][1] {
		t.Errorf("east = %v, %v", path, err)
	}
	back, err := n.track(m.Routes[0], to, from)
	if err != nil || len(back) != 7 || back[1] != m.Ways[2][1] {
		t.Errorf("west = %v, %v", back, err)
	}
	if _, err := n.track(m.Routes[0], from, [2]float64{127.1, 37.5}); !errors.Is(err, ErrNoTrack) || !strings.Contains(err.Error(), "the last 8.") {
		t.Errorf("far end: err = %v", err)
	}
}
