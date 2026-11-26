package github

import "testing"

func TestValidTextSide(t *testing.T) {
	for _, side := range []string{"", "left", "right"} {
		if got, perr := validTextSide(PhotoBookPage{Layout: "text", TextSide: side}, 1); perr != nil || got != side {
			t.Errorf("%q: got %q, %v", side, got, perr)
		}
	}
	if got, perr := validTextSide(PhotoBookPage{Layout: "full", TextSide: "left"}, 1); perr != nil || got != "" {
		t.Errorf("photo page: got %q, %v, want none", got, perr)
	}
	if _, perr := validTextSide(PhotoBookPage{Layout: "text", TextSide: "below"}, 2); perr == nil {
		t.Error("below: want an error")
	}
}
