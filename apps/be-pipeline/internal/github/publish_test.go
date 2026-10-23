package github

import (
	"errors"
	"net/http"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

var gh = settings.GitHub{Repo: "owner/repo", Folder: "/photos/data/", Token: token}

func photo(name string) Photo {
	return Photo{Name: name, File: name + ".jpg", Sanitized: exif.Sanitized{
		Title:       ptr("Tokyo at night"),
		Camera:      ptr("X-T5"),
		Aperture:    ref(2.8),
		Exposure:    ptr("1/250"),
		ISO:         ref(400),
		FocalLength: ref(35.0),
		City:        ptr("Tokyo"),
		Comment:     ptr("Shot from the **bridge**."),
		Images: exif.Images{
			Full: ptr("https://photos.example.com/photos/0123456789ab-" + name + ".jpg"),
			Key:  ptr("photos/0123456789ab-" + name + ".jpg"),
		},
	}}
}

func TestPublishKeepsThePhotoUntilCommit(t *testing.T) {
	f, c := newFakeGitHub(t)

	first, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	if err != nil {
		t.Fatalf("first Publish() error = %v", err)
	}
	saved := first.Data
	first.Data = nil
	if want := (PublishResult{Path: "photos/data/photos/DSC0001.json"}); !reflect.DeepEqual(first, want) {
		t.Errorf("first Publish() = %+v, want %+v", first, want)
	}
	wantJSON := `{
  "id": 1,
  "title": "Tokyo at night",
  "comment": "Shot from the **bridge**.",
  "file": "DSC0001.jpg",
  "camera": "X-T5",
  "lens": null,
  "aperture": 2.8,
  "exposure": "1/250",
  "iso": 400,
  "focalLength": 35,
  "gpsPosition": null,
  "createDate": null,
  "placeName": null,
  "customCity": null,
  "customCountry": null,
  "country": null,
  "city": "Tokyo",
  "width": null,
  "height": null,
  "images": {
    "full": "https://photos.example.com/photos/0123456789ab-DSC0001.jpg",
    "key": "photos/0123456789ab-DSC0001.jpg",
    "xlarge": null,
    "large": null,
    "medium": null,
    "small": null,
    "xsmall": null,
    "preview": null,
    "thumbnail": null,
    "thumbnailpreview": null,
    "thumbnailcrop": null
  },
  "isSocialMediaEligible": false,
  "websiteSpotlight": null,
  "socialMediaPublishDate": null,
  "albums": [],
  "tags": [],
  "places": [],
  "spotlightZones": [],
  "socialPosts": []
}
`
	if string(saved) != wantJSON {
		t.Errorf("first Publish() data = %s, want %s", saved, wantJSON)
	}
	second, err := c.Publish(t.Context(), gh, photo("DSC0002.json"))
	if err != nil {
		t.Fatalf("second Publish() error = %v", err)
	}
	if id, _ := photoID(second.Data); id != 2 {
		t.Errorf("second Publish() id = %d, want 2, after the first's", id)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("Publish() wrote to GitHub: %v", w)
	}
	// Both saves read GitHub once: where the repository stands, and main's files.
	if n := len(f.calls); n != 2 {
		t.Errorf("two saves made %d GitHub calls (%v), want 2", n, f.calls)
	}

	commit, err := c.CommitCombined(t.Context(), gh, nil)
	if err != nil {
		t.Fatalf("CommitCombined() error = %v", err)
	}
	if !commit.NewPullRequest || commit.PullRequestURL != "https://github.com/owner/repo/pull/1" || commit.Edited != 2 {
		t.Errorf("CommitCombined() = %+v, want both files committed in a new pull request", commit)
	}
	wantWrites := []string{"POST /git/trees", "POST /git/commits", "POST /git/refs", "POST /pulls"}
	if w := f.writes(); !slices.Equal(w, wantWrites) {
		t.Errorf("CommitCombined() wrote %v, want %v", w, wantWrites)
	}
	got, _ := f.file("photo-data/2026-10-15-024500", "photos/data/photos/DSC0001.json")
	if got != wantJSON {
		t.Errorf("committed file = %s, want %s", got, wantJSON)
	}
	if _, ok := f.file("photo-data/2026-10-15-024500", "photos/data/photos/ALLPHOTOS.json"); !ok {
		t.Error("the commit has no ALLPHOTOS.json")
	}

	// The next save goes into the pull request the commit opened.
	third, err := c.Publish(t.Context(), gh, photo("DSC0003"))
	if err != nil {
		t.Fatalf("third Publish() error = %v", err)
	}
	if third.PullRequestNumber != 1 {
		t.Errorf("third Publish() = %+v, want it in pull request 1", third)
	}
}

func TestPublishRefusesExistingFile(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.files["main:photos/data/photos/DSC0001.json"] = "{}"
	f.openPull("photo-data/x", map[string]string{"photos/data/photos/DSC0003.json": "{}"})

	var perr *PublishError
	_, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	if !errors.As(err, &perr) || perr.Message != "photos/data/photos/DSC0001.json already exists on main. Pick another file name." {
		t.Errorf("Publish() of a photo on main: error = %v, want a conflict", err)
	}
	_, err = c.Publish(t.Context(), gh, photo("DSC0003"))
	if !errors.As(err, &perr) || perr.Message != "photos/data/photos/DSC0003.json already exists on photo-data/x. Pick another file name." {
		t.Errorf("Publish() of a photo in the pull request: error = %v, want a conflict", err)
	}
	if _, err := c.Publish(t.Context(), gh, photo("DSC0002")); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	_, err = c.Publish(t.Context(), gh, photo("DSC0002"))
	if !errors.As(err, &perr) || perr.Status != http.StatusConflict || !strings.Contains(perr.Message, "waiting for Commit") {
		t.Errorf("Publish() of a photo already saved: error = %v, want a conflict", err)
	}
}

func TestPublishIgnoresOtherPullRequests(t *testing.T) {
	f, c := newFakeGitHub(t)
	f.pulls = append(f.pulls, fakePull{number: 1, title: "Fix the map", branch: "feature/x", base: "main"})
	f.versions["feature/x"] = 1

	got, err := c.Publish(t.Context(), gh, photo("DSC0001"))
	if err != nil || got.PullRequestNumber != 0 {
		t.Fatalf("Publish() = %+v, %v, want no pull request", got, err)
	}
	commit, err := c.CommitCombined(t.Context(), gh, nil)
	if err != nil || !commit.NewPullRequest || commit.PullRequestURL != "https://github.com/owner/repo/pull/2" {
		t.Errorf("CommitCombined() = %+v, %v, want a new pull request", commit, err)
	}
}

func TestPublishKeepsPendingChangesAcrossRestarts(t *testing.T) {
	f, c := newFakeGitHub(t)
	file := filepath.Join(t.TempDir(), "pending-changes.json")
	c.Stage = NewStage(file)
	if _, err := c.Publish(t.Context(), gh, photo("DSC0001")); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	restarted := &Client{BaseURL: c.BaseURL, Client: c.Client, Now: c.Now, Stage: NewStage(file)}
	inFlight, err := restarted.InFlight(t.Context(), gh)
	if err != nil {
		t.Fatalf("InFlight() error = %v", err)
	}
	if len(inFlight.Files) != 1 || !inFlight.Files[0].Pending || inFlight.Files[0].Status != "added" {
		t.Errorf("InFlight() after a restart = %+v, want the pending photo", inFlight.Files)
	}
	if w := f.writes(); len(w) != 0 {
		t.Errorf("wrote to GitHub before Commit: %v", w)
	}
}

func TestPublishErrors(t *testing.T) {
	tests := []struct {
		name    string
		gh      settings.GitHub
		photo   Photo
		limited bool
		status  int
		message string
	}{
		{
			name:    "bad file name",
			gh:      gh,
			photo:   photo("../secrets"),
			status:  http.StatusBadRequest,
			message: "Use a file name of letters, numbers, dots, dashes and underscores.",
		},
		{
			name:    "bad folder",
			gh:      settings.GitHub{Repo: "owner/repo", Folder: "a/../b", Token: token},
			photo:   photo("DSC0001"),
			status:  http.StatusBadRequest,
			message: "The folder in Settings isn't a valid path.",
		},
		{
			name:    "not set up",
			gh:      settings.GitHub{Folder: "photos"},
			photo:   photo("DSC0001"),
			status:  http.StatusBadRequest,
			message: "Set the GitHub repository and token in Settings first.",
		},
		{
			name:    "missing base branch",
			gh:      settings.GitHub{Repo: "owner/repo", Branch: "nope", Token: token},
			photo:   photo("DSC0001"),
			status:  http.StatusBadGateway,
			message: `Branch "nope" wasn't found in owner/repo.`,
		},
		{
			name:    "missing repository",
			gh:      settings.GitHub{Repo: "owner/nope", Token: token},
			photo:   photo("DSC0001"),
			status:  http.StatusBadGateway,
			message: "Repository owner/nope wasn't found, or the token can't see it.",
		},
		{
			name:    "rate limited",
			gh:      gh,
			photo:   photo("DSC0001"),
			limited: true,
			status:  http.StatusTooManyRequests,
			message: "GitHub's rate limit was hit, so nothing was read or saved. Try again in 23 minutes",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f, c := newFakeGitHub(t)
			f.limited = tt.limited
			_, err := c.Publish(t.Context(), tt.gh, tt.photo)
			var perr *PublishError
			if !errors.As(err, &perr) || perr.Status != tt.status || !strings.HasPrefix(perr.Message, tt.message) {
				t.Errorf("Publish() error = %v, want %d %q", err, tt.status, tt.message)
			}
		})
	}
}
