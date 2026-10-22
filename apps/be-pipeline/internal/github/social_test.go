package github

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestSetTopLevel(t *testing.T) {
	tests := []struct {
		name, content, value, want string
	}{
		{"replaces a value", "{\n  \"file\": \"a.jpg\",\n  \"socialMediaPublishDate\": null,\n  \"images\": {}\n}\n", `"2026-10-22"`,
			"{\n  \"file\": \"a.jpg\",\n  \"socialMediaPublishDate\": \"2026-10-22\",\n  \"images\": {}\n}\n"},
		{"replaces a value after nested ones", `{"images":{"socialMediaPublishDate":"x"},"list":[1,{"a":2}],"socialMediaPublishDate":"2026-01-01"}`, `null`,
			`{"images":{"socialMediaPublishDate":"x"},"list":[1,{"a":2}],"socialMediaPublishDate":null}`},
		{"adds a missing key", "{\n  \"file\": \"a.jpg\",\n  \"images\": {\n    \"full\": null\n  }\n}\n", `"2026-10-22"`,
			"{\n  \"file\": \"a.jpg\",\n  \"images\": {\n    \"full\": null\n  },\n  \"socialMediaPublishDate\": \"2026-10-22\"\n}\n"},
		{"adds to an empty object", `{}`, `null`, "{\n  \"socialMediaPublishDate\": null\n}"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := setTopLevel([]byte(tt.content), publishDateKey, []byte(tt.value))
			if err != nil {
				t.Fatalf("setTopLevel() error = %v", err)
			}
			if string(got) != tt.want {
				t.Errorf("setTopLevel() =\n%s\nwant\n%s", got, tt.want)
			}
			if !json.Valid(got) {
				t.Errorf("setTopLevel() = %s, not valid JSON", got)
			}
		})
	}
	for _, bad := range []string{`[]`, `{"socialMediaPublishDate": {"day": 1}}`, `{"a":`} {
		if _, err := setTopLevel([]byte(bad), publishDateKey, []byte(`null`)); err == nil {
			t.Errorf("setTopLevel(%s) error = nil, want one", bad)
		}
	}
}

// photoB and photoC are photo files.
const (
	photoB = `{"file":"B.jpg","title":"Bee","gpsPosition":null,"createDate":"2026:05:16 15:24:10","isSocialMediaEligible":true,"socialMediaPublishDate":"2026-10-22","images":{"thumbnail":null,"small":"https://cdn.example.com/B-small.webp","thumbnailcrop":{"x":1,"y":2,"size":3,"outputSize":500}}}`
	photoC = `{"file":"C.jpg","gpsPosition":"1 deg N","createDate":null,"images":{}}`
)

func TestSocialCalendar(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"B.json": photoB, "C.json": photoC, "broken.json": `{"file":`,
	}}
	got, err := repo.start(t).SocialCalendar(t.Context(), baseURLSettings)
	if err != nil {
		t.Fatalf("SocialCalendar() error = %v", err)
	}
	if got.Branch != "photo-data/2026-10-15-024500" || got.PullRequest == nil {
		t.Errorf("calendar = %+v, want the pull request's branch", got)
	}
	if len(got.Photos) != 2 || len(got.Unreadable) != 1 {
		t.Fatalf("photos = %+v, unreadable = %+v; want B and C, and broken.json", got.Photos, got.Unreadable)
	}
	b, c := got.Photos[0], got.Photos[1]
	if b.File != "B.jpg" || *b.Title != "Bee" || *b.Image != "https://cdn.example.com/B-small.webp" ||
		!b.IsSocialMediaEligible || *b.SocialMediaPublishDate != "2026-10-22" ||
		b.GPSPosition != nil || *b.CreateDate != "2026:05:16 15:24:10" {
		t.Errorf("B = %+v", b)
	}
	if c.File != "C.jpg" || c.Image != nil || c.SocialMediaPublishDate != nil ||
		*c.GPSPosition != "1 deg N" || c.CreateDate != nil {
		t.Errorf("C = %+v", c)
	}
}

func date(s string) *string { return &s }

func TestSetSocialDates(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"B.json": photoB, "C.json": photoC}}
	// Swap: C takes B's day, and B moves to the next.
	got, err := repo.start(t).SetSocialDates(t.Context(), baseURLSettings, []SocialDate{
		{Path: "apps/portfolio/src/data/photos/B.json", Date: date("2026-10-23")},
		{Path: "apps/portfolio/src/data/photos/C.json", Date: date("2026-10-22")},
	})
	if err != nil {
		t.Fatalf("SetSocialDates() error = %v", err)
	}
	if got.Files != 2 || got.PullRequestNumber != 7 || repo.refs["photo-data/2026-10-15-024500"] != "commit2" {
		t.Errorf("SetSocialDates() = %+v, refs %v; want 2 files on the pull request's branch", got, repo.refs)
	}
	contents := map[string]string{}
	for _, e := range repo.tree {
		contents[e["path"]] = e["content"]
	}
	if want := strings.Replace(photoB, `"2026-10-22"`, `"2026-10-23"`, 1); contents["apps/portfolio/src/data/photos/B.json"] != want {
		t.Errorf("B.json = %s, want %s", contents["apps/portfolio/src/data/photos/B.json"], want)
	}
	if c := contents["apps/portfolio/src/data/photos/C.json"]; !strings.HasSuffix(c, ",\n  \"socialMediaPublishDate\": \"2026-10-22\"}") {
		t.Errorf("C.json = %s, want the date added at the end", c)
	}
	for _, ch := range got.Changes {
		if string(ch.After) != contents[ch.Path] || len(ch.Before) == 0 {
			t.Errorf("change %s = %s → %s, want the file before and as committed", ch.Path, ch.Before, ch.After)
		}
	}
	if len(got.Changes) != 2 {
		t.Errorf("changes = %d, want 2", len(got.Changes))
	}
	if msg := repo.commit["message"]; msg != "Schedule social media posts for 2 photos" {
		t.Errorf("commit message = %v", msg)
	}
}

func TestSetSocialDatesErrors(t *testing.T) {
	const dir = "apps/portfolio/src/data/photos/"
	tests := []struct {
		name  string
		dates []SocialDate
		want  string
	}{
		{"nothing to save", nil, "no publish dates"},
		{"bad date", []SocialDate{{Path: dir + "C.json", Date: date("Oct 22")}}, "isn't a date"},
		{"listed twice", []SocialDate{{Path: dir + "C.json"}, {Path: dir + "C.json"}}, "more than once"},
		{"same day as another", []SocialDate{{Path: dir + "C.json", Date: date("2026-10-22")}}, "would both be posted on 2026-10-22"},
		{"not a photo file", []SocialDate{{Path: dir + "D.json", Date: date("2026-10-24")}}, "D.json isn't a photo file"},
		{"already saved", []SocialDate{{Path: dir + "B.json", Date: date("2026-10-22")}}, "already saved"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &baseURLRepo{pull: true, files: map[string]string{"B.json": photoB, "C.json": photoC}}
			_, err := repo.start(t).SetSocialDates(t.Context(), baseURLSettings, tt.dates)
			var perr *PublishError
			if !errors.As(err, &perr) || !strings.Contains(perr.Message, tt.want) {
				t.Errorf("SetSocialDates() error = %v, want one containing %q", err, tt.want)
			}
			if repo.commit != nil {
				t.Errorf("committed %v, want nothing", repo.commit)
			}
		})
	}
}
