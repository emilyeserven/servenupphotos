package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

var placesGH = settings.GitHub{Repo: "owner/repo", Token: token}

// newMainRepo is a fake GitHub with files on main and no pull request open.
func newMainRepo(t *testing.T, files map[string]string) (*fakeGitHub, *Client) {
	t.Helper()
	f, c := newFakeGitHub(t)
	for p, v := range files {
		f.files["main:"+p] = v
	}
	return f, c
}

// staged is path's pending content, or "" when it has none.
func staged(t *testing.T, c *Client, path string) string {
	t.Helper()
	f, _ := stagedContent(t, c, path)
	return f.Content
}

func TestSavePlace(t *testing.T) {
	f, c := newMainRepo(t, map[string]string{})
	got, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: " Gyeongbokgung Palace "})
	if err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	file := dataRoot + "/places/gyeongbokgung-palace.json"
	want := "{\n  \"id\": \"gyeongbokgung-palace\",\n  \"name\": \"Gyeongbokgung Palace\",\n  \"description\": \"\",\n  \"parent\": \"\",\n  \"city\": \"\",\n  \"country\": \"\"\n}\n"
	if staged(t, c, file) != want || pendingCount(t, c) != 1 {
		t.Errorf("pending %q, want %s as %q", staged(t, c, file), file, want)
	}
	if !got.Changed || got.Path != file || got.Before != nil || string(got.Data) != want || len(got.Changes) != 1 {
		t.Errorf("SavePlace() = %+v, want a new file pending", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("SavePlace() wrote to GitHub: %v", w)
	}
}

func TestSavePlaceUnchangedAndChanged(t *testing.T) {
	file := dataRoot + "/places/gyeongbokgung-palace.json"
	saved := "{\n  \"id\": \"gyeongbokgung-palace\",\n  \"name\": \"Gyeongbokgung Palace\",\n  \"description\": \"\",\n  \"parent\": \"\",\n  \"city\": \"\",\n  \"country\": \"\"\n}\n"
	_, c := newMainRepo(t, map[string]string{file: saved})

	got, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: "Gyeongbokgung Palace"})
	if err != nil || got.Changed || pendingCount(t, c) != 0 {
		t.Errorf("SavePlace(same) = %+v, %v; want nothing pending", got, err)
	}

	got, err = c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: "Gyeongbokgung Palace", Description: "Seoul"})
	if err != nil || !got.Changed || string(got.Before) != saved || !strings.Contains(staged(t, c, file), "Seoul") {
		t.Errorf("SavePlace(changed) = %+v, %v; want the old file as before", got, err)
	}
}

func TestSavePlaceWithParent(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/places/gbg.json": `{"id":"gbg","name":"Gyeongbokgung Palace","description":""}`,
	})
	_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gate", Name: "Geunjeongmun Gate", Parent: "gbg", City: " Seoul ", Country: "South Korea"})
	want := "{\n  \"id\": \"gate\",\n  \"name\": \"Geunjeongmun Gate\",\n  \"description\": \"\",\n  \"parent\": \"gbg\",\n  \"city\": \"Seoul\",\n  \"country\": \"South Korea\"\n}\n"
	if got := staged(t, c, dataRoot+"/places/gate.json"); err != nil || got != want {
		t.Errorf("SavePlace() error = %v, committed %q; want %q", err, got, want)
	}
}

func TestSavePlaceWithCoordinates(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	lat, lng := 37.5796, 126.977
	_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gbg", Name: "Gyeongbokgung Palace", Latitude: &lat, Longitude: &lng})
	want := "{\n  \"id\": \"gbg\",\n  \"name\": \"Gyeongbokgung Palace\",\n  \"description\": \"\",\n  \"parent\": \"\",\n  \"city\": \"\",\n  \"country\": \"\",\n  \"latitude\": 37.5796,\n  \"longitude\": 126.977\n}\n"
	if got := staged(t, c, dataRoot+"/places/gbg.json"); err != nil || got != want {
		t.Errorf("SavePlace() error = %v, committed %q; want %q", err, got, want)
	}
}

