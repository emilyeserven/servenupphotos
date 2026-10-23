package github

import (
	"errors"
	"net/http"
	"path/filepath"
	"testing"
	"time"
)

// withLocalCopy is a client like c, for f, keeping its local copy at path:
// another run of the pipeline when called again with the same path.
func withLocalCopy(c *Client, path string) *Client {
	return &Client{BaseURL: c.BaseURL, Client: c.Client, Now: c.Now, Local: NewLocalCopy(path)}
}

func TestStateIsReadOncePerRun(t *testing.T) {
	f, c := newFakeGitHub(t)
	now := c.Now()
	c.Now = func() time.Time { return now }
	if _, err := c.Combined(t.Context(), pullGH); err != nil {
		t.Fatalf("Combined() error = %v", err)
	}
	now = now.Add(time.Hour)
	if _, err := c.InFlight(t.Context(), pullGH); err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if n := f.count("graphql state"); n != 1 {
		t.Errorf("state queries = %d, want 1 an hour later", n)
	}
	if err := c.Refresh(t.Context(), pullGH); err != nil {
		t.Fatalf("Refresh() error = %v", err)
	}
	if n := f.count("graphql state"); n != 2 {
		t.Errorf("state queries = %d, want 2 after Refresh", n)
	}
}

func TestLocalCopyKeepsSnapshotsAcrossRuns(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{photosDir + "DSC0001.json": `{"file":"DSC0001.jpg"}`})
	path := filepath.Join(t.TempDir(), "github-cache.json")
	if _, err := withLocalCopy(c, path).InFlight(t.Context(), pullGH); err != nil {
		t.Fatalf("first run InFlight() error = %v", err)
	}
	read := f.count("graphql snapshot")
	got, err := withLocalCopy(c, path).InFlight(t.Context(), pullGH)
	if err != nil || len(got.Files) != 1 {
		t.Fatalf("second run InFlight() = %+v, %v; want DSC0001.json", got.Files, err)
	}
	if n := f.count("graphql snapshot"); n != read {
		t.Errorf("snapshot queries = %d, want %d: the second run reads its local copy", n, read)
	}
	if n := f.count("graphql state"); n != 2 {
		t.Errorf("state queries = %d, want 1 per run", n)
	}
}

func TestLocalCopyStandsInWhenRateLimited(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{photosDir + "DSC0001.json": `{"file":"DSC0001.jpg"}`})
	path := filepath.Join(t.TempDir(), "github-cache.json")
	if _, err := withLocalCopy(c, path).InFlight(t.Context(), pullGH); err != nil {
		t.Fatalf("first run InFlight() error = %v", err)
	}
	f.limited = true
	next := withLocalCopy(c, path)
	got, err := next.InFlight(t.Context(), pullGH)
	if err != nil || len(got.Files) != 1 {
		t.Fatalf("rate-limited run InFlight() = %+v, %v; want DSC0001.json from the local copy", got.Files, err)
	}
	// Refresh asks GitHub, so it says the limit is spent rather than
	// answering from the copy.
	var perr *PublishError
	if !errors.As(next.Refresh(t.Context(), pullGH), &perr) || perr.Status != http.StatusTooManyRequests {
		t.Errorf("Refresh() error = %v, want the rate limit", perr)
	}
}

func TestRateLimitWithoutLocalCopyIsAnError(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.limited = true
	_, err := withLocalCopy(c, filepath.Join(t.TempDir(), "github-cache.json")).InFlight(t.Context(), pullGH)
	var perr *PublishError
	if !errors.As(err, &perr) || perr.Status != http.StatusTooManyRequests {
		t.Errorf("InFlight() error = %v, want the rate limit", err)
	}
}
