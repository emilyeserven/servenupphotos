package github

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// similarKey and pickedSimilarKey are the photo JSON fields the portfolio's
// More like this drawer reads: the IDs Find Related Photos found, and the
// IDs picked by hand, which come first.
const (
	similarKey       = "similarPhotos"
	pickedSimilarKey = "pickedSimilar"
	// pickedNotesKey is the note shown beside each hand-picked photo in the
	// drawer, by the picked photo's ID.
	pickedNotesKey = "pickedSimilarNotes"
)

// similarCount is how many related photos Find Related Photos keeps for each
// photo, as many as the drawer shows.
const similarCount = 6

// minSimilarScore is the lowest score a photo needs to count as like
// another, such as one shared tag.
const minSimilarScore = 3.0

// Similarity weights: how much each thing two photos have in common adds to
// their score.
const (
	tagWeight     = 3.0 // each tag both have
	genreWeight   = 2.0 // each genre both have
	albumWeight   = 2.0 // each album both are in
	cityWeight    = 2.0 // the same city
	countryWeight = 1.0 // the same country, when not the same city
	dayWeight     = 2.0 // taken on the same day
	colorWeight   = 6.0 // times how much of both photos is the same colors (0 to 1)
)

// shadeNames are the shades a photo's blacks, grays and whites are split
// into, dark to light, as the portfolio's Color page splits them.
var shadeNames = []string{"black", "dark gray", "gray", "light gray", "white"}

// SimilarResult says what Find Related Photos saved: each photo's list of
// related photos, in the pending changes for the next Commit.
type SimilarResult struct {
	pendingSave
	// PhotoFiles is how many photo files were compared.
	PhotoFiles int `json:"photoFiles"`
	// Photos is how many photo files got a new list; the others already had it.
	Photos int `json:"photos"`
}

// similarPhoto is what Find Related Photos compares of a photo file.
type similarPhoto struct {
	file     photoFile
	id       int
	hasImage bool
	bulk     bulkPhoto
	// colors is how much of the photo is each hue bucket and shade, 0 to 1.
	colors map[string]float64
}

// similarFields is the part of a photo file read for its ID, image and colors.
type similarFields struct {
	ID     int               `json:"id"`
	Width  int               `json:"width"`
	Height int               `json:"height"`
	Images map[string]any    `json:"images"`
	Colors *similarColorData `json:"colors"`
}

// similarColorData is a photo's "colors": its hue buckets and its neutral
// lightness histogram.
type similarColorData struct {
	Buckets []struct {
		Name  string  `json:"name"`
		Share float64 `json:"share"`
	} `json:"buckets"`
	Neutrals struct {
		Histogram []struct {
			From  float64 `json:"from"`
			Share float64 `json:"share"`
		} `json:"histogram"`
	} `json:"neutrals"`
}

// readSimilarPhoto reads what Find Related Photos compares from f, a readable
// photo file.
func readSimilarPhoto(f photoFile) similarPhoto {
	var fields similarFields
	_ = json.Unmarshal(f.content, &fields)
	return similarPhoto{
		file: f, id: fields.ID, hasImage: hasAnyImage(fields), bulk: readBulkPhoto(f),
		colors: colorShares(fields.Colors),
	}
}

// hasAnyImage is whether the photo has a size and a resized version, which
// is all the portfolio's viewer can show.
func hasAnyImage(fields similarFields) bool {
	if fields.Width <= 0 || fields.Height <= 0 {
		return false
	}
	for _, v := range fields.Images {
		if s, ok := v.(string); ok && s != "" {
			return true
		}
	}
	return false
}

// colorShares is how much of the photo is each hue bucket and shade, as the
// portfolio's Color page reads them.
func colorShares(colors *similarColorData) map[string]float64 {
	out := map[string]float64{}
	if colors == nil {
		return out
	}
	for _, b := range colors.Buckets {
		out[b.Name] += b.Share
	}
	for _, bin := range colors.Neutrals.Histogram {
		out[shadeOf(bin.From)] += bin.Share
	}
	return out
}

// shadeOf is the shade a CIELAB lightness falls in, each a fifth of 0 to 100.
func shadeOf(lightness float64) string {
	return shadeNames[min(len(shadeNames)-1, max(0, int(lightness/20)))]
}

