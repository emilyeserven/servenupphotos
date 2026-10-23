package github

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// checkGitHub serves owner/repo with default branch main and branches main and
// feature/x, and answers every request with status when status is non-zero.
func checkGitHub(t *testing.T, status int, header map[string]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer "+token {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		for k, v := range header {
			w.Header().Set(k, v)
		}
		if status != 0 {
			w.WriteHeader(status)
			return
		}
		switch r.URL.EscapedPath() {
		case "/repos/owner/repo":
			_, _ = w.Write([]byte(`{"full_name":"owner/repo","default_branch":"main"}`))
		case "/repos/owner/repo/branches/main", "/repos/owner/repo/branches/feature/x":
			_, _ = w.Write([]byte(`{}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	now := time.Date(2026, 10, 15, 2, 45, 0, 0, time.UTC)
	return &Client{BaseURL: srv.URL, Client: srv.Client(), Now: func() time.Time { return now }}
}

func TestCheck(t *testing.T) {
	tests := []struct {
		name    string
		gh      settings.GitHub
		status  int
		header  map[string]string
		ok      bool
		message string
	}{
		{
			name:    "default branch",
			gh:      settings.GitHub{Repo: " owner/repo ", Token: token},
			ok:      true,
			message: "Connected to owner/repo on branch main.",
		},
		{
			name:    "branch with a slash",
			gh:      settings.GitHub{Repo: "owner/repo", Branch: "feature/x", Token: token},
			ok:      true,
			message: "Connected to owner/repo on branch feature/x.",
		},
		{
			name:    "missing branch",
			gh:      settings.GitHub{Repo: "owner/repo", Branch: "nope", Token: token},
			message: `Branch "nope" wasn't found in owner/repo.`,
		},
		{
			name:    "missing repository",
			gh:      settings.GitHub{Repo: "owner/other", Token: token},
			message: "Repository owner/other wasn't found, or the token can't see it.",
		},
		{
			name:    "rejected token",
			gh:      settings.GitHub{Repo: "owner/repo", Token: "wrong"},
			message: "GitHub rejected the token. It may be wrong, expired or revoked.",
		},
		{
			name:    "forbidden",
			gh:      settings.GitHub{Repo: "owner/repo", Token: token},
			status:  http.StatusForbidden,
			message: "The token isn't allowed to access this repository.",
		},
		{
			name:    "rate limited",
			gh:      settings.GitHub{Repo: "owner/repo", Token: token},
			status:  http.StatusForbidden,
			header:  map[string]string{"X-RateLimit-Remaining": "0", "X-RateLimit-Reset": "1792033500"},
			message: "GitHub's rate limit was hit, so nothing was read or saved. Try again in 20 minutes (03:05 UTC); your changes are kept until then.",
		},
		{
			name:    "no token",
			gh:      settings.GitHub{Repo: "owner/repo"},
			message: "Set a personal access token first.",
		},
		{
			name:    "malformed repository",
			gh:      settings.GitHub{Repo: "owner/repo/extra", Token: token},
			message: "Enter the repository as owner/name.",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := checkGitHub(t, tt.status, tt.header).Check(t.Context(), tt.gh)
			if want := (storage.CheckResult{OK: tt.ok, Message: tt.message}); got != want {
				t.Errorf("Check() = %+v, want %+v", got, want)
			}
		})
	}
}

func TestCheckUnreachable(t *testing.T) {
	c := &Client{BaseURL: "http://127.0.0.1:0", Client: http.DefaultClient}
	got := c.Check(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token})
	if got.OK || !strings.Contains(got.Message, "Couldn't reach GitHub") {
		t.Errorf("Check() = %+v, want an unreachable failure", got)
	}
}
