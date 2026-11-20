package transit

import (
	"testing"

	"github.com/paulmach/osm"
)

// osmRelation is a relation of kind ("route" or "route_master") with tags and
// members.
func osmRelation(id osm.RelationID, kind string, tags map[string]string, members ...osm.Member) *osm.Relation {
	rel := &osm.Relation{ID: id, Tags: osm.Tags{{Key: "type", Value: kind}}}
	for k, v := range tags {
		rel.Tags = append(rel.Tags, osm.Tag{Key: k, Value: v})
	}
	rel.Members = members
	return rel
}

// TestOSMRailNamesLinesByRoutes names Boston's track by the Red Line's two
// branches' route master, in its color, not by the track's own names, such
// as "Track 3", and keeps a way both a subway and a train run along once for
// each.
func TestOSMRailNamesLinesByRoutes(t *testing.T) {
	r := newOSMRailReader()
	r.routes.add(osmRelation(1, "route", map[string]string{"route": "subway", "name": "Red Line: Alewife => Ashmont", "colour": "#DA291C"},
		osm.Member{Type: osm.TypeWay, Ref: 10}, osm.Member{Type: osm.TypeWay, Ref: 11}, osm.Member{Type: osm.TypeWay, Ref: 12, Role: "platform"}))
	r.routes.add(osmRelation(2, "route", map[string]string{"route": "subway", "name": "Red Line: Alewife => Braintree"},
		osm.Member{Type: osm.TypeWay, Ref: 10}, osm.Member{Type: osm.TypeWay, Ref: 13}))
	r.routes.add(osmRelation(3, "route_master", map[string]string{"route_master": "subway", "name": "Red Line"},
		osm.Member{Type: osm.TypeRelation, Ref: 1}, osm.Member{Type: osm.TypeRelation, Ref: 2}))
	r.routes.add(osmRelation(4, "route", map[string]string{"route": "train", "name": "Fitchburg Line (North Station → Wachusett)"},
		osm.Member{Type: osm.TypeWay, Ref: 11}))
	r.routes.add(osmRelation(5, "route", map[string]string{"route": "bus", "name": "77"}, osm.Member{Type: osm.TypeWay, Ref: 10}))
	r.routes.resolve()

	for id, name := range map[osm.WayID]string{10: "Track 1", 11: "Track 3", 13: "Dorchester Branch", 14: "3"} {
		w := way("subway", name, "", 1, 2)
		w.ID = id
		r.addWay(w)
	}
	lines := r.lines()
	if len(r.ways) != 5 {
		t.Fatalf("ways = %+v, want Track 3 kept for both lines", r.ways)
	}
	if lines["Red Line"].colour != "#DA291C" || lines["Fitchburg Line"].name != "Fitchburg Line" {
		t.Errorf("lines = %+v", lines)
	}
	for _, name := range []string{"Track 1", "Track 3", "3", "Dorchester Branch", "77"} {
		if _, ok := lines[name]; ok {
			t.Errorf("lines = %+v, want no %q", lines, name)
		}
	}
	if _, ok := lines[""]; !ok {
		t.Errorf("lines = %+v, want the way named only \"3\" unnamed", lines)
	}
}

func TestLineName(t *testing.T) {
	for in, want := range map[string]string{
		"Red Line: Alewife => Ashmont": "Red Line",
		"1호선 (소요산 → 인천)":               "1호선",
		"Orange Line":                  "Orange Line",
		"(Night) bus":                  "(Night) bus",
	} {
		if got := lineName(in); got != want {
			t.Errorf("lineName(%q) = %q, want %q", in, got, want)
		}
	}
}

// TestOSMRailIDsStaySafe checks that a route of the most lines on the last
// region of a long index still has an ID the page's JavaScript holds exactly.
func TestOSMRailIDsStaySafe(t *testing.T) {
	n := &railNet{lineBits: osmLineBits, idBase: int64(2000) << osmLineBits, lines: make([]railLine, 1<<routeBits-1)}
	last := 1<<routeBits - 2
	id := n.lineOf([]int{last, last, last}).ID
	if id >= 1<<53 {
		t.Fatalf("ID %d is over 2^53", id)
	}
	if lines, err := n.routeLines(int64(float64(id))); err != nil || !lines[last] {
		t.Errorf("ID through a float64 = %v, %v", lines, err)
	}
}

// TestKTXTakesTheHighSpeedTrack follows a KTX route relation that runs along
// both the high-speed line and the older, slightly shorter line beside it,
// and keeps its track on the high-speed one.
func TestKTXTakesTheHighSpeedTrack(t *testing.T) {
	r := newOSMRailReader()
	r.routes.add(osmRelation(1, "route", map[string]string{"route": "train", "name": "Gyeongbu Line KTX"},
		osm.Member{Type: osm.TypeWay, Ref: 10}, osm.Member{Type: osm.TypeWay, Ref: 11}))
	r.routes.resolve()
	old := way("rail", "경부선", "", 1, 2, 3)
	old.ID = 10
	fast := way("rail", "경부고속선", "", 1, 4, 3)
	fast.ID = 11
	fast.Tags = append(fast.Tags, osm.Tag{Key: "highspeed", Value: "yes"})
	r.addWay(old)
	r.addWay(fast)
	for _, n := range []*osm.Node{
		node(1, [2]float64{127, 36}, ""), node(2, [2]float64{127.05, 36.5}, ""),
		node(3, [2]float64{127, 37}, ""), node(4, [2]float64{126.93, 36.5}, ""),
	} {
		r.addNode(n)
	}
	n := newRailNet(r.features())
	n.lineBits = osmLineBits
	if len(n.lines) != 1 {
		t.Fatalf("lines = %+v, want the one KTX line", n.lines)
	}
	track, err := railTrack(n, n.lineOf([]int{0}).ID, [2]float64{127, 36}, [2]float64{127, 37})
	if err != nil || len(track) != 5 || track[2] != [2]float64{126.93, 36.5} {
		t.Errorf("track = %v, %v; want it along the high-speed line", track, err)
	}
}
