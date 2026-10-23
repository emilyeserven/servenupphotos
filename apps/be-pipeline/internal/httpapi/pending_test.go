package httpapi

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestDiscardPending(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	router := NewRouter(nil, store)
	discard := func(body string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodDelete, "/photos/pending", strings.NewReader(body))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}

	if rec := discard("{}"); rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "Settings first") {
		t.Errorf("not set up: status = %d, body %s; want 400 asking for settings", rec.Code, rec.Body)
	}
	if _, err := store.UpdateGitHub(settings.GitHubUpdate{Repo: "owner/repo"}); err != nil {
		t.Fatal(err)
	}
	if rec := discard("{not json"); rec.Code != http.StatusBadRequest {
		t.Errorf("bad body: status = %d, want 400", rec.Code)
	}
	// Nothing touches GitHub, so no token is needed.
	if rec := discard(`{"paths":["data/photos/a.json"]}`); rec.Code != http.StatusOK || strings.TrimSpace(rec.Body.String()) != `{"discarded":0}` {
		t.Errorf("status = %d, body %s; want nothing discarded", rec.Code, rec.Body)
	}
}
