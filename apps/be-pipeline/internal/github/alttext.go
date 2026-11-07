package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PhotoAltTextKey is the photo file field that holds the photo's alt text:
// a short description of what it shows, which the portfolio gives its images
// for screen readers and for when they don't load.
const PhotoAltTextKey = "altText"

// maxAltTextLength is the most characters a photo's alt text can have. Alt
// text should be a sentence or two; this only stops a whole essay.
const maxAltTextLength = 1000

// AltTextPick is the photos without alt text that the Alt Text page picked to
// ask an LLM about together.
type AltTextPick struct {
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// WithoutAltText is how many photo files have no alt text.
	WithoutAltText int `json:"withoutAltText"`
	// Photos are as Bulk Tagging picks them, with nothing in Related.
	Photos []BulkTagPhoto `json:"photos"`
}

// PickAltTextPhotos picks up to count photos without alt text (1 to 50, 50
// when unset), in file name order, from the photo files as the next Commit
// will have them, leaving out skip's paths. It only reads.
func (c *Client) PickAltTextPhotos(ctx context.Context, gh settings.GitHub, skip []string, count int) (AltTextPick, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AltTextPick{}, perr
	}
	photos, without := photosWhere(scan, skip, func(p bulkPhoto) bool { return photoAltText(p.file.content) == "" })
	if len(photos) == 0 {
		return AltTextPick{}, publishErr(http.StatusNotFound, "There are no more photos without alt text to pick from. Start over to pick from every one again.")
	}
	return AltTextPick{
		Branch: scan.branch, PullRequest: scanPullRequest(scan), PhotoFiles: len(scan.files),
		WithoutAltText: without, Photos: pickFirst(photos, genreCount(count)),
	}, nil
}

// scanPullRequest is the open photo data pull request scan read, or nil when
// none is open.
func scanPullRequest(scan baseURLScan) *BaseURLPullRequest {
	if scan.pr == nil {
		return nil
	}
	return &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
}

// photoAltText is the alt text in content, a photo file, trimmed, or "" when
// it has none.
func photoAltText(content []byte) string {
	var data struct {
		AltText *string `json:"altText"`
	}
	_ = json.Unmarshal(content, &data)
	return firstText(data.AltText)
}

// altTextAnswer is the JSON the Alt Text prompt asks the LLM for.
type altTextAnswer struct {
	Photos []struct {
		// Photo is the photo's name, as the prompt lists it.
		Photo   string `json:"photo"`
		AltText string `json:"altText"`
	} `json:"photos"`
}

// names is the photo names the answer lists, as it wrote them.
func (a altTextAnswer) names() []string {
	out := make([]string, 0, len(a.Photos))
	for _, p := range a.Photos {
		out = append(out, p.Photo)
	}
	return out
}

// textFor is the answer's alt text for the photo named name, trimmed, or ""
// when it has none.
func (a altTextAnswer) textFor(name string) string {
	for _, p := range a.Photos {
		if strings.TrimSpace(p.Photo) == name && strings.TrimSpace(p.AltText) != "" {
			return strings.TrimSpace(p.AltText)
		}
	}
	return ""
}

// AltTextSuggestion is the alt text the answer gives one picked photo.
type AltTextSuggestion struct {
	Path string `json:"path"`
	// Name is the file's name without ".json", as the prompt calls it.
	Name string `json:"name"`
	// AltText is the answer's alt text for it; "" when the answer has none.
	AltText string `json:"altText"`
	// Current is the alt text the photo has already; "" when it has none.
	Current string `json:"current"`
}

// AltTextPreview is what pasting the LLM's answer would do: the alt text each
// picked photo gets.
type AltTextPreview struct {
	Photos []AltTextSuggestion `json:"photos"`
	// Unknown is the photos in the answer that aren't any of the picked ones.
	Unknown []string `json:"unknown"`
}

// PreviewAltText reads answer, the LLM's JSON for the photos at paths (as
// PickAltTextPhotos picked them), and says the alt text each would get. It
// only reads.
func (c *Client) PreviewAltText(ctx context.Context, gh settings.GitHub, paths []string, answer string) (AltTextPreview, error) {
	var parsed altTextAnswer
	if perr := parseLLMAnswer(answer, &parsed); perr != nil {
		return AltTextPreview{}, perr
	}
	if len(parsed.Photos) == 0 {
		return AltTextPreview{}, publishErr(http.StatusBadRequest, "The answer has no photos in it. Ask the LLM to answer with alt text for each photo.")
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AltTextPreview{}, perr
	}
	photos, perr := picked(scan, paths)
	if perr != nil {
		return AltTextPreview{}, perr
	}
	preview := AltTextPreview{Photos: []AltTextSuggestion{}, Unknown: unknownPhotos(photos, parsed.names())}
	for _, p := range photos {
		preview.Photos = append(preview.Photos, AltTextSuggestion{
			Path: p.file.path, Name: p.name, AltText: parsed.textFor(p.name), Current: photoAltText(p.file.content),
		})
	}
	return preview, nil
}

