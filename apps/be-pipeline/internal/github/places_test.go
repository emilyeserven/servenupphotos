package github

import (
	"errors"
	"net/http"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

var placesGH = settings.GitHub{Repo: "owner/repo", Token: token}

func TestSavePlace(t *testing.T) {
	f, c := newCombinedRepo(t, map[string]string{})
	got, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: " Gyeongbokgung Palace "})
	if err != nil {
		t.Fatalf("SavePlace() error = %v", err)
	}
	file := dataRoot + "/places/gyeongbokgung-palace.json"
	want := "{\n  \"id\": \"gyeongbokgung-palace\",\n  \"name\": \"Gyeongbokgung Palace\",\n  \"description\": \"\"\n}\n"
	if f.committed[file] != want || len(f.committed) != 1 {
		t.Errorf("committed %q, want %s as %q", f.committed, file, want)
	}
	if !got.Changed || got.Path != file || got.Before != nil || string(got.Data) != want || got.PullRequestNumber == 0 {
		t.Errorf("SavePlace() = %+v, want a new file committed to the pull request", got)
	}
	if f.commitMsg != "Add place "+file {
		t.Errorf("commit message = %q", f.commitMsg)
	}
}

func TestSavePlaceUnchangedAndChanged(t *testing.T) {
	file := dataRoot + "/places/gyeongbokgung-palace.json"
	saved := "{\n  \"id\": \"gyeongbokgung-palace\",\n  \"name\": \"Gyeongbokgung Palace\",\n  \"description\": \"\"\n}\n"
	f, c := newCombinedRepo(t, map[string]string{file: saved})

	got, err := c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: "Gyeongbokgung Palace"})
	if err != nil || got.Changed || f.committed != nil {
		t.Errorf("SavePlace(same) = %+v, %v, committed %v; want nothing committed", got, err, f.committed)
	}

	got, err = c.SavePlace(t.Context(), placesGH, Place{ID: "gyeongbokgung-palace", Name: "Gyeongbokgung Palace", Description: "Seoul"})
	if err != nil || !got.Changed || string(got.Before) != saved || f.commitMsg != "Change place "+file {
		t.Errorf("SavePlace(changed) = %+v, %v, message %q; want the old file as before", got, err, f.commitMsg)
	}
}

func TestSaveEntryRefuses(t *testing.T) {
	_, c := newCombinedRepo(t, map[string]string{
		dataRoot + "/places/gbg.json": `{"id":"gbg","name":"Gyeongbokgung Palace","description":""}`,
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
	f, c := newCombinedRepo(t, map[string]string{
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
	if got := f.committed[dataRoot+"/localizations/country-south-korea.json"]; got != want {
		t.Errorf("committed %q, want %q", got, want)
	}

	entries, err := c.Entries(t.Context(), placesGH)
	if err != nil {
		t.Fatalf("Entries() error = %v", err)
	}
	if len(entries.Places) != 1 || entries.Places[0].Path != dataRoot+"/places/gbg.json" || entries.Localizations == nil ||
		entries.PullRequest == nil || entries.Branch == "" {
		t.Errorf("Entries() = %+v, want the one place at the pull request's head, without PLACES.json", entries)
	}
}