func TestSavePlaceExactLocation(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	lat, lng := 37.5759, 126.9735
	_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "station", Name: "Gyeongbokgung Station", Latitude: &lat, Longitude: &lng, ExactLocation: true})
	want := "{\n  \"id\": \"station\",\n  \"name\": \"Gyeongbokgung Station\",\n  \"description\": \"\",\n  \"parent\": \"\",\n  \"city\": \"\",\n  \"country\": \"\",\n  \"latitude\": 37.5759,\n  \"longitude\": 126.9735,\n  \"exactLocation\": true\n}\n"
	if got := staged(t, c, dataRoot+"/places/station.json"); err != nil || got != want {
		t.Errorf("SavePlace() error = %v, committed %q; want %q", err, got, want)
	}
}

func TestSavePlaceExactLocationNeedsCoordinates(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{})
	_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "station", Name: "Gyeongbokgung Station", ExactLocation: true})
	if got := staged(t, c, dataRoot+"/places/station.json"); err != nil || strings.Contains(got, "exactLocation") {
		t.Errorf("SavePlace() error = %v, committed %q; want no exactLocation without a GPS position", err, got)
	}
}

func TestSaveEntryRefuses(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/places/gbg.json":  `{"id":"gbg","name":"Gyeongbokgung Palace","description":""}`,
		dataRoot + "/places/gate.json": `{"id":"gate","name":"Geunjeongmun Gate","description":"","parent":"gbg"}`,
	})
	for _, tt := range []struct {
		name   string
		save   func() error
		status int
	}{
		{"same name", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung", Name: "gyeongbokgung palace"})
			return err
		}, http.StatusConflict},
		{"bad ID", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "경복궁", Name: "경복궁"})
			return err
		}, http.StatusBadRequest},
		{"missing parent", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "hall", Name: "Hall", Parent: "nowhere"})
			return err
		}, http.StatusBadRequest},
		{"parent loop", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gbg", Name: "Gyeongbokgung Palace", Parent: "gate"})
			return err
		}, http.StatusBadRequest},
		{"latitude only", func() error {
			lat := 37.5
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "hall", Name: "Hall", Latitude: &lat})
			return err
		}, http.StatusBadRequest},
		{"off the globe", func() error {
			lat, lng := 95.0, 10.0
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "hall", Name: "Hall", Latitude: &lat, Longitude: &lng})
			return err
		}, http.StatusBadRequest},
		{"own parent", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gbg", Name: "Gyeongbokgung Palace", Parent: "gbg"})
			return err
		}, http.StatusBadRequest},
		{"no name", func() error {
			_, err := c.SavePlace(t.Context(), placesGH, Place{ID: "x"})
			return err
		}, http.StatusBadRequest},
		{"bad type", func() error {
			_, err := c.SaveLocalization(t.Context(), placesGH, Localization{ID: "region-x", Type: "region", Name: "X"})
			return err
		}, http.StatusBadRequest},
	} {
		var perr *PublishError
		if err := tt.save(); !errors.As(err, &perr) || perr.Status != tt.status {
			t.Errorf("%s: error = %v, want status %d", tt.name, err, tt.status)
		}
	}
}

func TestSaveLocalizationAndEntries(t *testing.T) {
	_, c := newMainRepo(t, map[string]string{
		dataRoot + "/places/gbg.json":    `{"id":"gbg","name":"Gyeongbokgung Palace","description":""}`,
		dataRoot + "/places/PLACES.json": "[]\n",
	})
	_, err := c.SaveLocalization(t.Context(), placesGH, Localization{
		ID: "country-south-korea", Type: "country", Name: "South Korea", Romanization: "Hanguk", LocalScript: "한국",
	})
	if err != nil {
		t.Fatalf("SaveLocalization() error = %v", err)
	}
	want := "{\n  \"id\": \"country-south-korea\",\n  \"type\": \"country\",\n  \"name\": \"South Korea\",\n" +
		"  \"romanization\": \"Hanguk\",\n  \"pronunciation\": \"\",\n  \"localScript\": \"한국\"\n}\n"
	if got := staged(t, c, dataRoot+"/localizations/country-south-korea.json"); got != want {
		t.Errorf("committed %q, want %q", got, want)
	}

	entries, err := c.Entries(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("Entries() error = %v", err)
	}
	if len(entries.Places) != 1 || entries.Places[0].Path != dataRoot+"/places/gbg.json" || entries.Localizations == nil ||
		entries.PullRequest != nil || entries.Branch != "main" || len(entries.Localizations) != 1 {
		t.Errorf("Entries() = %+v, want the place on main without PLACES.json, and the pending localization", entries)
	}
}
