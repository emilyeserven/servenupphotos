package storage

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestUploadContactSheets(t *testing.T) {
	f := &fakeR2Puts{}
	endpoint := f.start(t)
	now := time.Date(2026, 11, 15, 4, 50, 0, 0, time.UTC)
	links, err := uploadContactSheets(t.Context(), gearR2, endpoint, [][]byte{[]byte("one"), []byte("two")}, now)
	if err != nil {
		t.Fatalf("uploadContactSheets() error = %v", err)
	}
	if len(links) != 2 || len(f.paths) != 2 {
		t.Fatalf("links %v, puts %v, want two of each", links, f.paths)
	}
	prefix := "https://cdn.example/contact-sheets/20261115-045000-"
	if !strings.HasPrefix(links[0], prefix) || !strings.HasSuffix(links[0], "/sheet-01.jpg") || !strings.HasSuffix(links[1], "/sheet-02.jpg") {
		t.Errorf("links = %v, want %s<random>/sheet-01.jpg and sheet-02.jpg", links, prefix)
	}
	if string(f.bodies[1]) != "two" || !strings.HasPrefix(f.paths[0], "/photos/contact-sheets/") {
		t.Errorf("put %v, want the sheets in the photos bucket's contact-sheets/ folder", f.paths)
	}
}

