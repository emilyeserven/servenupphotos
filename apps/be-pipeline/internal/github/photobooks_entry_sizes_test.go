package github

import (
	"maps"
	"testing"
)

func TestValidEntrySizes(t *testing.T) {
	got, perr := validEntrySizes(map[string]int{" place:okuhagi ": 92, "city:Hagi": 100, "city:Seoul": 10, "country:Japan": 300}, 1)
	want := map[string]int{"place:okuhagi": 90, "city:Seoul": minEntrySize}
	if perr != nil || !maps.Equal(got, want) {
		t.Fatalf("got %v, %v; want %v", got, perr, want)
	}
	if got, perr := validEntrySizes(map[string]int{"city:Hagi": 100}, 1); got != nil || perr != nil {
		t.Errorf("all at 100: got %v, %v", got, perr)
	}
	if _, perr := validEntrySizes(map[string]int{"street:Main": 90}, 1); perr == nil {
		t.Error("unknown key: want an error")
	}
	page := PhotoBookPage{Layout: "other", Generated: &PhotoBookGenerated{Kind: "places-index", FitLines: true, EntrySizes: map[string]int{"city:Hagi": 85}}}
	if g, perr := validGeneratedPage(page, 1); perr != nil || !g.FitLines || g.EntrySizes["city:Hagi"] != 85 {
		t.Errorf("page: got %+v, %v", g, perr)
	}
}
