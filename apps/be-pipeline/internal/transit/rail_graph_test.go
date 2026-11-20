package transit

import (
	"testing"
)

// besideNet is a made-up pair of railways that don't meet: JR's line runs east
// past a private line's terminus, which sits just north of it, as 電鉄出雲市
// sits beside JR's 出雲市.
func besideNet() *railNet {
	jr := osmLine{name: "山陰線", operator: "JR", kind: 11}
	private := osmLine{name: "北松江線", operator: "一畑電車", kind: 12}
	n := newRailNet([]mlitFeature{
		railFeatureOf(jr, "", [][2]float64{{0, 0}, {0.01, 0}, {0.02, 0}}),
		railFeatureOf(private, "", [][2]float64{{0.01, 0.0006}, {0.01, 0.03}, {0.01, 0.06}}),
	}, nil)
	n.lineBits = mlitLineBits
	return n
}

func TestRouteStartsOnTheLineThatGoesThere(t *testing.T) {
	n := besideNet()
	// Nearer JR's track than the private line's terminus.
	from, to := [2]float64{0.01, 0.0002}, [2]float64{0.01, 0.06}
	line, ok := n.routeLine(from, to)
	if !ok || line.Name != "北松江線" {
		t.Fatalf("got %+v, %v; want 北松江線", line, ok)
	}
	if _, err := railTrack(n, line.ID, from, to); err != nil {
		t.Fatal(err)
	}
}

func TestTrackBetweenTwoSpotsAtOnePoint(t *testing.T) {
	n := besideNet()
	// Both ends are nearest the private line's terminus.
	from, to := [2]float64{0.0098, 0.0004}, [2]float64{0.0102, 0.0004}
	id := n.lineOf([]int{1}).ID
	track, err := railTrack(n, id, from, to)
	if err != nil {
		t.Fatal(err)
	}
	if len(track) != 3 || track[0] != from || track[2] != to {
		t.Errorf("track %v, want from, the terminus and to", track)
	}
}

// changeNet is a made-up pair of lines meeting at 川跡: 北松江線 runs north
// from 電鉄出雲市 to it, and 大社線 runs west from it to 出雲大社前.
func changeNet() *railNet {
	kita := osmLine{name: "北松江線", operator: "一畑電車", kind: 12}
	taisha := osmLine{name: "大社線", operator: "一畑電車", kind: 12}
	dentetsu, kawato, taishaMae := [2]float64{0.02, 0}, [2]float64{0.02, 0.04}, [2]float64{-0.06, 0.04}
	n := newRailNet([]mlitFeature{
		railFeatureOf(kita, "", [][2]float64{dentetsu, {0.02, 0.02}, kawato}),
		railFeatureOf(taisha, "", [][2]float64{kawato, {-0.02, 0.04}, taishaMae}),
	}, []mlitFeature{
		railFeatureOf(kita, "電鉄出雲市", [][2]float64{dentetsu, dentetsu}),
		railFeatureOf(kita, "川跡", [][2]float64{kawato, kawato}),
		railFeatureOf(taisha, "川跡", [][2]float64{kawato, kawato}),
		railFeatureOf(taisha, "出雲大社前", [][2]float64{taishaMae, taishaMae}),
	})
	n.lineBits = mlitLineBits
	return n
}

func TestRailRidesSplitsAtTheChange(t *testing.T) {
	n := changeNet()
	from, to := [2]float64{0.0202, 0}, [2]float64{-0.06, 0.0402}
	line, ok := n.routeLine(from, to)
	if !ok || line.Name != "北松江線 → 大社線" {
		t.Fatalf("got %+v, %v", line, ok)
	}
	rides, err := railRides(n, line.ID, from, to)
	if err != nil {
		t.Fatal(err)
	}
	if len(rides) != 2 || rides[0].Line.Name != "北松江線" || rides[1].Line.Name != "大社線" {
		t.Fatalf("rides %+v", rides)
	}
	if c := rides[0].Change; c == nil || c.Name != "川跡" || rides[1].Change != nil {
		t.Errorf("changes %+v, %+v; want 川跡 and none", rides[0].Change, rides[1].Change)
	}
	first, second := rides[0].Path, rides[1].Path
	if first[0] != from || second[len(second)-1] != to || first[len(first)-1] != second[0] {
		t.Errorf("paths %v and %v should run from from, meet at the change and end at to", first, second)
	}
	if stops, err := railStops(n, rides[1].Line.ID); err != nil || len(stops) != 2 {
		t.Errorf("大社線's own stops %v, %v", stops, err)
	}
}

func TestRailRidesOneLine(t *testing.T) {
	n := changeNet()
	id := n.lineOf([]int{0}).ID
	if rides, err := railRides(n, id, [2]float64{0.02, 0}, [2]float64{0.02, 0.04}); err != nil || rides != nil {
		t.Errorf("got %v, %v; want none for one line", rides, err)
	}
}

func TestRoutePrefersTheHighSpeedLine(t *testing.T) {
	slow := osmLine{name: "경부선", operator: "Korail", kind: 11}
	fast := osmLine{name: "경부고속선", operator: "Korail", kind: highSpeedKind}
	// The high-speed line leaves the old line just out of the station and runs
	// a little longer than it to the same end, so only its speed makes it worth
	// the change of line.
	n := newRailNet([]mlitFeature{
		railFeatureOf(slow, "", [][2]float64{{0, 0}, {0, 0.05}, {0, 1}}),
		railFeatureOf(fast, "", [][2]float64{{0, 0.05}, {0.02, 0.5}, {0, 1}}),
	}, nil)
	n.lineBits = osmLineBits
	line, ok := n.routeLine([2]float64{0, 0}, [2]float64{0, 1})
	if !ok || line.Name != "경부선 → 경부고속선" {
		t.Fatalf("got %+v, %v; want the route onto 경부고속선", line, ok)
	}
}

// TestRailTrackCrossesAGapInItsLine follows a KTX line whose route leaves out
// the stretch through a station, crossing it on the other line's track there,
// with the line's color.
func TestRailTrackCrossesAGapInItsLine(t *testing.T) {
	ktx := osmLine{name: "Gyeongbu Line KTX", operator: "Korail", kind: highSpeedKind, colour: "#1e5bb4"}
	other := osmLine{name: "경부선", operator: "Korail", kind: 11}
	n := newRailNet([]mlitFeature{
		railFeatureOf(ktx, "", [][2]float64{{0, 0}, {0, 0.3}}),
		railFeatureOf(other, "", [][2]float64{{0, 0.3}, {0.001, 0.32}, {0, 0.34}}),
		railFeatureOf(ktx, "", [][2]float64{{0, 0.34}, {0, 1}}),
	}, nil)
	n.lineBits = osmLineBits
	line := n.lineOf([]int{0})
	if line.Colour != "#1e5bb4" {
		t.Errorf("colour = %q", line.Colour)
	}
	from, to := [2]float64{0, 0}, [2]float64{0, 1}
	track, err := railTrack(n, line.ID, from, to)
	if err != nil || len(track) != 7 || track[3] != [2]float64{0.001, 0.32} {
		t.Fatalf("track = %v, %v; want it across the gap", track, err)
	}
	if rides, err := railRides(n, line.ID, from, to); err != nil || rides != nil {
		t.Errorf("rides = %v, %v; want none", rides, err)
	}
}
