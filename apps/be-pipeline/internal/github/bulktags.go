package github

import (
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"path"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxBulkTagPhotos is how many photos Bulk Tagging picks, and tags, at a time.
const maxBulkTagPhotos = 5

// BulkTagPhoto is one photo Bulk Tagging picked: its file, its JSON for the
// prompt to read what's known of it, and why it goes with the first one.
type BulkTagPhoto struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl,omitempty"`
	// Name is the file's name without ".json", which the prompt and the
	// pasted answer call the photo by.
	Name string          `json:"name"`
	Data json.RawMessage `json:"data"`
	// Related says what it shares with the first photo, such as
	// "same city: Kyoto"; empty for the first photo itself.
	Related []string `json:"related"`
}

// BulkTagPick is the photos Bulk Tagging picked to tag together.
type BulkTagPick struct {
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// Untagged is how many photo files have no tags.
	Untagged int            `json:"untagged"`
	Photos   []BulkTagPhoto `json:"photos"`
}

// bulkPhoto is what Bulk Tagging compares of a photo file.
type bulkPhoto struct {
	file    photoFile
	name    string
	tags    []string
	genres  []string
	places  []string
	city    string
	country string
	// date is when it was taken, as "2016:12:16 09:27:41".
	date string
}

// readBulkPhoto reads what Bulk Tagging compares from f, a readable photo file.
func readBulkPhoto(f photoFile) bulkPhoto {
	var data struct {
		Tags, Genres                 []string
		Places                       []struct{ ID string }
		City, CustomCity             *string
		Country, CustomCountry       *string
		CreateDate, CustomCreateDate *string
	}
	_ = json.Unmarshal(f.content, &data)
	p := bulkPhoto{
		file: f, name: strings.TrimSuffix(path.Base(f.path), path.Ext(f.path)), tags: data.Tags, genres: data.Genres,
		city:    strings.ToLower(firstText(data.CustomCity, data.City)),
		country: strings.ToLower(firstText(data.CustomCountry, data.Country)),
		date:    firstText(data.CustomCreateDate, data.CreateDate),
	}
	for _, place := range data.Places {
		p.places = append(p.places, place.ID)
	}
	return p
}

// firstText is the first of values that has text, trimmed, or "".
func firstText(values ...*string) string {
	for _, v := range values {
		if v != nil && strings.TrimSpace(*v) != "" {
			return strings.TrimSpace(*v)
		}
	}
	return ""
}

// relation is how alike two photos are, and in what, as Bulk Tagging ranks them.
type relation struct {
	score   int
	reasons []string
}

// add counts a shared trait worth points, said as reason.
func (r *relation) add(points int, reason string) {
	r.score += points
	r.reasons = append(r.reasons, reason)
}

// relate is how alike other is to seed: their shared places, city, country,
// genres and date.
func relate(seed, other bulkPhoto) relation {
	var r relation
	for _, id := range shared(seed.places, other.places) {
		r.add(5, "same place: "+id)
	}
	relateLocation(&r, seed, other)
	for _, id := range shared(seed.genres, other.genres) {
		r.add(2, "same genre: "+id)
	}
	relateDate(&r, seed.date, other.date)
	return r
}

// relateLocation counts a shared city, or else a shared country.
func relateLocation(r *relation, seed, other bulkPhoto) {
	switch {
	case seed.city != "" && seed.city == other.city:
		r.add(3, "same city: "+other.city)
	case seed.country != "" && seed.country == other.country:
		r.add(1, "same country: "+other.country)
	}
}

// relateDate counts being taken on the same day, or else in the same month.
func relateDate(r *relation, a, b string) {
	switch {
	case len(a) >= 10 && len(b) >= 10 && a[:10] == b[:10]:
		r.add(3, "taken the same day")
	case len(a) >= 7 && len(b) >= 7 && a[:7] == b[:7]:
		r.add(1, "taken the same month")
	}
}

// shared is the IDs in both a and b, in a's order.
func shared(a, b []string) []string {
	var out []string
	for _, id := range a {
		if id != "" && slices.Contains(b, id) && !slices.Contains(out, id) {
			out = append(out, id)
		}
	}
	return out
}

// PickBulkTagPhotos picks up to five related photos to tag together, from the
// photo files as the next Commit will have them, leaving out skip's paths.
// Only photos without tags are picked: the first by path, then the ones most
// like it (sharing its places, city or country, genres and date). It only
// reads.
func (c *Client) PickBulkTagPhotos(ctx context.Context, gh settings.GitHub, skip []string) (BulkTagPick, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return BulkTagPick{}, perr
	}
	pick := BulkTagPick{Branch: scan.branch, PhotoFiles: len(scan.files), Photos: []BulkTagPhoto{}}
	if scan.pr != nil {
		pick.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	var photos []bulkPhoto
	for _, f := range scan.files {
		if f.err != "" {
			continue
		}
		p := readBulkPhoto(f)
		if len(p.tags) > 0 {
			continue
		}
		pick.Untagged++
		if !slices.Contains(skip, f.path) {
			photos = append(photos, p)
		}
	}
	if len(photos) == 0 {
		return BulkTagPick{}, publishErr(http.StatusNotFound, "There are no more photos without tags to pick from. Start over to pick from every one again.")
	}
	pick.Photos = pickRelated(photos)
	return pick, nil
}

// pickRelated is the first photo in photos by path, then the ones most like
// it.
func pickRelated(photos []bulkPhoto) []BulkTagPhoto {
	seed := slices.MinFunc(photos, func(a, b bulkPhoto) int {
		return cmp.Compare(a.file.path, b.file.path)
	})
	type ranked struct {
		photo bulkPhoto
		rel   relation
	}
	var others []ranked
	for _, p := range photos {
		if rel := relate(seed, p); p.file.path != seed.file.path && p.name != seed.name && rel.score > 0 {
			others = append(others, ranked{p, rel})
		}
	}
	slices.SortStableFunc(others, func(a, b ranked) int {
		return cmp.Compare(b.rel.score, a.rel.score)
	})
	out := []BulkTagPhoto{bulkTagPhoto(seed, nil)}
	names := map[string]bool{seed.name: true}
	for _, o := range others {
		if len(out) < maxBulkTagPhotos && !names[o.photo.name] {
			names[o.photo.name] = true
			out = append(out, bulkTagPhoto(o.photo, o.rel.reasons))
		}
	}
	return out
}

// bulkTagPhoto is p as Bulk Tagging answers it.
func bulkTagPhoto(p bulkPhoto, related []string) BulkTagPhoto {
	if related == nil {
		related = []string{}
	}
	return BulkTagPhoto{Path: p.file.path, FileURL: p.file.fileURL, Name: p.name, Data: p.file.content, Related: related}
}