// FindSimilarPhotos works out, for every photo, the photos most like it by
// shared tags, genres, albums, place, day and colors, and saves their IDs,
// best first, in each photo file's "similarPhotos", in the pending changes.
// Only that field changes, and only in files whose list is new. The
// portfolio's More like this drawer shows them after the photos in
// "pickedSimilar".
func (c *Client) FindSimilarPhotos(ctx context.Context, gh settings.GitHub) (SimilarResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return SimilarResult{}, perr
	}
	photos := readableSimilar(scan.files)
	var entries []map[string]string
	for _, p := range photos {
		content, err := setIDList(p.file.content, similarKey, similarIDs(p, photos))
		if err != nil {
			return SimilarResult{}, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.file.path, err)
		}
		if !bytes.Equal(content, p.file.content) {
			entries = append(entries, map[string]string{"path": p.file.path, "content": string(content)})
		}
	}
	if len(entries) == 0 {
		return SimilarResult{}, publishErr(http.StatusConflict, "Every photo's related photos are already up to date, so there's nothing to change.")
	}
	saved, perr := c.saveScan(scan, entries)
	if perr != nil {
		return SimilarResult{}, perr
	}
	return SimilarResult{pendingSave: saved, PhotoFiles: len(photos), Photos: len(entries)}, nil
}

// readableSimilar is the files that could be read and have an ID.
func readableSimilar(files []photoFile) []similarPhoto {
	var out []similarPhoto
	for _, f := range files {
		if f.err != "" {
			continue
		}
		if p := readSimilarPhoto(f); p.id > 0 {
			out = append(out, p)
		}
	}
	return out
}

// scoredPhoto is another photo and how like the one being compared it is.
type scoredPhoto struct {
	p     similarPhoto
	score float64
}

// similarIDs is the IDs of the photos most like p among all, best first: up to
// similarCount photos with images that score at least minSimilarScore. Ties
// go to the photo taken closest in time, then the lower ID.
func similarIDs(p similarPhoto, all []similarPhoto) []int {
	var scored []scoredPhoto
	for _, other := range all {
		if other.id == p.id || !other.hasImage {
			continue
		}
		if score := similarity(p, other); score >= minSimilarScore {
			scored = append(scored, scoredPhoto{other, score})
		}
	}
	slices.SortStableFunc(scored, func(a, b scoredPhoto) int {
		return cmp.Or(
			cmp.Compare(b.score, a.score),
			cmp.Compare(timeApart(p, a.p), timeApart(p, b.p)),
			cmp.Compare(a.p.id, b.p.id),
		)
	})
	ids := []int{}
	for _, s := range scored[:min(len(scored), similarCount)] {
		ids = append(ids, s.p.id)
	}
	return ids
}

// similarity is how alike two photos are: the weighted sum of what they have
// in common.
func similarity(a, b similarPhoto) float64 {
	return sharedCount(a.bulk.tags, b.bulk.tags)*tagWeight +
		sharedCount(a.bulk.genres, b.bulk.genres)*genreWeight +
		sharedCount(a.bulk.albums, b.bulk.albums)*albumWeight +
		placeScore(a.bulk, b.bulk) +
		sameDayScore(a.bulk, b.bulk) +
		colorOverlap(a.colors, b.colors)*colorWeight
}

// sharedCount is how many IDs a and b both have.
func sharedCount(a, b []string) float64 {
	return float64(len(shared(a, b)))
}

// placeScore is the score for being taken in the same city, or else the same
// country. Two unknown places aren't the same.
func placeScore(a, b bulkPhoto) float64 {
	if a.city != "" && a.city == b.city {
		return cityWeight
	}
	if a.country != "" && a.country == b.country {
		return countryWeight
	}
	return 0
}

// sameDayScore is the score for being taken on the same calendar day.
func sameDayScore(a, b bulkPhoto) float64 {
	if day(a.date) != "" && day(a.date) == day(b.date) {
		return dayWeight
	}
	return 0
}

// day is the "2016:12:16" of a date like "2016:12:16 09:27:41", or "".
func day(date string) string {
	d, _, _ := strings.Cut(date, " ")
	return d
}

// exifDate is how EXIF writes when a photo was taken, such as
// "2016:12:16 09:27:41".
const exifDate = "2006:01:02 15:04:05"

// timeApart is how far apart two photos were taken, or 0 when either date
// can't be read, so those tie.
func timeApart(a, b similarPhoto) time.Duration {
	at, aerr := time.Parse(exifDate, a.bulk.date)
	bt, berr := time.Parse(exifDate, b.bulk.date)
	if aerr != nil || berr != nil {
		return 0
	}
	return max(at.Sub(bt), bt.Sub(at))
}

