package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
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

func TestSettingsTestUsesStoredSecretWithoutSaving(t *testing.T) {
	store := settings.NewStore(filepath.Join(t.TempDir(), "settings.json"))
	if _, err := store.UpdateR2(settings.R2Update{Bucket: "saved", SecretAccessKey: ptr("stored-secret")}); err != nil {
		t.Fatal(err)
	}

	var checked []settings.R2
	handler := handleTestSettings(store.ResolveR2, func(_ context.Context, cfg settings.R2) storage.CheckResult {
		checked = append(checked, cfg)
		return storage.CheckResult{OK: true, Message: "fine"}
	})
	post := func(body string) *httptest.ResponseRecorder {
		t.Helper()
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/settings/r2/test", strings.NewReader(body))
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	// A kept secret is filled in from the store; form fields come from the body.
	if rec := post(`{"bucket":"draft"}`); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"ok":true`) {
		t.Fatalf("keep: status %d, body %s", rec.Code, rec.Body)
	}
	// A replaced secret is used as given.
	post(`{"bucket":"draft","secretAccessKey":"typed-secret"}`)
	if len(checked) != 2 || checked[0].SecretAccessKey != "stored-secret" || checked[0].Bucket != "draft" ||
		checked[1].SecretAccessKey != "typed-secret" {
		t.Errorf("checked %+v", checked)
	}

	// Nothing was saved.
	if pub, _ := store.Get(); pub.R2.Bucket != "saved" {
		t.Errorf("bucket = %q, want the saved one", pub.R2.Bucket)
	}

	if rec := post(`{"nope":1}`); rec.Code != http.StatusBadRequest {
		t.Errorf("unknown field: status %d", rec.Code)
	}
}

func ptr(s string) *string { return &s }
