package github

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"
)

// Two hashes 2 bits apart, so near duplicates, and one far from both.
const (
	hashA     = "f0f0f0f0f0f0f0f0"
	hashANear = "f0f0f0f0f0f0f0f3"
	hashFar   = "0f0f0f0f0f0f0f0f"
)

// hashedPhoto is a photo file named file with hash and, unless empty, group.
func hashedPhoto(file, hash, group string) string {
	fields := map[string]any{"title": nil, "file": file, "images": map[string]string{
		"full": "https://photos.example.com/photos/ab-" + file,
	}}
	if hash != "" {
		fields["perceptualHash"] = hash
	}
	if group != "" {
		fields["compareGroup"] = group
	}
	b, _ := json.MarshalIndent(fields, "", "  ")
	return string(b) + "\n"
}

// hashReader answers each Small version's URL with its hash in hashes, and
// fails the rest. The photos are read in parallel, so the URLs read are
// noted under a lock.
func hashReader(hashes map[string]string, read *[]string) HashReader {
	var mu sync.Mutex
	return func(_ context.Context, small string) (string, string) {
		mu.Lock()
		*read = append(*read, small)
		mu.Unlock()
		if h, ok := hashes[small]; ok {
			return h, ""
		}
		return "", "That photo isn't in the bucket anymore."
	}
}

// groupOf is the compareGroup in the content, or "".
func groupOf(t *testing.T, content string) string {
	t.Helper()
	var f struct {
		CompareGroup string `json:"compareGroup"`
	}
	if err := json.Unmarshal([]byte(content), &f); err != nil {
		t.Fatalf("content isn't JSON: %v\n%s", err, content)
	}
	return f.CompareGroup
}

func TestFindNearDuplicates(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{
		"A.json":       hashedPhoto("A.jpg", hashA, ""),
		"B.json":       hashedPhoto("B.jpg", "", ""),
		"C.json":       hashedPhoto("C.jpg", hashFar, "Lanterns"),
		"D.json":       hashedPhoto("D.jpg", hashFar, ""),
		"E.json":       hashedPhoto("E.jpg", "", ""),
		"unsel.json":   `{"file":"U.jpg","perceptualHash":"` + hashA + `","unselected":{"reason":""}}`,
		"broken.json":  `{"file":`,
		"nosmall.json": `{"file":"N.jpg"}`,
	}}
	var read []string
	got, err := repo.start(t).FindNearDuplicates(t.Context(), baseURLSettings, hashReader(map[string]string{
		"https://photos.example.com/photos/ab-B-small.webp": hashANear,
	}, &read))
	if err != nil {
		t.Fatalf("FindNearDuplicates() error = %v", err)
	}
	if got.Hashed != 1 || got.HashFailed != 2 || got.Photos != 6 {
		t.Errorf("result = %+v, want 6 photos, 1 hashed and 2 failed", got)
	}
	if len(read) != 2 {
		t.Errorf("read %v, want B's and E's Small versions", read)
	}
	wantGroups := []NearDuplicates{
		{Group: "Near duplicates of A.jpg", Paths: []string{photosDir + "A.json", photosDir + "B.json"}},
		{Group: "Lanterns", Paths: []string{photosDir + "C.json", photosDir + "D.json"}},
	}
	if len(got.Groups) != 2 || got.Groups[0].Group != wantGroups[0].Group || got.Groups[1].Group != wantGroups[1].Group ||
		strings.Join(got.Groups[0].Paths, ",") != strings.Join(wantGroups[0].Paths, ",") ||
		strings.Join(got.Groups[1].Paths, ",") != strings.Join(wantGroups[1].Paths, ",") {
		t.Errorf("groups = %+v, want %+v", got.Groups, wantGroups)
	}
	staged := repo.staged(t)
	if len(staged) != 3 {
		t.Fatalf("pending = %v, want A, B and D", staged)
	}
	if !strings.Contains(staged[photosDir+"B.json"], `"perceptualHash": "`+hashANear+`"`) {
		t.Errorf("B = %s, want its hash saved", staged[photosDir+"B.json"])
	}
	for name, want := range map[string]string{"A.json": wantGroups[0].Group, "B.json": wantGroups[0].Group, "D.json": "Lanterns"} {
		if g := groupOf(t, staged[photosDir+name]); g != want {
			t.Errorf("%s compareGroup = %q, want %q", name, g, want)
		}
	}
}

func TestPublishPutsNearDuplicatesInCompare(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{
		"A.json": hashedPhoto("A.jpg", hashA, ""),
		"C.json": hashedPhoto("C.jpg", hashFar, ""),
	}}
	c := repo.start(t)
	p := photo("DSC0001")
	p.PerceptualHash = ptr(hashANear)
	got, err := c.Publish(t.Context(), baseURLSettings, p)
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	const group = "Near duplicates of A.jpg"
	if got.NearDuplicates == nil || got.NearDuplicates.Group != group ||
		strings.Join(got.NearDuplicates.Paths, ",") != photosDir+"A.json" {
		t.Errorf("near duplicates = %+v, want A in %q", got.NearDuplicates, group)
	}
	if len(got.Changes) != 1 || got.Changes[0].Path != photosDir+"A.json" {
		t.Errorf("changes = %+v, want A's", got.Changes)
	}
	staged := repo.staged(t)
	if groupOf(t, staged[photosDir+"A.json"]) != group || groupOf(t, staged[got.Path]) != group {
		t.Errorf("pending = %v, want A and the new photo in %q", staged, group)
	}
	if !strings.Contains(string(got.Data), `"perceptualHash": "`+hashANear+`"`) {
		t.Errorf("data = %s, want its hash", got.Data)
	}
}

func TestPublishWithoutNearDuplicates(t *testing.T) {
	repo := &baseURLRepo{files: map[string]string{"C.json": hashedPhoto("C.jpg", hashFar, "")}}
	p := photo("DSC0001")
	p.PerceptualHash = ptr(hashA)
	got, err := repo.start(t).Publish(t.Context(), baseURLSettings, p)
	if err != nil {
		t.Fatalf("Publish() error = %v", err)
	}
	if got.NearDuplicates != nil || len(got.Changes) != 0 || strings.Contains(string(got.Data), "compareGroup") {
		t.Errorf("Publish() = %+v, want no compare group", got)
	}
}
