package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

// getTimeouts answers GET /timeouts from handler.
func getTimeouts(t *testing.T, handler http.Handler) relayTimeoutsBody {
	t.Helper()
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/timeouts", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	var got relayTimeoutsBody
	if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
		t.Fatal(err)
	}
	return got
}

func TestHandleTimeouts(t *testing.T) {
	got := getTimeouts(t, handleTimeouts(map[string]time.Duration{
		"/upload":         2 * time.Minute,
		"/data/progress/": 0,
		"/slow":           1500 * time.Millisecond,
	}, 30*time.Second))

	if got.DefaultSeconds != 30 {
		t.Errorf("defaultSeconds = %d, want 30", got.DefaultSeconds)
	}
	want := map[string]int{"/upload": 120, "/data/progress/": 0, "/slow": 2}
	if len(got.Prefixes) != len(want) {
		t.Errorf("got %d prefixes, want %d", len(got.Prefixes), len(want))
	}
	for prefix, seconds := range want {
		if got.Prefixes[prefix] != seconds {
			t.Errorf("prefixes[%q] = %d, want %d", prefix, got.Prefixes[prefix], seconds)
		}
	}
}

// TestTimeoutsRoute checks the router answers GET /timeouts with every path
// in relayTimeouts, such as an upload, which gets its 120s plus the time to
// receive the photo.
func TestTimeoutsRoute(t *testing.T) {
	got := getTimeouts(t, newRouter(nil, nil, nil))

	if got.DefaultSeconds != 30 {
		t.Errorf("defaultSeconds = %d, want 30", got.DefaultSeconds)
	}
	if len(got.Prefixes) != len(relayTimeouts) {
		t.Errorf("got %d prefixes, want %d", len(got.Prefixes), len(relayTimeouts))
	}
	if got.Prefixes["/upload"] != 150 {
		t.Errorf("prefixes[/upload] = %d, want 150", got.Prefixes["/upload"])
	}
}
