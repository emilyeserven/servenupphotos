package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestDeleteBucketImages(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	var asked []string
	del := func(_ context.Context, _ settings.R2, key string) string {
		asked = append(asked, key)
		if strings.HasSuffix(key, ".txt") {
			return "Only images can be deleted from the bucket."
		}
		return ""
	}
	body := `{"keys":["photos/a.jpg","photos/a-large.webp","notes.txt"]}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/delete", strings.NewReader(body))
	rec := httptest.NewRecorder()
	handleDeleteBucketImages(cfg, del)(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got deleteImagesResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := deleteImagesResponse{
		Deleted: []string{"photos/a.jpg", "photos/a-large.webp"},
		Failed:  []failedDelete{{Key: "notes.txt", Message: "Only images can be deleted from the bucket."}},
	}
	if !reflect.DeepEqual(got, want) || len(asked) != 3 {
		t.Errorf("got %+v after asking %v; want %+v", got, asked, want)
	}
}

func TestDeleteBucketImagesBadRequest(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{}, nil }
	del := func(context.Context, settings.R2, string) string {
		t.Error("deleted something from a bad request")
		return ""
	}
	tooMany := `{"keys":[` + strings.TrimSuffix(strings.Repeat(`"a.jpg",`, maxDeleteKeys+1), ",") + `]}`
	for name, body := range map[string]string{"no keys": `{"keys":[]}`, "not JSON": `nope`, "too many": tooMany} {
		t.Run(name, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/delete", strings.NewReader(body))
			rec := httptest.NewRecorder()
			handleDeleteBucketImages(cfg, del)(rec, req)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want 400", rec.Code)
			}
		})
	}
}