// AltTextPhoto is the alt text to give one photo file.
type AltTextPhoto struct {
	Path    string `json:"path"`
	AltText string `json:"altText"`
}

// AltTexts is what the Alt Text page saves, as the review left it: the alt
// text for each photo.
type AltTexts struct {
	Photos []AltTextPhoto `json:"photos"`
}

// AltTextResult says where the Alt Text page's changes were saved: in the
// pending changes, for the next Commit.
type AltTextResult struct {
	pendingSave
	// Photos is how many photo files got new alt text; the others already
	// had that alt text.
	Photos int `json:"photos"`
}

// ApplyAltText writes each photo's alt text into its file, all as one save in
// the pending changes. Nothing is saved when a photo can't be read or its alt
// text is empty or too long.
func (c *Client) ApplyAltText(ctx context.Context, gh settings.GitHub, req AltTexts) (AltTextResult, error) {
	if len(req.Photos) == 0 || len(req.Photos) > maxBulkTagPhotos {
		return AltTextResult{}, publishErr(http.StatusBadRequest, "Save alt text for 1 to %d photos at a time.", maxBulkTagPhotos)
	}
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return AltTextResult{}, perr
	}
	changes, perr := altTextChanges(scan, req.Photos)
	if perr != nil {
		return AltTextResult{}, perr
	}
	if len(changes) == 0 {
		return AltTextResult{}, publishErr(http.StatusConflict, "Those photos already have that alt text, so there's nothing to change.")
	}
	saved, perr := c.saveFiles(scan.w, changes)
	if perr != nil {
		return AltTextResult{}, perr
	}
	return AltTextResult{pendingSave: saved, Photos: len(changes)}, nil
}

// altTextChanges is each of photos' files with its alt text set, leaving out
// the ones that already have it.
func altTextChanges(scan baseURLScan, photos []AltTextPhoto) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	seen := map[string]bool{}
	for _, p := range photos {
		if seen[p.Path] {
			return nil, publishErr(http.StatusBadRequest, "%s is listed more than once.", p.Path)
		}
		seen[p.Path] = true
		change, perr := altTextChange(scan, p)
		if perr != nil {
			return nil, perr
		}
		if change != nil {
			changes = append(changes, *change)
		}
	}
	return changes, nil
}

// altTextChange is the photo file at p.Path with p.AltText as its alt text,
// or nil when it has that already.
func altTextChange(scan baseURLScan, p AltTextPhoto) (*ScanChange, *PublishError) {
	text := strings.TrimSpace(p.AltText)
	if perr := checkAltText(p.Path, text); perr != nil {
		return nil, perr
	}
	photos, perr := picked(scan, []string{p.Path})
	if perr != nil {
		return nil, perr
	}
	before := photos[0].file.content
	if photoAltText(before) == text {
		return nil, nil
	}
	after, err := setTopLevel(before, PhotoAltTextKey, []byte(quoteJSON(text)))
	if err != nil {
		return nil, publishErr(http.StatusConflict, "%s: %s, so nothing was changed.", p.Path, err)
	}
	return &ScanChange{Path: p.Path, Before: before, After: after}, nil
}

// checkAltText fails when text, the alt text for the photo file at path, is
// empty or longer than maxAltTextLength.
func checkAltText(path, text string) *PublishError {
	if text == "" {
		return publishErr(http.StatusBadRequest, "%s has no alt text. Write some or untick it, so nothing was changed.", path)
	}
	if n := len([]rune(text)); n > maxAltTextLength {
		return publishErr(http.StatusBadRequest, "%s's alt text is %d characters, more than %d. Shorten it, so nothing was changed.", path, n, maxAltTextLength)
	}
	return nil
}

// unknownPhotos is the names in an answer that aren't any of photos.
func unknownPhotos(photos []bulkPhoto, names []string) []string {
	out := []string{}
	for _, name := range names {
		if !slices.ContainsFunc(photos, func(p bulkPhoto) bool { return p.name == strings.TrimSpace(name) }) {
			out = append(out, name)
		}
	}
	return out
}
