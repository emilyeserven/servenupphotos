package github

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// rebuildRepo serves owner/repo with photoPull open, answering the
// CombineWorkflowFile dispatch with status and body, and records the dispatch
// request's body.
func rebuildRepo(t *testing.T, status int, body any, asked *map[string]any) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method + " " + strings.TrimPrefix(r.URL.Path, "/repos/owner/repo") {
		case "GET /pulls":
			writeBody(w, http.StatusOK, []map[string]any{photoPull})
		case "POST /actions/workflows/" + CombineWorkflowFile + "/dispatches":
			if err := json.NewDecoder(r.Body).Decode(asked); err != nil {
				t.Errorf("dispatch body: %v", err)
			}
			if body == nil {
				w.WriteHeader(status)
				return
			}
			writeBody(w, status, body)
		default:
			t.Errorf("unexpected %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return &Client{BaseURL: srv.URL, Client: srv.Client()}
}

func TestRebuild(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	tests := []struct {
		name   string
		status int
		body   any
		want   CombineStatus
	}{
		{"with the run", http.StatusOK, map[string]any{"workflow_run_id": 9, "html_url": "https://github.com/run/9"},
			CombineStatus{SHA: "head7", State: CombineWaiting, RunURL: "https://github.com/run/9", RunsURL: combineRunsURL}},
		{"without the run", http.StatusNoContent, nil,
			CombineStatus{SHA: "head7", State: CombineWaiting, RunsURL: combineRunsURL}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var asked map[string]any
			got, err := rebuildRepo(t, tt.status, tt.body, &asked).Rebuild(t.Context(), gh)
			if err != nil {
				t.Fatalf("Rebuild() error = %v", err)
			}
			if got != tt.want {
				t.Errorf("Rebuild() = %+v, want %+v", got, tt.want)
			}
			if asked["ref"] != "photo-data/2026-10-15-024500" || asked["return_run_details"] != true {
				t.Errorf("dispatch body = %v, want the pull request's branch and its run", asked)
			}
		})
	}
}

func TestRebuildErrors(t *testing.T) {
	gh := settings.GitHub{Repo: "owner/repo", Token: token}
	tests := []struct {
		name   string
		status int
		want   string
	}{
		{"no Actions write access", http.StatusForbidden, "Actions read and write"},
		{"no workflow", http.StatusNotFound, "couldn't find"},
		{"older workflow on the branch", http.StatusUnprocessableEntity, "Update the branch"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var asked map[string]any
			_, err := rebuildRepo(t, tt.status, nil, &asked).Rebuild(t.Context(), gh)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("Rebuild() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}
