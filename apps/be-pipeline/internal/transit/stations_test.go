package transit

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestStations(t *testing.T) {
	var got string
	c := fakeOverpass(t, `{"elements":[
		{"type":"node","id":1,"lat":33.59,"lon":130.42,"tags":{"name":"博多","name:en":"Hakata"}},
		{"type":"way","id":2,"center":{"lat":33.60,"lon":130.43},"tags":{"name":"博多"}},
		{"type":"node","id":3,"lat":33.70,"lon":130.40,"tags":{"name":"Hakata-minami","name:en":"Hakata-minami"}},
		{"type":"node","id":4,"lat":33.5,"lon":130.4,"tags":{}}
	]}`, &got)
	stations, err := c.Stations(context.Background(), "train", ` Hakata "1" `, [2]float64{130.42, 33.59})
	if err != nil {
		t.Fatal(err)
	}
	if len(stations) != 2 || stations[0].NameEn != "Hakata" || stations[0].Km != 0 || stations[1].Name != "Hakata-minami" || stations[1].NameEn != "" {
		t.Fatalf("stations = %+v", stations)
	}
	for _, want := range []string{`[~"^(railway|public_transport)$"~"^(station|halt)$"]`, `~"Hakata \"1\"",i]`, "(around:30000,33.590000,130.420000)", "out tags center"} {
		if !strings.Contains(got, want) {
			t.Errorf("query %q lacks %q", got, want)
		}
	}
	if _, err := c.Stations(context.Background(), "train", "a.b", [2]float64{}); err != nil || !strings.Contains(got, `a\\.b`) {
		t.Errorf("query %q doesn't escape the dot (err %v)", got, err)
	}
	if _, err := c.Stations(context.Background(), "flight", "Hakata", [2]float64{}); !errors.Is(err, ErrNoKind) {
		t.Errorf("flight: err = %v", err)
	}
	if _, err := c.Stations(context.Background(), "bus", "  ", [2]float64{}); !errors.Is(err, ErrNoName) {
		t.Errorf("no name: err = %v", err)
	}
}
