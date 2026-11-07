package github

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// changelogServer answers GitHub's repository and list commits endpoints with
// commits, and a Link to a next page when next is true. It records each
// request's path and query in seen.
func changelogServer(t *testing.T, commits []map[string]any, next bool, seen *[]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		*seen = append(*seen, r.URL.Path+"?"+r.URL.RawQuery)
		switch r.URL.Path {
		case "/repos/owner/repo":
			_ = json.NewEncoder(w).Encode(map[string]string{"full_name": "owner/repo", "default_branch": "main"})
		case "/repos/owner/repo/commits":
			if next {
				w.Header().Set("Link", `<https://api.github.com/repositories/1/commits?page=2>; rel="next"`)
			}
			_ = json.NewEncoder(w).Encode(commits)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

// listed is a commit as GitHub lists it, with parents parent commits.
func listed(sha, message, login string, parents int) map[string]any {
	ps := make([]map[string]string, parents)
	for i := range ps {
		ps[i] = map[string]string{"sha": "p"}
	}
	c := map[string]any{
		"sha": sha, "html_url": "https://github.com/owner/repo/commit/" + sha, "parents": ps,
		"commit": map[string]any{
			"message":   message,
			"author":    map[string]string{"name": "Emily Serven"},
			"committer": map[string]string{"date": "2026-11-06T12:00:00Z"},
		},
	}
	if login != "" {
		c["author"] = map[string]string{"login": login}
	}
	return c
}

func TestChangelogListsPullRequestsWithoutMerges(t *testing.T) {
	var seen []string
	c := changelogServer(t, []map[string]any{
		listed("a1", "Show photo counts on the map (#434)\n\n* fix lint", "emilyeserven", 1),
		listed("b2", "Merge branch 'main' into feature", "emilyeserven", 1),
		listed("c3", "Merge pull request #12 from owner/feature", "", 2),
		listed("d4", "Add photo data (#419)", "emilyeserven", 1),
		listed("e5", "Initial commit", "", 0),
	}, true, &seen)

	log, err := c.Changelog(context.Background(), settings.GitHub{Repo: "owner/repo", Token: token}, 1)
	if err != nil {
		t.Fatal(err)
	}
	if log.Repo != "owner/repo" || log.Branch != "main" || log.NextPage != 2 {
		t.Fatalf("got repo %q branch %q next %d", log.Repo, log.Branch, log.NextPage)
	}
	if len(log.Entries) != 3 {
		t.Fatalf("want 3 entries without the merges, got %+v", log.Entries)
	}
	first := log.Entries[0]
	want := ChangelogEntry{
		SHA: "a1", Title: "Show photo counts on the map", PullRequest: 434,
		PullRequestURL: "https://github.com/owner/repo/pull/434", CommitURL: "https://github.com/owner/repo/commit/a1",
		Author: "emilyeserven", Date: "2026-11-06T12:00:00Z",
	}
	if first != want {
		t.Fatalf("got %+v, want %+v", first, want)
	}
	if !log.Entries[1].PhotoData || log.Entries[1].PullRequest != 419 {
		t.Fatalf("want the photo data pull request marked, got %+v", log.Entries[1])
	}
	if e := log.Entries[2]; e.Author != "Emily Serven" || e.PullRequest != 0 || e.PhotoData {
		t.Fatalf("want a plain commit with the commit's author name, got %+v", e)
	}
	if got := seen[len(seen)-1]; got != "/repos/owner/repo/commits?page=1&per_page=100&sha=main" {
		t.Fatalf("listed commits with %q", got)
	}
}

func TestChangelogUsesTheSettingsBranchAndLastPage(t *testing.T) {
	var seen []string
	c := changelogServer(t, []map[string]any{}, false, &seen)

	log, err := c.Changelog(context.Background(), settings.GitHub{Repo: "owner/repo", Branch: "live", Token: token}, 3)
	if err != nil {
		t.Fatal(err)
	}
	if log.NextPage != 0 || log.Entries == nil || len(log.Entries) != 0 {
		t.Fatalf("want an empty last page, got %+v", log)
	}
	if len(seen) != 1 || seen[0] != "/repos/owner/repo/commits?page=3&per_page=100&sha=live" {
		t.Fatalf("want one list call on the settings branch, got %v", seen)
	}
}

func TestChangelogNeedsSettings(t *testing.T) {
	c := &Client{BaseURL: "http://unused.invalid", Client: http.DefaultClient}
	for _, gh := range []settings.GitHub{{Repo: "nope", Token: token}, {Repo: "owner/repo"}} {
		_, err := c.Changelog(context.Background(), gh, 1)
		var perr *PublishError
		if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
			t.Fatalf("settings %+v: want a 400 PublishError, got %v", gh, err)
		}
	}
}
