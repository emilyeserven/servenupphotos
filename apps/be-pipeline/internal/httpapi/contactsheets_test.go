package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// sheetPhotos is a request body of n photos labeled p1 to pN, at
// https://cdn.example/pN.webp.
func sheetPhotos(n int) string {
	photos := make([]contactSheetPhoto, n)
	for i := range photos {
		photos[i] = contactSheetPhoto{Label: fmt.Sprintf("p%d", i+1), URL: fmt.Sprintf("https://cdn.example/p%d.webp", i+1)}
	}
	body, _ := json.Marshal(contactSheetsRequest{Photos: photos})
	return string(body)
}

// postContactSheets sends body to the handler built from the fakes.
func postContactSheets(t *testing.T, h http.HandlerFunc, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/contact-sheets", strings.NewReader(body))
	rec := httptest.NewRecorder()
	h(rec, req)
	return rec
}

func TestContactSheets(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{AccountID: "a", Bucket: "photos"}, nil }
	read := func(_ context.Context, _ settings.R2, url string) (image.Image, error) {
		if strings.HasSuffix(url, "/p31.webp") {
			return nil, errors.New("gone")
		}
		return image.NewRGBA(image.Rect(0, 0, 50, 40)), nil
	}
	var uploaded [][]byte
	upload := func(_ context.Context, _ settings.R2, sheets [][]byte) ([]string, error) {
		uploaded = sheets
		links := make([]string, len(sheets))
		for i := range sheets {
			links[i] = fmt.Sprintf("https://cdn.example/contact-sheets/x/sheet-%02d.jpg", i+1)
		}
		return links, nil
	}
	var expiryCalls atomic.Int32
	expiry := func(context.Context, settings.R2) string { expiryCalls.Add(1); return "" }
	h := handleContactSheets(cfg, read, upload, expiry)

	rec := postContactSheets(t, h, sheetPhotos(65))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body %s", rec.Code, rec.Body)
	}
	var got contactSheetsResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	want := contactSheetsResponse{
		Sheets: []contactSheetLink{
			{URL: "https://cdn.example/contact-sheets/x/sheet-01.jpg", First: 1, Last: 30},
			{URL: "https://cdn.example/contact-sheets/x/sheet-02.jpg", First: 31, Last: 60},
			{URL: "https://cdn.example/contact-sheets/x/sheet-03.jpg", First: 61, Last: 65},
		},
		Missing: []string{"p31"},
	}
	if !reflect.DeepEqual(got, want) || len(uploaded) != 3 {
		t.Errorf("got %+v with %d sheets put, want %+v", got, len(uploaded), want)
	}
	// The rule is only checked until it's set.
	postContactSheets(t, h, sheetPhotos(1))
	if n := expiryCalls.Load(); n != 1 {
		t.Errorf("checked the lifecycle rule %d times, want once", n)
	}
}

func TestContactSheetsExpiryProblem(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	read := func(context.Context, settings.R2, string) (image.Image, error) { return nil, errors.New("gone") }
	upload := func(_ context.Context, _ settings.R2, sheets [][]byte) ([]string, error) {
		return make([]string, len(sheets)), nil
	}
	var calls int
	expiry := func(context.Context, settings.R2) string { calls++; return "add it by hand" }
	h := handleContactSheets(cfg, read, upload, expiry)
	for range 2 {
		var got contactSheetsResponse
		rec := postContactSheets(t, h, sheetPhotos(2))
		if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil || got.ExpiryProblem != "add it by hand" {
			t.Errorf("status %d, %+v, want the expiry problem", rec.Code, got)
		}
	}
	if calls != 2 {
		t.Errorf("checked the rule %d times, want every time until it's set", calls)
	}
}

func TestContactSheetsProblems(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{}, nil }
	read := func(context.Context, settings.R2, string) (image.Image, error) {
		return image.NewRGBA(image.Rect(0, 0, 1, 1)), nil
	}
	expiry := func(context.Context, settings.R2) string { return "" }
	notSet := func(context.Context, settings.R2, [][]byte) ([]string, error) {
		return nil, &storage.UploadError{Message: "Fill in Bucket first.", NotConfigured: true}
	}
	for name, tc := range map[string]struct {
		body string
		want int
	}{
		"no photos":  {`{"photos":[]}`, http.StatusBadRequest},
		"not JSON":   {`nope`, http.StatusBadRequest},
		"too many":   {sheetPhotos(maxContactSheetPhotos + 1), http.StatusBadRequest},
		"no R2 info": {sheetPhotos(1), http.StatusBadRequest},
	} {
		t.Run(name, func(t *testing.T) {
			if rec := postContactSheets(t, handleContactSheets(cfg, read, notSet, expiry), tc.body); rec.Code != tc.want {
				t.Errorf("status = %d, want %d (%s)", rec.Code, tc.want, rec.Body)
			}
		})
	}
}

func TestFetchSheetImageRefusesOtherSchemes(t *testing.T) {
	if _, err := fetchSheetImage(t.Context(), "file:///etc/passwd"); err == nil {
		t.Error("read a file link")
	}
}

func TestDeleteContactSheetsHandler(t *testing.T) {
	cfg := func() (settings.R2, error) { return settings.R2{Bucket: "photos"}, nil }
	var asked []string
	del := func(_ context.Context, _ settings.R2, set string) (storage.DeletedContactSheets, error) {
		asked = append(asked, set)
		if set == "bad" {
			return storage.DeletedContactSheets{}, &storage.ListError{Message: "That isn't a set of contact sheets."}
		}
		return storage.DeletedContactSheets{Deleted: 3, Failed: []storage.FailedDelete{}}, nil
	}
	h := handleDeleteContactSheets(cfg, del)
	for body, want := range map[string]int{`{"set":""}`: http.StatusOK, `{"set":"20261115-045000-1a2b"}`: http.StatusOK, `{"set":"bad"}`: http.StatusBadRequest, `nope`: http.StatusBadRequest} {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/photos/bucket/contact-sheets/delete", strings.NewReader(body))
		rec := httptest.NewRecorder()
		h(rec, req)
		if rec.Code != want {
			t.Errorf("%s: status %d, want %d (%s)", body, rec.Code, want, rec.Body)
		}
	}
	if len(asked) != 3 {
		t.Errorf("asked to delete %v, want the three readable requests", asked)
	}
}
