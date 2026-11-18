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