// colorOverlap is how much of the two photos is the same colors, from 0 to
// 1: for each color, the smaller of the two photos' shares, added up.
func colorOverlap(a, b map[string]float64) float64 {
	sum := 0.0
	for color, share := range a {
		sum += min(share, b[color])
	}
	return sum
}

// setIDList is content with key set to ids, written on one line as Publish
// writes a list of numbers.
func setIDList(content []byte, key string, ids []int) ([]byte, error) {
	value, _ := json.Marshal(ids)
	return setTopLevelList(content, key, value)
}

// PickedSimilar is the photos picked by hand to show first in one photo's
// More like this drawer, by ID, in order.
type PickedSimilar struct {
	Path string `json:"path"`
	IDs  []int  `json:"ids"`
	// Notes is the note to show beside each picked photo, by its ID, such
	// as "The same alley at night". A picked photo may have none.
	Notes map[string]string `json:"notes"`
}

// maxPickNote is the longest note a picked photo can have, in characters.
const maxPickNote = 280

// PickedSimilarResult says where the picks were saved: in the pending
// changes, for the next Commit.
type PickedSimilarResult struct {
	pendingSave
}

// SetPickedSimilar saves picked.IDs as the photo file's "pickedSimilar", and
// picked.Notes as its "pickedSimilarNotes", in the pending changes. Each ID
// must be another photo's, listed once, and there can be up to similarCount
// of them. Notes are trimmed, and empty ones and ones for photos that aren't
// picked are left out.
func (c *Client) SetPickedSimilar(ctx context.Context, gh settings.GitHub, picked PickedSimilar) (PickedSimilarResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return PickedSimilarResult{}, perr
	}
	photos := readableSimilar(scan.files)
	i := slices.IndexFunc(photos, func(p similarPhoto) bool { return p.file.path == picked.Path })
	if i < 0 {
		return PickedSimilarResult{}, publishErr(http.StatusNotFound, "%s isn't a photo file with an ID on %s.", picked.Path, scan.branch)
	}
	if len(picked.IDs) > similarCount {
		return PickedSimilarResult{}, publishErr(http.StatusBadRequest, "Pick up to %d photos, as many as the drawer shows.", similarCount)
	}
	if perr := checkPicks(photos[i].id, picked.IDs, photos); perr != nil {
		return PickedSimilarResult{}, perr
	}
	notes, perr := pickNotes(picked)
	if perr != nil {
		return PickedSimilarResult{}, perr
	}
	content, err := setIDList(photos[i].file.content, pickedSimilarKey, append([]int{}, picked.IDs...))
	if err == nil {
		content, err = setTopLevelList(content, pickedNotesKey, notes)
	}
	if err != nil {
		return PickedSimilarResult{}, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", picked.Path, err)
	}
	if bytes.Equal(content, photos[i].file.content) {
		return PickedSimilarResult{}, publishErr(http.StatusConflict, "Those picks are already saved, so there's nothing to change.")
	}
	saved, perr := c.saveScan(scan, []map[string]string{{"path": picked.Path, "content": string(content)}})
	if perr != nil {
		return PickedSimilarResult{}, perr
	}
	return PickedSimilarResult{pendingSave: saved}, nil
}

// checkPicks checks that each of ids is another photo's, listed once.
func checkPicks(self int, ids []int, photos []similarPhoto) *PublishError {
	seen := map[int]bool{}
	for _, id := range ids {
		switch {
		case id == self:
			return publishErr(http.StatusBadRequest, "A photo can't be picked as like itself.")
		case seen[id]:
			return publishErr(http.StatusBadRequest, "Photo %d is picked more than once.", id)
		case !slices.ContainsFunc(photos, func(p similarPhoto) bool { return p.id == id }):
			return publishErr(http.StatusBadRequest, "There's no photo with the ID %d, so nothing was changed.", id)
		}
		seen[id] = true
	}
	return nil
}

// pickNotes is picked's notes as the JSON object to save, trimmed, keeping
// only the non-empty ones for picked photos.
func pickNotes(picked PickedSimilar) ([]byte, *PublishError) {
	out := map[string]string{}
	for _, id := range picked.IDs {
		key := strconv.Itoa(id)
		note := strings.TrimSpace(picked.Notes[key])
		if utf8.RuneCountInString(note) > maxPickNote {
			return nil, publishErr(http.StatusBadRequest, "The note for photo %d is longer than %d characters.", id, maxPickNote)
		}
		if note != "" {
			out[key] = note
		}
	}
	b, _ := json.Marshal(out)
	return b, nil
}
