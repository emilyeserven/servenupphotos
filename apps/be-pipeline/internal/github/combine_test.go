package github

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// combineRepo serves owner/repo with photoPull open, answering the
// CombineWorkflowFile runs listing with status and runs, and records the
// head_sha asked for.
func combineRepo(t *testing.T, status int, runs []map[string]any, asked *string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Errorf("%s %s: Combine must only read", r.Method, r.URL.Path)
		}
		switch strings.TrimPrefix(r.URL.Path, "/repos/owner/repo") {
		case "/pulls":
			writeBody(w, http.StatusOK, []map[string]any{photoPull})
		case "/actions/workflows/" + CombineWorkflowFile + "/runs":
			*asked = r.URL.Query().Get("head_sha")
			writeBody(w, status, map[string]any{"workflow_runs": runs})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestCombine(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	run := func(status, conclusion string) []map[string]any {
		return []map[string]any{
			{"status": status, "conclusion": conclusion, "html_url": "https://github.com/run/2"},
			{"status": "completed", "conclusion": "failure", "html_url": "https://github.com/run/1"},
		}
	}
	tests := []struct {
		name    string
		sha     string
		status  int
		runs    []map[string]any
		want    CombineStatus
		wantSHA string
	}{
		{"no run yet", "abc1234", http.StatusOK, nil, CombineStatus{SHA: "abc1234", State: CombineWaiting}, "abc1234"},
		{"running", "abc1234", http.StatusOK, run("in_progress", ""),
			CombineStatus{SHA: "abc1234", State: CombineRunning, RunURL: "https://github.com/run/2"}, "abc1234"},
		{"done", "abc1234", http.StatusOK, run("completed", "success"),
			CombineStatus{SHA: "abc1234", State: CombineDone, RunURL: "https://github.com/run/2"}, "abc1234"},
		{"skipped", "abc1234", http.StatusOK, run("completed", "skipped"),
			CombineStatus{SHA: "abc1234", State: CombineDone, RunURL: "https://github.com/run/2"}, "abc1234"},
		{"failed", "abc1234", http.StatusOK, run("completed", "cancelled"),
			CombineStatus{SHA: "abc1234", State: CombineFailed, RunURL: "https://github.com/run/2",
				Message: "The Combine photo data run ended with cancelled."}, "abc1234"},
		{"pull request head", "", http.StatusOK, nil, CombineStatus{SHA: "head7", State: CombineWaiting}, "head7"},
		{"no Actions access", "abc1234", http.StatusForbidden, nil, CombineStatus{SHA: "abc1234", State: CombineUnavailable,
			Message: "The token can't read Actions runs. Give it Actions read access to see when ALLPHOTOS.json is rebuilt."}, "abc1234"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var asked string
			got, err := combineRepo(t, tt.status, tt.runs, &asked).Combine(t.Context(), gh, tt.sha)
			if err != nil {
				t.Fatalf("Combine() error = %v", err)
			}
			if got != tt.want || asked != tt.wantSHA {
				t.Errorf("Combine() = %+v asking for %q, want %+v asking for %q", got, asked, tt.want, tt.wantSHA)
			}
		})
	}
}

func TestCombineErrors(t *testing.T) {
	var asked string
	c := combineRepo(t, http.StatusOK, nil, &asked)
	tests := []struct {
		name string
		gh   settings.GitHub
		sha  string
		want string
	}{
		{"not set up", settings.GitHub{Repo: "owner/repo"}, "abc1234", "Settings first"},
		{"bad sha", settings.GitHub{Repo: "owner/repo", Token: token}, "../x", "commit SHA"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.Combine(t.Context(), tt.gh, tt.sha)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Combine() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}
