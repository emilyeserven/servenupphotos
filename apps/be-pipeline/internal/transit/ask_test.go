package transit

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/memo"
)

// server answers with status, then body when status is 200, and counts its
// requests.
func server(t *testing.T, status int, body string, hits *int) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		*hits++
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestAskFallsBackToMirror(t *testing.T) {
	var down, up int
	c := &Client{BaseURLs: []string{
		server(t, http.StatusBadGateway, "", &down),
		server(t, http.StatusOK, `{"elements":[{"type":"relation","id":7}]}`, &up),
	}, HTTP: http.DefaultClient, Cache: memo.New[[]element](time.Hour, 10)}
	for range 2 {
		elements, err := c.query(context.Background(), "q")
		if err != nil || len(elements) != 1 || elements[0].ID != 7 {
			t.Fatalf("elements = %+v, err = %v", elements, err)
		}
	}
	if down != 1 || up != 1 {
		t.Errorf("down asked %d times, mirror %d; want 1 and 1 (the second from the cache)", down, up)
	}
}

func TestAskGivesUpAsBusy(t *testing.T) {
	var a, b int
	c := &Client{BaseURLs: []string{
		server(t, http.StatusGatewayTimeout, "", &a),
		server(t, http.StatusTooManyRequests, "", &b),
	}, HTTP: http.DefaultClient, Cache: memo.New[[]element](time.Hour, 10)}
	_, err := c.query(context.Background(), "q")
	var busy *BusyError
	if !errors.As(err, &busy) || busy.Tries != 4 || a != 2 || b != 2 {
		t.Fatalf("err = %v, asked %d and %d times", err, a, b)
	}
	if _, ok := c.Cache.Get("q"); ok {
		t.Error("a failure was cached")
	}
}

func TestAskStopsOnWrongQuery(t *testing.T) {
	var a, b int
	c := &Client{BaseURLs: []string{
		server(t, http.StatusBadRequest, "", &a),
		server(t, http.StatusOK, `{"elements":[]}`, &b),
	}, HTTP: http.DefaultClient}
	var status *StatusError
	if _, err := c.query(context.Background(), "q"); !errors.As(err, &status) || status.Code != 400 || b != 0 {
		t.Fatalf("err = %v, mirror asked %d times", err, b)
	}
}

func TestServerURLs(t *testing.T) {
	if got := serverURLs(" https://a/api , https://b/api,"); len(got) != 2 || got[1] != "https://b/api" {
		t.Errorf("serverURLs = %v", got)
	}
	if got := serverURLs(""); len(got) != len(DefaultURLs) {
		t.Errorf("serverURLs(\"\") = %v", got)
	}
}
