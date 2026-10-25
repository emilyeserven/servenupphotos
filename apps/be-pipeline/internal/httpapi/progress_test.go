package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
)

func TestReadProgress(t *testing.T) {
	progress := newReadProgress()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /data/progress/{task}", handleReadProgress(progress))
	ask := func() taskProgress {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/data/progress/colors", nil))
		var got taskProgress
		if err := json.NewDecoder(rec.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		return got
	}

	run := progress.tracked("colors", func(w http.ResponseWriter, _ *http.Request) {
		if got := ask(); !got.Running || got.Step != github.ProgressGitHub {
			t.Errorf("while running: %+v, want running and reading GitHub", got)
		}
		w.WriteHeader(http.StatusOK)
	})
	run(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/data/colors", nil))

	if got := ask(); got.Running {
		t.Errorf("after: %+v, want not running", got)
	}
}
