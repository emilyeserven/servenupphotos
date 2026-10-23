package github

import (
	"errors"
	"net/http"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

func TestFindInPullRequest(t *testing.T) {
	const (
		published  = `{"file":"DSC0001.jpg","gpsPosition":"35 deg 39' 31.20\" N, 139 deg 42' 2.40\" E","createDate":"2026:10:01 09:00:00","images":{"full":null,"key":null}}`
		waiting    = `{"file":"DSC0002.jpg","gpsPosition":null,"createDate":"2026:10:02 09:00:00"}`
		onlyOnMain = `{"file":"DSC0009.jpg","title":"Nine","gpsPosition":null,"createDate":"2026:10:09 09:00:00"}`
	)
	tests := []struct {
		name   string
		photo  PhotoIdentity
		source string
	}{
		{"changed in the pull request",
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:00")},
			"DSC0001.json in pull request #1"},
		{"only on the base branch", PhotoIdentity{File: "DSC0009.jpg", CreateDate: ptr("2026:10:09 09:00:00")}, ""},
		{"waiting in the pull request, both without GPS",
			PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, "DSC0002.json in pull request #1"},
		{"different date",
			PhotoIdentity{File: "DSC0001.jpg", GPSPosition: ptr(`35 deg 39' 31.20" N, 139 deg 42' 2.40" E`), CreateDate: ptr("2026:10:01 09:00:01")}, ""},
		{"GPS on only one side", PhotoIdentity{File: "DSC0002.jpg", GPSPosition: ptr("0 deg N"), CreateDate: ptr("2026:10:02 09:00:00")}, ""},
		{"different name", PhotoIdentity{File: "DSC0003.jpg", CreateDate: ptr("2026:10:02 09:00:00")}, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, c := newFakeGitHub(t)
			f.files["main:"+photosDir+"DSC0001.json"] = `{"file":"DSC0001.jpg","title":"One"}`
			f.files["main:"+photosDir+"DSC0009.json"] = onlyOnMain
			// The pull request's own ALLPHOTOS.json is stale, so DSC0002 is
			// only found through its file.
			f.openPull(prBranch, map[string]string{
				photosDir + "ALLPHOTOS.json": "[" + published + "]",
				photosDir + "DSC0001.json":   published,
				photosDir + "DSC0002.json":   waiting,
			})
			got, err := c.FindInPullRequest(t.Context(), pullGH, tt.photo)
			if err != nil {
				t.Fatal(err)
			}
			if len(got.Sources) != 1 {
				t.Errorf("sources = %+v, want the pull request", got.Sources)
			}
			if tt.source == "" {
				if len(got.Matches) != 0 {
					t.Errorf("matches = %+v, want none", got.Matches)
				}
				return
			}
			fileURL := "https://github.com/owner/repo/blob/" + prBranch + "/" + photosDir + tt.photo.File[:7] + ".json"
			if len(got.Matches) != 1 || got.Matches[0].Source != tt.source || got.Matches[0].FileURL != fileURL {
				t.Fatalf("matches = %+v, want one from %s at %s", got.Matches, tt.source, fileURL)
			}
			if !strings.Contains(string(got.Matches[0].Entry), tt.photo.File) {
				t.Errorf("entry = %s", got.Matches[0].Entry)
			}
		})
	}
}

func TestFindInPullRequestBaseDrafts(t *testing.T) {
	const (
		draft  = `{"file":"DSC0001.jpg","title":" ","createDate":"2026:10:01 09:00:00"}`
		listed = `{"file":"DSC0002.jpg","title":null,"createDate":"2026:10:02 09:00:00"}`
	)
	f, c := newFakeGitHub(t)
	f.files["main:"+photosDir+"DSC0001.json"] = draft
	f.files["main:"+photosDir+"DSC0002.json"] = listed
	// DSC0002 was committed before drafts, so pages find it in ALLPHOTOS.json.
	f.files["main:"+photosDir+"ALLPHOTOS.json"] = "[" + listed + "]"
	got, err := c.FindInPullRequest(t.Context(), pullGH, PhotoIdentity{File: "DSC0001.jpg", CreateDate: ptr("2026:10:01 09:00:00")})
	if err != nil || len(got.Sources) != 1 || got.Sources[0].Label != "the drafts on main" {
		t.Fatalf("FindInPullRequest() = %+v, %v; want the drafts on main", got, err)
	}
	if len(got.Matches) != 1 || got.Matches[0].Source != "DSC0001.json in the drafts on main" {
		t.Errorf("matches = %+v, want the draft", got.Matches)
	}
	got, err = c.FindInPullRequest(t.Context(), pullGH, PhotoIdentity{File: "DSC0002.jpg", CreateDate: ptr("2026:10:02 09:00:00")})
	if err != nil || len(got.Matches) != 0 {
		t.Errorf("FindInPullRequest() = %+v, %v; want no match for a photo in ALLPHOTOS.json", got, err)
	}
}

func TestFindInPullRequestPending(t *testing.T) {
	f, c := newFakeGitHub(t)
	got, err := c.FindInPullRequest(t.Context(), pullGH, PhotoIdentity{File: "DSC0001.jpg"})
	if err != nil || len(got.Sources) != 0 {
		t.Errorf("FindInPullRequest() = %+v, %v; want no sources with nothing in flight", got, err)
	}
	if _, err := c.Publish(t.Context(), pullGH, photo("DSC0001")); err != nil {
		t.Fatal(err)
	}
	identity := PhotoIdentity{File: "DSC0001.jpg"}
	got, err = c.FindInPullRequest(t.Context(), pullGH, identity)
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Sources) != 1 || got.Sources[0].Label != "the changes waiting for Commit" || len(got.Matches) != 1 ||
		got.Matches[0].FileURL != "" {
		t.Errorf("FindInPullRequest() = %+v, want the pending photo", got)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub: %v", w)
	}
}

func TestFindInPullRequestSources(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.openPull(prBranch, map[string]string{photosDir + "bad.json": `{not json`})
	got, err := c.FindInPullRequest(t.Context(), pullGH, PhotoIdentity{File: "a.jpg"})
	if err != nil {
		t.Fatal(err)
	}
	want := AllPhotosSource{Label: "pull request #1", FileURL: "https://github.com/owner/repo/pull/1",
		Found: true, Error: "couldn't read bad.json"}
	if len(got.Sources) != 1 || got.Sources[0] != want {
		t.Errorf("sources = %+v\nwant %+v", got.Sources, want)
	}
}

func TestFindInPullRequestNeedsSettings(t *testing.T) {
	var perr *PublishError
	_, err := New(nil).FindInPullRequest(t.Context(), settings.GitHub{}, PhotoIdentity{File: "a.jpg"})
	if !errors.As(err, &perr) || perr.Status != http.StatusBadRequest {
		t.Errorf("err = %v, want a 400 asking for settings", err)
	}
	_, err = New(nil).FindInPullRequest(t.Context(), settings.GitHub{Repo: "owner/repo", Token: token}, PhotoIdentity{})
	if !errors.As(err, &perr) || perr.Message != "file is required" {
		t.Errorf("err = %v, want file is required", err)
	}
}
