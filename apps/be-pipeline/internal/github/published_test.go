package github

import (
	"encoding/json"
	"testing"
)

func TestPublished(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:"+photosDir+"a.json"] = `{"file":"A.jpg","images":{"full":"https://pub/A.jpg","key":"A.jpg"}}`
	f.files["main:"+photosDir+"b.json"] = `not json`
	f.files["main:"+photosDir+"ALLPHOTOS.json"] = `[]`
	f.openPull(prBranch, nil)
	if _, err := c.Update(t.Context(), pullGH, photosDir+"a.json", "", json.RawMessage(`{"file":"A.jpg","title":"Pond"}`)); err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	got, err := c.Published(t.Context(), pullGH)
	if err != nil {
		t.Fatalf("Published() error = %v", err)
	}
	if got.Branch != "main" || got.PullRequest == nil || got.PullRequest.Number != 1 {
		t.Errorf("Published() = branch %q, pull request %+v; want main and #1", got.Branch, got.PullRequest)
	}
	if len(got.Files) != 2 {
		t.Fatalf("Published() listed %d files, want a.json and b.json: %+v", len(got.Files), got.Files)
	}
	a, b := got.Files[0], got.Files[1]
	if a.Path != photosDir+"a.json" || a.Status != PublishedStatus || a.InFlight != "modified" ||
		a.PhotoName != "A.jpg" || a.ImageURL != "https://pub/A.jpg" || a.ImageKey != "A.jpg" || a.Error != "" {
		t.Errorf("a.json = %+v, want it read from main and marked modified by the pending edit", a)
	}
	if b.InFlight != "" || b.Error == "" || b.PhotoName != "b" {
		t.Errorf("b.json = %+v, want it not in flight, with why it couldn't be read", b)
	}
}
