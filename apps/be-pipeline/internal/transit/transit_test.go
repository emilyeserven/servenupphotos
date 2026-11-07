package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeOverpass answers every query with body, and keeps the last query.
func fakeOverpass(t *testing.T, body string, got *string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		*got = r.Form.Get("data")
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURLs: []string{srv.URL}, HTTP: srv.Client()}
}

func TestLines(t *testing.T) {
	var got string
	c := fakeOverpass(t, `{"elements":[
		{"type":"relation","id":2,"tags":{"name":"Yotsubashi Line","ref":"Y","route":"subway"}},
		{"type":"relation","id":1,"tags":{"name":"Midosuji Line","ref":"M","colour":"#e5171f","route":"subway","from":"Nakamozu","to":"Esaka"}},
		{"type":"relation","id":3,"tags":{"route":"subway"}}
	]}`, &got)
	lines, err := c.Lines(context.Background(), "subway", [2]float64{135.5, 34.66}, [2]float64{135.49, 34.70})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 3 || lines[0].Name != "Line 3" || lines[1].Ref != "M" || lines[1].Colour != "#e5171f" || lines[1].To != "Esaka" {
		t.Fatalf("lines = %+v", lines)
	}
	for _, want := range []string{"[timeout:20]", "way(around:500,34.660000,135.500000)[railway];", "way(r.a)(around:500,34.700000,135.490000)", `route~"^(subway|`, "rel.a.b"} {
		if !strings.Contains(got, want) {
			t.Errorf("query %q lacks %q", got, want)
		}
	}
	if _, err := c.Lines(context.Background(), "bus", [2]float64{}, [2]float64{}); err != nil || !strings.Contains(got, "[highway];") {
		t.Errorf("bus query %q lacks road ways (err %v)", got, err)
	}
	if _, err := c.Lines(context.Background(), "ferry", [2]float64{}, [2]float64{}); err != nil || !strings.Contains(got, "[route=ferry];") {
		t.Errorf("ferry query %q lacks ferry ways (err %v)", got, err)
	}
	for _, mode := range []string{"walk", "transit"} {
		if _, err := c.Lines(context.Background(), mode, [2]float64{}, [2]float64{}); !errors.Is(err, ErrNoKind) {
			t.Errorf("%s: err = %v", mode, err)
		}
	}
}

// relation is a route relation answer with two ways joined at (1,0), the
// second drawn backward, a branch, and a platform, which is left out.
const relation = `{"elements":[{"type":"relation","id":1,"members":[
	{"type":"way","role":"","geometry":[{"lat":0,"lon":0},{"lat":0,"lon":0.5},{"lat":0,"lon":1}]},
	{"type":"way","role":"","geometry":[{"lat":1,"lon":1},{"lat":0.5,"lon":1},{"lat":0,"lon":1}]},
	{"type":"way","role":"","geometry":[{"lat":0,"lon":0.5},{"lat":-1,"lon":0.5}]},
	{"type":"way","role":"platform","geometry":[{"lat":0,"lon":0},{"lat":1,"lon":1}]},
	{"type":"node","role":"stop","geometry":[{"lat":0,"lon":0}]}
]}]}`

func TestTrack(t *testing.T) {
	var got string
	c := fakeOverpass(t, relation, &got)
	from, to := [2]float64{-0.01, 0.01}, [2]float64{1.01, 0.99}
	path, err := c.Track(context.Background(), 1, from, to)
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]float64{from, {0, 0}, {0.5, 0}, {1, 0}, {1, 0.5}, {1, 1}, to}
	if len(path) != len(want) {
		t.Fatalf("path = %v, want %v", path, want)
	}
	for i := range want {
		if path[i] != want[i] {
			t.Fatalf("path = %v, want %v", path, want)
		}
	}
	if !strings.Contains(got, "rel(1);out geom;") {
		t.Errorf("query = %q", got)
	}
}

func TestTrackNotJoined(t *testing.T) {
	var got string
	c := fakeOverpass(t, `{"elements":[{"type":"relation","id":1,"members":[
		{"type":"way","role":"","geometry":[{"lat":0,"lon":0},{"lat":0,"lon":1}]},
		{"type":"way","role":"","geometry":[{"lat":5,"lon":5},{"lat":5,"lon":6}]}
	]}]}`, &got)
	if _, err := c.Track(context.Background(), 1, [2]float64{0, 0}, [2]float64{6, 5}); !errors.Is(err, ErrNoTrack) {
		t.Errorf("err = %v, want ErrNoTrack", err)
	}
	c = fakeOverpass(t, `{"elements":[]}`, &got)
	if _, err := c.Track(context.Background(), 1, [2]float64{0, 0}, [2]float64{6, 5}); !errors.Is(err, ErrNoTrack) {
		t.Errorf("no relation: err = %v, want ErrNoTrack", err)
	}
}

func TestStops(t *testing.T) {
	var got string
	c := fakeOverpass(t, `{"elements":[
		{"type":"relation","id":1,"members":[
			{"type":"node","ref":10,"role":"stop"},
			{"type":"node","ref":11,"role":"platform"},
			{"type":"way","ref":5,"role":""},
			{"type":"node","ref":12,"role":"stop_exit_only"},
			{"type":"node","ref":13,"role":"stop"},
			{"type":"node","ref":14,"role":"stop"}
		]},
		{"type":"node","id":10,"lat":34.66,"lon":135.5,"tags":{"name":"Namba"}},
		{"type":"node","id":11,"lat":34.661,"lon":135.5,"tags":{"name":"Namba"}},
		{"type":"node","id":12,"lat":34.662,"lon":135.5,"tags":{"name":"Namba"}},
		{"type":"node","id":13,"lat":34.70,"lon":135.49,"tags":{"name":"Umeda"}},
		{"type":"node","id":14,"lat":34.75,"lon":135.49}
	]}`, &got)
	stops, err := c.Stops(context.Background(), 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(stops) != 3 || stops[0].Name != "Namba" || stops[1].Name != "Umeda" || stops[2].Name != "Stop 3" || stops[1].Latitude != 34.70 {
		t.Errorf("stops = %+v", stops)
	}
	if !strings.Contains(got, "rel(1);out body;node(r);out body;") {
		t.Errorf("query = %q", got)
	}
}
