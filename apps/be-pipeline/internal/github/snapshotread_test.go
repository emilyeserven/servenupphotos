package github

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"
)

func TestInFlightAfterMergeReadsOnlyNames(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:"+dataRoot+"/photos/a.json"] = `{"file":"a.jpg"}`
	f.openPull(prBranch, map[string]string{dataRoot + "/photos/b.json": `{"file":"b.jpg"}`})
	if got, err := c.InFlight(t.Context(), pullGH); err != nil || len(got.Files) != 1 {
		t.Fatalf("InFlight() = %+v, %v; want b.json in flight", got.Files, err)
	}

	// The pull request is merged on GitHub.
	f.pulls = nil
	f.moveMain(map[string]string{dataRoot + "/photos/b.json": `{"file":"b.jpg"}`})
	f.calls = nil
	if err := c.Refresh(t.Context(), pullGH); err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	got, err := c.InFlight(t.Context(), pullGH)
	if err != nil || got.PullRequest != nil || len(got.Files) != 0 {
		t.Fatalf("InFlight() = %+v, %+v, %v; want nothing in flight", got.PullRequest, got.Files, err)
	}
	if want := []string{"graphql state", "graphql tree"}; !slices.Equal(f.calls, want) {
		t.Errorf("calls = %v, want %v: the files the merge brought are known already", f.calls, want)
	}
}

func TestSnapshotReadOutlivesThePage(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:"+dataRoot+"/photos/a.json"] = `{"file":"a.jpg"}`
	if _, perr := c.state(t.Context(), pullGH, false); perr != nil {
		t.Fatalf("state() error = %v", perr)
	}

	f.hold = make(chan struct{})
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Millisecond)
	defer cancel()
	_, err := c.InFlight(ctx, pullGH)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Message != stillReading().Message {
		t.Fatalf("InFlight() error = %v, want %q", err, stillReading().Message)
	}

	close(f.hold)
	if _, err := c.InFlight(t.Context(), pullGH); err != nil {
		t.Fatalf("InFlight() again error = %v", err)
	}
	if n := f.count("graphql snapshot"); n != 1 {
		t.Errorf("read the base branch %d times, want once: the second page waits for the first read", n)
	}
}

func TestFirstReadReusesTheCheckout(t *testing.T) {
	f, c := newFakeGitHub(t)
	same, changed := `{"file":"a.jpg"}`, `{"file":"b.jpg","title":"New"}`
	f.files["main:"+dataRoot+"/photos/a.json"] = same
	f.files["main:"+dataRoot+"/photos/b.json"] = changed
	c.Checkout = t.TempDir()
	dir := filepath.Join(c.Checkout, filepath.FromSlash(dataRoot), "photos")
	if err := os.MkdirAll(dir, 0o750); err != nil {
		t.Fatal(err)
	}
	for name, content := range map[string]string{"a.json": same, "b.json": `{"file":"b.jpg"}`} {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	got, err := c.Combined(t.Context(), pullGH)
	if err != nil {
		t.Fatalf("Combined() error = %v", err)
	}
	if want := []string{"graphql state", "graphql tree", "graphql blobs"}; !slices.Equal(f.calls, want) {
		t.Errorf("calls = %v, want %v: only b.json, changed since the checkout, is downloaded", f.calls, want)
	}
	s, _ := c.reads().snapshot(snapshotKey(target{owner: "owner", name: "repo"}, dataRoot, f.head("main")))
	if s == nil || string(s.files[dataRoot+"/photos/a.json"].content) != same ||
		string(s.files[dataRoot+"/photos/b.json"].content) != changed {
		t.Errorf("snapshot = %+v, want a.json from the checkout and b.json from GitHub (Combined: %+v)", s, got.Base)
	}
}