// fakeLifecycle answers a bucket's lifecycle reads with existing (an XML
// configuration, or "" for none) and keeps the body of any write.
func fakeLifecycle(t *testing.T, existing string, put *string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if _, ok := r.URL.Query()["lifecycle"]; !ok {
			t.Errorf("%s %s, want a lifecycle request", r.Method, r.URL)
		}
		switch {
		case r.Method == http.MethodGet && existing == "":
			w.Header().Set("Content-Type", "application/xml")
			w.WriteHeader(http.StatusNotFound)
			_, _ = io.WriteString(w, `<Error><Code>NoSuchLifecycleConfiguration</Code><Message>none</Message></Error>`)
		case r.Method == http.MethodGet:
			w.Header().Set("Content-Type", "application/xml")
			_, _ = io.WriteString(w, existing)
		case r.Method == http.MethodPut:
			body, _ := io.ReadAll(r.Body)
			*put = string(body)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestEnsureContactSheetExpiryAddsTheRule(t *testing.T) {
	var put string
	endpoint := fakeLifecycle(t, "", &put)
	if msg := ensureContactSheetExpiry(t.Context(), validR2, endpoint); msg != "" {
		t.Fatalf("problem = %q", msg)
	}
	for _, want := range []string{"<ID>delete-contact-sheets</ID>", "<Prefix>contact-sheets/</Prefix>", "<Days>1</Days>", "<Status>Enabled</Status>"} {
		if !strings.Contains(put, want) {
			t.Errorf("put %s, want %s in it", put, want)
		}
	}
}

func TestEnsureContactSheetExpiryKeepsOtherRules(t *testing.T) {
	var put string
	existing := `<LifecycleConfiguration><Rule><ID>abort-uploads</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter>` +
		`<AbortIncompleteMultipartUpload><DaysAfterInitiation>7</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule></LifecycleConfiguration>`
	endpoint := fakeLifecycle(t, existing, &put)
	if msg := ensureContactSheetExpiry(t.Context(), validR2, endpoint); msg != "" {
		t.Fatalf("problem = %q", msg)
	}
	if !strings.Contains(put, "<ID>abort-uploads</ID>") || !strings.Contains(put, "<ID>delete-contact-sheets</ID>") {
		t.Errorf("put %s, want both rules", put)
	}
}

func TestEnsureContactSheetExpiryWhenSet(t *testing.T) {
	for name, existing := range map[string]string{
		"ours":    `<LifecycleConfiguration><Rule><ID>delete-contact-sheets</ID><Status>Enabled</Status><Filter><Prefix>contact-sheets/</Prefix></Filter><Expiration><Days>1</Days></Expiration></Rule></LifecycleConfiguration>`,
		"by hand": `<LifecycleConfiguration><Rule><ID>sheets</ID><Status>Enabled</Status><Filter><Prefix>contact-sheets/</Prefix></Filter><Expiration><Days>1</Days></Expiration></Rule></LifecycleConfiguration>`,
	} {
		put := ""
		endpoint := fakeLifecycle(t, existing, &put)
		if msg := ensureContactSheetExpiry(t.Context(), validR2, endpoint); msg != "" || put != "" {
			t.Errorf("%s: problem %q, put %q, want nothing changed", name, msg, put)
		}
	}
}

func TestEnsureContactSheetExpiryRefused(t *testing.T) {
	endpoint := fakeR2(t, http.StatusForbidden, "AccessDenied")
	msg := ensureContactSheetExpiry(t.Context(), validR2, endpoint)
	if !strings.Contains(msg, "Object lifecycle rules") || !strings.Contains(msg, "contact-sheets/") {
		t.Errorf("problem = %q, want how to add the rule by hand", msg)
	}
}

// fakeSheetsBucket lists keys under the asked prefix and keeps each deleted
// path, refusing to delete refused.
func fakeSheetsBucket(t *testing.T, keys []string, refused string, prefixes, deleted *[]string) string {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			prefix := r.URL.Query().Get("prefix")
			*prefixes = append(*prefixes, prefix)
			var contents strings.Builder
			for _, k := range keys {
				if strings.HasPrefix(k, prefix) {
					contents.WriteString("<Contents><Key>" + k + "</Key></Contents>")
				}
			}
			w.Header().Set("Content-Type", "application/xml")
			_, _ = io.WriteString(w, `<ListBucketResult><Name>photos</Name><IsTruncated>false</IsTruncated>`+contents.String()+`</ListBucketResult>`)
		case http.MethodDelete:
			if strings.HasSuffix(r.URL.Path, refused) {
				w.Header().Set("Content-Type", "application/xml")
				w.WriteHeader(http.StatusForbidden)
				_, _ = io.WriteString(w, `<Error><Code>AccessDenied</Code><Message>no</Message></Error>`)
				return
			}
			*deleted = append(*deleted, r.URL.Path)
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(srv.Close)
	return srv.URL
}

func TestDeleteContactSheets(t *testing.T) {
	keys := []string{
		"contact-sheets/20261115-045000-1a2b/sheet-01.jpg",
		"contact-sheets/20261115-045000-1a2b/sheet-02.jpg",
		"contact-sheets/20261116-101500-9f9f/sheet-01.jpg",
	}
	var prefixes, deleted []string
	endpoint := fakeSheetsBucket(t, keys, "9f9f/sheet-01.jpg", &prefixes, &deleted)

	got, err := deleteContactSheets(t.Context(), validR2, endpoint, "20261115-045000-1a2b")
	if err != nil || got.Deleted != 2 || len(got.Failed) != 0 {
		t.Fatalf("one set: %+v, %v; want 2 deleted", got, err)
	}
	if prefixes[0] != "contact-sheets/20261115-045000-1a2b/" {
		t.Errorf("listed %q, want only the set's folder", prefixes[0])
	}

	deleted = nil
	got, err = deleteContactSheets(t.Context(), validR2, endpoint, "")
	if err != nil || got.Deleted != 2 || len(got.Failed) != 1 || got.Failed[0].Key != keys[2] {
		t.Errorf("every set: %+v, %v; want 2 deleted and the refused one failed", got, err)
	}
	if prefixes[1] != "contact-sheets/" {
		t.Errorf("listed %q, want the whole contact-sheets/ folder", prefixes[1])
	}
}

func TestDeleteContactSheetsRefusesOtherFolders(t *testing.T) {
	for _, set := range []string{"../photos", "20261115-045000-1a2b/../../photos", "photos"} {
		if _, err := deleteContactSheets(t.Context(), validR2, "http://unused", set); err == nil {
			t.Errorf("set %q: deleted, want refused", set)
		}
	}
}
