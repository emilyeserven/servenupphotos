package areas

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// park is a Nominatim answer: a park with an outline, then a point that isn't
// an area.
const park = `[
 {"name":"Osaka Castle Park","display_name":"Osaka Castle Park, Chuo, Osaka","type":"park","addresstype":"park","osm_type":"relation","osm_id":358674,
  "geojson":{"type":"Polygon","coordinates":[[[135.52,34.68],[135.53,34.68],[135.53,34.69],[135.52,34.68]]]}},
 {"name":"Osaka Castle","display_name":"Osaka Castle","type":"castle","osm_type":"node","osm_id":1,"geojson":{"type":"Point","coordinates":[135.52,34.68]}}
]`

func testClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return &Client{NominatimURL: srv.URL, WikidataURL: srv.URL, HTTP: srv.Client()}
}

func TestFindByName(t *testing.T) {
	var asked string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		asked = r.URL.String()
		if !strings.HasPrefix(r.UserAgent(), "servenupphotos-pipeline") {
			t.Errorf("User-Agent = %q", r.UserAgent())
		}
		_, _ = w.Write([]byte(park))
	})
	found, err := c.Find(t.Context(), " Osaka Castle Park ")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(asked, "/search?") || !strings.Contains(asked, "polygon_geojson=1") || !strings.Contains(asked, "q=Osaka+Castle+Park") {
		t.Errorf("asked %s", asked)
	}
	if len(found) != 1 || found[0].OSM != "R358674" || found[0].Kind != "park" || len(found[0].Shape) != 1 || Points(found[0].Shape) != 4 {
		t.Errorf("found = %+v", found)
	}
}

func TestFindByWikidata(t *testing.T) {
	var asked []string
	c := testClient(t, func(w http.ResponseWriter, r *http.Request) {
		asked = append(asked, r.URL.String())
		if strings.HasPrefix(r.URL.Path, "/wiki/") {
			_, _ = w.Write([]byte(`{"entities":{"Q1":{"claims":{"P402":[{"mainsnak":{"datavalue":{"value":"358674"}}}]}}}}`))
			return
		}
		_, _ = w.Write([]byte(park))
	})
	found, err := c.Find(t.Context(), "Q1")
	if err != nil {
		t.Fatal(err)
	}
	if len(asked) != 2 || asked[0] != "/wiki/Special:EntityData/Q1.json" || !strings.Contains(asked[1], "osm_ids=R358674") {
		t.Errorf("asked %v", asked)
	}
	if len(found) != 1 {
		t.Errorf("found %d areas", len(found))
	}
}

func TestFindWikidataWithoutRelation(t *testing.T) {
	c := testClient(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"entities":{"Q2":{"claims":{}}}}`))
	})
	if _, err := c.Find(t.Context(), "Q2"); !errors.Is(err, ErrNoRelation) {
		t.Errorf("err = %v, want ErrNoRelation", err)
	}
}

func TestShapeTooBig(t *testing.T) {
	ring := strings.Repeat("[1,2],", MaxPoints) + "[1,2]"
	if _, ok := shapeOf(geometry{Type: "Polygon", Coordinates: []byte("[[" + ring + "]]")}); ok {
		t.Error("an outline over MaxPoints was kept")
	}
}
