package github

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestInFlightReadsPhotoJSON(t *testing.T) {
	const dir = "apps/portfolio/src/data/photos/"
	f, c := newFakeGitHub(t)
	f.files["main:"+dir+"DSC0002.json"] = `{"file":"DSC0002.jpg"}`
	f.files["main:README.md"] = "hi"
	f.pulls = append(f.pulls, fakePull{number: 3, title: "Unrelated", branch: "x", base: "main"})
	f.versions["x"] = 1
	f.openPull(prBranch, map[string]string{
		dir + "DSC0001.json":        "{\n  \"file\": \"DSC0001.jpg\",\n  \"images\": {\"full\": \"https://pub/photos/a-dsc0001.jpg\", \"key\": \"photos/a-dsc0001.jpg\"}\n}\n",
		dir + "broken.json":         "{not json",
		dir + "nested/DSC0003.json": "{}",
		// Combined reads it; InFlight leaves it out.
		dir + "ALLPHOTOS.json": `[{"file":"DSC0001.jpg"}]`,
	})
	delete(f.files, prBranch+":"+dir+"DSC0002.json")

	got, err := c.InFlight(t.Context(), pullGH)
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if got.Folder != "apps/portfolio/src/data/photos" || got.Repo != "owner/repo" {
		t.Errorf("Folder, Repo = %q, %q", got.Folder, got.Repo)
	}
	want := InFlightPullRequest{
		Number: 2, Title: "Add photo data", URL: "https://github.com/owner/repo/pull/2",
		Branch: prBranch, HeadSHA: prBranch + "@1", BaseBranch: "main",
	}
	if got.PullRequest == nil || *got.PullRequest != want {
		t.Fatalf("PullRequest = %+v, want %+v", got.PullRequest, want)
	}
	// DSC0002.json is removed in the pull request, so it isn't listed.
	if len(got.Files) != 2 {
		t.Fatalf("Files = %+v, want DSC0001.json and broken.json", got.Files)
	}
	first := got.Files[0]
	var data map[string]any
	if err := json.Unmarshal(first.Data, &data); err != nil || data["file"] != "DSC0001.jpg" || first.Error != "" {
		t.Errorf("Files[0] = %+v, want DSC0001.json's data", first)
	}
	if first.PhotoName != "DSC0001.jpg" || got.Files[1].PhotoName != "broken" {
		t.Errorf("PhotoName = %q, %q; want DSC0001.jpg, broken", first.PhotoName, got.Files[1].PhotoName)
	}
	if first.ImageKey != "photos/a-dsc0001.jpg" || first.ImageURL != "https://pub/photos/a-dsc0001.jpg" {
		t.Errorf("ImageKey, ImageURL = %q, %q; want DSC0001.json's images", first.ImageKey, first.ImageURL)
	}
	if first.FileURL != "https://github.com/owner/repo/blob/"+prBranch+"/"+dir+"DSC0001.json" || first.Status != "added" || first.Pending {
		t.Errorf("Files[0] = %+v, want its page on the branch, added and committed", first)
	}
	if broken := got.Files[1]; broken.Data != nil || broken.Error != "The file isn't valid JSON." {
		t.Errorf("Files[1] = %+v, want an invalid JSON error", broken)
	}
	if n := len(f.calls); n != 3 {
		t.Errorf("InFlight() made %d GitHub calls (%v), want 3: the state and two snapshots", n, f.calls)
	}
	if _, err := c.InFlight(t.Context(), pullGH); err != nil || len(f.calls) != 3 {
		t.Errorf("InFlight() again called GitHub: %v, %v", f.calls[3:], err)
	}
}

func TestInFlightReadsChangedFilesOnBase(t *testing.T) {
	const dir = "apps/portfolio/src/data/"
	f, c := newFakeGitHub(t)
	for p, v := range map[string]string{
		dir + "photos/changed.json": `{"file":"changed.jpg","title":"Before"}`,
		dir + "photos/same.json":    `{"file":"same.jpg"}`,
		dir + "albums/seoul.json":   `{"id":"seoul","name":"Soul"}`,
	} {
		f.files["main:"+p] = v
	}
	f.openPull(prBranch, map[string]string{
		dir + "photos/new.json":               `{"file":"new.jpg"}`,
		dir + "photos/changed.json":           `{"file":"changed.jpg","title":"After"}`,
		dir + "albums/seoul.json":             `{"id":"seoul","name":"Seoul"}`,
		dir + "places/gyeongbokgung.json":     `{"id":"gyeongbokgung","name":"Gyeongbokgung"}`,
		dir + "places/PLACES.json":            `[]`,
		dir + "localizations/city-seoul.json": `{"id":"city-seoul","type":"city","name":"Seoul"}`,
	})

	got, err := c.InFlight(t.Context(), pullGH)
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	want := map[string]BaseFile{
		"new.json":     {},
		"changed.json": {Base: json.RawMessage(`{"file":"changed.jpg","title":"Before"}`)},
	}
	if len(got.Files) != len(want) {
		t.Fatalf("Files = %+v, want %d", got.Files, len(want))
	}
	for _, f := range got.Files {
		name := f.Path[strings.LastIndex(f.Path, "/")+1:]
		if w := want[name]; string(f.Base) != string(w.Base) || f.BaseError != w.BaseError {
			t.Errorf("%s: BaseFile = {%s %q}, want {%s %q}", name, f.Base, f.BaseError, w.Base, w.BaseError)
		}
	}
	if len(got.Albums.Files) != 1 || string(got.Albums.Files[0].Base) != `{"id":"seoul","name":"Soul"}` {
		t.Errorf("Albums.Files = %+v, want seoul.json with its JSON on main", got.Albums.Files)
	}
	if len(got.Places.Files) != 1 || string(got.Places.Files[0].Data) != `{"id":"gyeongbokgung","name":"Gyeongbokgung"}` {
		t.Errorf("Places.Files = %+v, want gyeongbokgung.json without PLACES.json", got.Places.Files)
	}
	if len(got.Localizations.Files) != 1 || got.Localizations.Files[0].Status != "added" {
		t.Errorf("Localizations.Files = %+v, want city-seoul.json", got.Localizations.Files)
	}
}

