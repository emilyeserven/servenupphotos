package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// fakeTransitland answers each path with the body its handler picks, keeping
// the requests and the API key sent.
func fakeTransitland(t *testing.T, answer func(r *http.Request) string, got *[]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*got = append(*got, r.Header.Get("apikey")+" "+r.URL.RequestURI())
		_, _ = w.Write([]byte(answer(r)))
	}))
	t.Cleanup(srv.Close)
	t.Setenv("TRANSITLAND_URL", srv.URL)
	t.Setenv("TRANSITLAND_API_KEY", "key")
	return &Client{HTTP: srv.Client()}
}

// shimonosekiRoute is a route whose shape runs west to east, with its stops
// listed out of order.
const shimonosekiRoute = `{"routes":[{"id":9,"route_short_name":"","route_long_name":"Sanyo Line","route_color":"F68B1E","route_type":2,
	"agency":{"agency_name":"JR West"},
	"geometry":{"type":"MultiLineString","coordinates":[[[0,0],[1,0],[2,0],[3,0]]]},
	"route_stops":[
		{"stop":{"stop_name":"East","geometry":{"type":"Point","coordinates":[3,0]}}},
		{"stop":{"stop_name":"West","geometry":{"type":"Point","coordinates":[0,0]}}},
		{"stop":{"stop_name":"Middle","geometry":{"type":"Point","coordinates":[1.6,0.01]}}}
	]}]}`

func TestTransitlandLines(t *testing.T) {
	var got []string
	c := fakeTransitland(t, func(r *http.Request) string {
		if strings.Contains(r.URL.RawQuery, "lat=33.950000") {
			return `{"routes":[{"id":9,"route_long_name":"Sanyo Line","route_color":"F68B1E","route_type":2,"agency":{"agency_name":"JR West"}},{"id":10,"route_long_name":"Bus 1","route_type":3}]}`
		}
		return `{"routes":[{"id":9,"route_long_name":"Sanyo Line","route_type":2}]}`
	}, &got)
	lines, err := c.TransitlandLines(context.Background(), "train", [2]float64{130.92, 33.95}, [2]float64{130.88, 33.88})
	if err != nil {
		t.Fatal(err)
	}
	if len(lines) != 1 || lines[0].ID != 9 || lines[0].Colour != "#F68B1E" || lines[0].Source != SourceTransitland || lines[0].Kind != "train" || lines[0].From != "JR West" {
		t.Fatalf("lines = %+v", lines)
	}
	if len(got) != 2 || !strings.HasPrefix(got[0], "key /routes?") || !strings.Contains(got[0], "route_types=2%2C0%2C12%2C100%2C101") || !strings.Contains(got[0], "radius=500") {
		t.Errorf("requests = %v", got)
	}
	if _, err := c.TransitlandLines(context.Background(), "walk", [2]float64{}, [2]float64{}); !errors.Is(err, ErrNoKind) {
		t.Errorf("walk: err = %v", err)
	}
}

func TestTransitlandTrackAndStops(t *testing.T) {
	var got []string
	c := fakeTransitland(t, func(*http.Request) string { return shimonosekiRoute }, &got)
	path, err := c.TransitlandTrack(context.Background(), 9, [2]float64{0.9, 0.1}, [2]float64{2.1, 0.1})
	if err != nil {
		t.Fatal(err)
	}
	if len(path) != 4 || path[1] != [2]float64{1, 0} || path[2] != [2]float64{2, 0} {
		t.Errorf("path = %v", path)
	}
	stops, err := c.TransitlandStops(context.Background(), 9)
	if err != nil {
		t.Fatal(err)
	}
	if len(stops) != 3 || stops[0].Name != "West" || stops[1].Name != "Middle" || stops[2].Name != "East" {
		t.Errorf("stops = %+v", stops)
	}
	if len(got) != 2 || got[0] != "key /routes/9" {
		t.Errorf("requests = %v", got)
	}
}

func TestTransitlandNoKey(t *testing.T) {
	t.Setenv("TRANSITLAND_API_KEY", "")
	c := &Client{HTTP: http.DefaultClient}
	if _, err := c.TransitlandStops(context.Background(), 9); !errors.Is(err, ErrNoTransitlandKey) {
		t.Errorf("err = %v, want ErrNoTransitlandKey", err)
	}
}
