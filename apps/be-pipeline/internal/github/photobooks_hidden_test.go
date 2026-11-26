package github

import (
	"slices"
	"testing"
)

func TestValidHiddenParts(t *testing.T) {
	got, perr := validHiddenParts([]string{" city ", "place:palace", "city", ""}, 1)
	if perr != nil || !slices.Equal(got, []string{"city", "place:palace"}) {
		t.Fatalf("got %v, %v", got, perr)
	}
	if got, perr := validHiddenParts(nil, 1); perr != nil || got != nil {
		t.Fatalf("none: got %v, %v", got, perr)
	}
	for _, bad := range [][]string{{"street"}, {"place:"}} {
		if _, perr := validHiddenParts(bad, 2); perr == nil {
			t.Errorf("%v: want an error", bad)
		}
	}
	many := make([]string, maxHiddenParts+1)
	for i := range many {
		many[i] = "place:" + string(rune('a'+i))
	}
	if _, perr := validHiddenParts(many, 2); perr == nil {
		t.Error("too many: want an error")
	}
}