func TestInFlightListsPendingChanges(t *testing.T) {
	f, c := newFakeGitHub(t)
	if _, err := c.Publish(t.Context(), pullGH, photo("DSC0001")); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if _, err := c.CreateGroup(t.Context(), pullGH, Tags, NewGroup{ID: "night", Name: "Night"}); err != nil {
		t.Fatalf("CreateGroup() error = %v", err)
	}
	got, err := c.InFlight(t.Context(), pullGH)
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if got.PullRequest != nil || len(got.Files) != 1 || !got.Files[0].Pending || got.Files[0].FileURL != "" {
		t.Errorf("InFlight() = %+v, want the pending photo without a pull request or a page on GitHub", got)
	}
	if len(got.Tags.Files) != 1 || !got.Tags.Files[0].Pending {
		t.Errorf("Tags.Files = %+v, want the pending tag", got.Tags.Files)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
}

func TestInFlightNoPullRequest(t *testing.T) {
	_, c := newFakeGitHub(t)
	got, err := c.InFlight(t.Context(), settings.GitHub{Repo: "owner/repo", Folder: "/photos/", Token: token})
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if got.PullRequest != nil || len(got.Files) != 0 || got.Folder != "photos/photos" {
		t.Errorf("InFlight() = %+v, want no pull request in folder photos/photos", got)
	}
}

func TestInFlightSeesAMergeAfterForget(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{dataRoot + "/photos/a.json": `{}`})
	if got, _ := c.InFlight(t.Context(), pullGH); got.PullRequest == nil {
		t.Fatal("InFlight() found no pull request")
	}
	f.pulls = nil
	if got, _ := c.InFlight(t.Context(), pullGH); got.PullRequest == nil {
		t.Error("InFlight() asked GitHub again right away")
	}
	c.Forget(pullGH)
	if got, _ := c.InFlight(t.Context(), pullGH); got.PullRequest != nil {
		t.Errorf("InFlight() after Forget() = %+v, want the merge seen", got.PullRequest)
	}
}

func TestInFlightErrors(t *testing.T) {
	_, c := newFakeGitHub(t)
	tests := []struct {
		name string
		gh   settings.GitHub
		want string
	}{
		{"not set up", settings.GitHub{Repo: "owner/repo"}, "Settings first"},
		{"bad folder", settings.GitHub{Repo: "owner/repo", Folder: "a/../b", Token: token}, "isn't a valid path"},
		{"bad token", settings.GitHub{Repo: "owner/repo", Token: "nope"}, "rejected the token"},
		{"unknown repo", settings.GitHub{Repo: "owner/other", Token: token}, "wasn't found, or the token can't see it"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := c.InFlight(t.Context(), tt.gh)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("InFlight() error = %v, want one containing %q", err, tt.want)
			}
		})
	}
}

func TestSnapshotReadsTruncatedFilesFromTheirBlob(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{
		dataRoot + "/photos/a.json":         `{"file":"a.jpg"}`,
		dataRoot + "/photos/ALLPHOTOS.json": `[{"file":"a.jpg"}]`,
	})
	f.truncated[dataRoot+"/photos/ALLPHOTOS.json"] = true
	got, err := c.Combined(t.Context(), pullGH)
	if err != nil || got.Head == nil || string(got.Head.Photos.Data) != `[{"file":"a.jpg"}]` {
		t.Fatalf("Combined() = %+v, %v; want ALLPHOTOS.json read from its blob", got.Head, err)
	}
	if f.count("GET /git/blobs/"+blobSHA([]byte(`[{"file":"a.jpg"}]`))) == 0 {
		t.Errorf("calls = %v, want the blob read", f.calls)
	}
}
