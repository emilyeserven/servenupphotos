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
	stations, err := c.Stations(context.Background(), "train", ` Hakata `, [2]float64{130.42, 33.59})
	if err != nil {
		t.Fatal(err)
	}
	if len(stations) != 2 || stations[0].NameEn != "Hakata" || stations[0].Km != 0 || stations[1].Name != "Hakata-minami" || stations[1].NameEn != "" {
		t.Fatalf("stations = %+v", stations)
	}
	for _, want := range []string{`nwr[railway~"^(station|halt)$"](around:30000,33.590000,130.420000);`, `nwr[public_transport=station][train=yes]`, `)->.s;nwr.s[~"^((official|alt|short|old)_)?name`, `~"hakata",i]`, "out tags center 200"} {
		if !strings.Contains(got, want) {
			t.Errorf("query %q lacks %q", got, want)
		}
	}
	if _, err := c.Stations(context.Background(), "train", `a.b "1"`, [2]float64{}); err != nil || !strings.Contains(got, `~"a\\.b",i]`) {
		t.Errorf("query %q doesn't ask for the longest word, escaped (err %v)", got, err)
	}
	if _, err := c.Stations(context.Background(), "ferry", "Terminal", [2]float64{}); err != nil || !strings.Contains(got, "nwr[amenity=ferry_terminal]") {
		t.Errorf("ferry query %q lacks ferry terminals (err %v)", got, err)
	}
	if _, err := c.Stations(context.Background(), "flight", "Hakata", [2]float64{}); !errors.Is(err, ErrNoKind) {
		t.Errorf("flight: err = %v", err)
	}
	if _, err := c.Stations(context.Background(), "bus", "  ", [2]float64{}); !errors.Is(err, ErrNoName) {
		t.Errorf("no name: err = %v", err)
	}
}

// TestStationsRankByWords finds a ferry terminal by the longest word typed and
// puts the one with the most of the words first, even when it's farther.
func TestStationsRankByWords(t *testing.T) {
	var got string
	c := fakeOverpass(t, `{"elements":[
		{"type":"node","id":1,"lat":33.95,"lon":130.92,"tags":{"name":"下関","name:en":"Shimonoseki"}},
		{"type":"way","id":2,"center":{"lat":33.96,"lon":130.93},"tags":{"name":"下関港国際ターミナル","name:en":"Shimonoseki Port International Terminal","name:ja-Latn":"Shimonoseki-kō Kokusai Tāminaru"}}
	]}`, &got)
	stations, err := c.Stations(context.Background(), "ferry", "Shimonoseki Kokusai Terminal", [2]float64{130.92, 33.95})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, `~"shimonoseki",i]`) {
		t.Errorf("query %q doesn't ask for the longest word", got)
	}
	if len(stations) != 2 || stations[0].Name != "下関港国際ターミナル" {
		t.Fatalf("stations = %+v, want the terminal first", stations)
	}
}
