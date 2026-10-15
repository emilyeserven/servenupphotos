package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/githubcheck"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestSettingsSecretsAreWriteOnly(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	router := NewRouter(nil, settings.NewStore(path))
	const secret = "r2-secret-abcdefgh1234"

	do := func(method, target, body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), method, target, strings.NewReader(body))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("%s %s: status = %d (body %s)", method, target, rec.Code, rec.Body)
		}
		if strings.Contains(rec.Body.String(), secret) {
			t.Fatalf("%s %s: response leaked the secret: %s", method, target, rec.Body)
		}
		return rec
	}
	decode := func(rec *httptest.ResponseRecorder) settings.Public {
		t.Helper()
		var pub settings.Public
		if err := json.NewDecoder(rec.Body).Decode(&pub); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return pub
	}

	// Setting the secret reports it as set, with only its last four characters.
	pub := decode(do(http.MethodPut, "/settings/r2", `{"bucket":"photos","secretAccessKey":"`+secret+`"}`))
	if want := (settings.SecretStatus{Set: true, Last4: "1234"}); pub.R2.SecretAccessKey != want {
		t.Errorf("after set: secret = %+v, want %+v", pub.R2.SecretAccessKey, want)
	}

	// Omitting the secret keeps it while other fields change.
	pub = decode(do(http.MethodPut, "/settings/r2", `{"bucket":"renamed"}`))
	if pub.R2.Bucket != "renamed" || !pub.R2.SecretAccessKey.Set {
		t.Errorf("after keep: got %+v", pub.R2)
	}
	if b, _ := os.ReadFile(path); !strings.Contains(string(b), secret) { //nolint:gosec // test temp dir
		t.Error("secret was not persisted to the settings file")
	}
	if info, err := os.Stat(path); err != nil || info.Mode().Perm() != 0o600 {
		t.Errorf("settings file mode = %v (err %v), want 0600", info.Mode().Perm(), err)
	}

	// GET never returns the secret either.
	if pub = decode(do(http.MethodGet, "/settings", "")); pub.R2.Bucket != "renamed" {
		t.Errorf("get: bucket = %q", pub.R2.Bucket)
	}

	// An empty string clears it.
	pub = decode(do(http.MethodPut, "/settings/r2", `{"bucket":"renamed","secretAccessKey":""}`))
	if pub.R2.SecretAccessKey.Set {
		t.Errorf("after clear: secret = %+v, want unset", pub.R2.SecretAccessKey)
	}
}

func TestSettingsRejectsUnknownFields(t *testing.T) {
	router := NewRouter(nil, settings.NewStore(filepath.Join(t.TempDir(), "settings.json")))
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/settings/github", strings.NewReader(`{"nope":1}`))
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
	}
}

func TestTestGitHubSettings(t *testing.T) {
	const stored = "github_pat_stored00001234"
	const typed = "github_pat_typed000005678"
	var gotAuth string
	gh := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if strings.HasSuffix(r.URL.Path, "/branches/main") {
			_, _ = w.Write([]byte(`{}`))
			return
		}
		_, _ = w.Write([]byte(`{"full_name":"owner/repo","default_branch":"main"}`))
	}))
	t.Cleanup(gh.Close)

	path := filepath.Join(t.TempDir(), "settings.json")
	store := settings.NewStore(path)
	storedToken := stored
	if _, err := store.UpdateGitHub(settings.GitHubUpdate{Repo: "owner/repo", Token: &storedToken}); err != nil {
		t.Fatal(err)
	}
	router := newRouter(nil, store, &githubcheck.Checker{BaseURL: gh.URL, Client: gh.Client()})

	test := func(body string) githubcheck.Result {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/settings/github/test", strings.NewReader(body))
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		if rec.Code != http.StatusOK {
			t.Fatalf("status = %d (body %s)", rec.Code, rec.Body)
		}
		if strings.Contains(rec.Body.String(), stored) || strings.Contains(rec.Body.String(), typed) {
			t.Fatalf("response leaked a token: %s", rec.Body)
		}
		var res githubcheck.Result
		if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
			t.Fatalf("decode: %v", err)
		}
		return res
	}

	// Without a token in the body, the stored one is used.
	if res := test(`{"repo":"owner/repo"}`); !res.OK || gotAuth != "Bearer "+stored {
		t.Errorf("stored token: result %+v, auth %q", res, gotAuth)
	}
	// A typed token is tested instead, and is not saved.
	if res := test(`{"repo":"owner/repo","token":"` + typed + `"}`); !res.OK || gotAuth != "Bearer "+typed {
		t.Errorf("typed token: result %+v, auth %q", res, gotAuth)
	}
	if b, _ := os.ReadFile(path); strings.Contains(string(b), typed) { //nolint:gosec // test temp dir
		t.Error("testing saved the typed token")
	}
	// Clearing the token fails without calling GitHub.
	gotAuth = ""
	if res := test(`{"repo":"owner/repo","token":""}`); res.OK || gotAuth != "" {
		t.Errorf("cleared token: result %+v, auth %q", res, gotAuth)
	}
}
