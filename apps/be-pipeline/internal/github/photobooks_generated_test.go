package github

import (
	"slices"
	"testing"
)

func TestValidGeneratedPage(t *testing.T) {
	page := PhotoBookPage{Layout: "other", Generated: &PhotoBookGenerated{
		Kind: "places-index", Localized: true, Depth: "city", Order: "book", Columns: 1, Pages: 40, TextSize: 333,
		Hidden: []string{" city:Seoul ", "place:palace", "city:Seoul", ""},
	}}
	got, perr := validGeneratedPage(page, 1)
	if perr != nil || got.Columns != 0 || got.Pages != maxGeneratedPages || got.TextSize != maxGeneratedTextSize || got.Localized || got.Names != "localRomanized" || got.Depth != "city" || !slices.Equal(got.Hidden, []string{"city:Seoul", "place:palace"}) {
		t.Fatalf("got %+v, %v", got, perr)
	}
	// Only an other page is generated.
	page.Layout = "text"
	if got, perr := validGeneratedPage(page, 1); got != nil || perr != nil {
		t.Errorf("text page: got %+v, %v", got, perr)
	}
	bad := []PhotoBookGenerated{
		{Kind: "photo-index"},
		{Kind: "places-index", Depth: "street"},
		{Kind: "places-index", Order: "date"},
		{Kind: "places-index", Names: "kana"},
		{Kind: "places-index", Hidden: []string{"street:Main"}},
		{Kind: "places-index", Hidden: []string{"city:"}},
	}
	for _, g := range bad {
		if _, perr := validGeneratedPage(PhotoBookPage{Layout: "other", Generated: &g}, 2); perr == nil {
			t.Errorf("%+v: want an error", g)
		}
	}
	many := make([]string, maxGeneratedHidden+1)
	for i := range many {
		many[i] = "place:" + string(rune('a'+i))
	}
	if _, perr := validGeneratedPage(PhotoBookPage{Layout: "other", Generated: &PhotoBookGenerated{Kind: "places-index", Hidden: many}}, 2); perr == nil {
		t.Error("too many: want an error")
	}
}

func TestValidGeneratedTextSize(t *testing.T) {
	for in, want := range map[int]int{0: 0, 100: 0, 102: 0, 125: 125, 127: 125, 128: 130, 10: minGeneratedTextSize, 900: maxGeneratedTextSize, 70: 70} {
		if got := validGeneratedTextSize(in); got != want {
			t.Errorf("validGeneratedTextSize(%d) = %d, want %d", in, got, want)
		}
	}
}
