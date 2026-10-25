package github

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// ColorsField is where a photo file keeps its color summary (colors.Summary):
// its average color, hue buckets, neutrals, mean lightness and chroma, as
// the EXIF page's Colors tab shows them.
const ColorsField = "colors"

// ColorReader returns the color summary of the original photo at key in R2,
// or a message fit to show saying why it couldn't.
type ColorReader func(ctx context.Context, key string) (colors.Summary, string)

// ColorFile is a photo file Colors gives a color summary to.
type ColorFile struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	// Replaces is true when the file already has colors, which recomputing
	// replaces.
	Replaces bool `json:"replaces"`
	// Colors is the photo's color summary; nil when Error says why it
	// couldn't be read, and the file is left as it is.
	Colors *colors.Summary `json:"colors"`
	Error  string          `json:"error,omitempty"`
}

// ColorsPreview is what adding color data would do to the photo files on
// Branch.
type ColorsPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// HaveColors is how many photo files already have colors, counting
	// only those saved with every field colors.Summary has now.
	HaveColors int `json:"haveColors"`
	// Recompute is true when files that have colors get them again.
	Recompute  bool                `json:"recompute"`
	Files      []ColorFile         `json:"files"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// ColorsResult says where the color data was saved: in the pending changes,
// for the next Commit.
type ColorsResult struct {
	pendingSave
	Files int `json:"files"`
	// Failed is how many photos' colors couldn't be read, so their files
	// were left as they are.
	Failed int `json:"failed"`
}

// PreviewColors reads every photo JSON file, as PreviewBaseURL does, and
// reads the colors of each photo without them, or of every photo with
// recompute, from its original in R2 at images.key. It only reads.
func (c *Client) PreviewColors(ctx context.Context, gh settings.GitHub, read ColorReader, recompute bool) (ColorsPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return ColorsPreview{}, perr
	}
	preview := ColorsPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch, Recompute: recompute,
		Files: []ColorFile{}, Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	for _, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		preview.PhotoFiles++
		if hasCurrentColors(f.content) {
			preview.HaveColors++
		}
	}
	for _, file := range readColors(ctx, scan, read, recompute) {
		if file != nil {
			preview.Files = append(preview.Files, *file)
		}
	}
	return preview, nil
}

// WriteColors saves the colors PreviewColors reads as each file's "colors",
// in the pending changes, leaving the rest of each file byte for byte. A
// photo whose colors can't be read is left as it is. Nothing is saved when
// any photo file can't be read.
func (c *Client) WriteColors(ctx context.Context, gh settings.GitHub, read ColorReader, recompute bool) (ColorsResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return ColorsResult{}, perr
	}
	for _, f := range scan.files {
		if f.err != "" {
			return ColorsResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
	}
	var entries []map[string]string
	result := ColorsResult{}
	for i, file := range readColors(ctx, scan, read, recompute) {
		if file == nil {
			continue
		}
		if file.Colors == nil {
			result.Failed++
			continue
		}
		content, err := withColors(scan.files[i].content, *file.Colors)
		if err != nil {
			return ColorsResult{}, publishErr(http.StatusConflict, "%s couldn't be changed: %v.", file.Path, err)
		}
		entries = append(entries, map[string]string{"path": file.Path, "content": string(content)})
		result.Files++
	}
	if len(entries) == 0 {
		return ColorsResult{}, noColorsErr(result.Failed)
	}
	if result.pendingSave, perr = c.saveScan(scan, entries); perr != nil {
		return ColorsResult{}, perr
	}
	return result, nil
}

// noColorsErr says why WriteColors had nothing to save.
func noColorsErr(failed int) *PublishError {
	if failed > 0 {
		return publishErr(http.StatusBadGateway, "None of the photos' colors could be read from R2, so nothing was changed.")
	}
	return publishErr(http.StatusConflict, "Every photo file already has colors, so there's nothing to add.")
}

// readColors reads the colors of each readable file of scan that needs them
// (any without colors, or saved before peakChroma was added, or every file
// with recompute), a few at a time. Each entry lines up with scan.files, nil for a file that's
// left out.
func readColors(ctx context.Context, scan baseURLScan, read ColorReader, recompute bool) []*ColorFile {
	files := make([]*ColorFile, len(scan.files))
	var reads []func()
	for i, f := range scan.files {
		if f.err != "" || (hasCurrentColors(f.content) && !recompute) {
			continue
		}
		file := &ColorFile{Path: f.path, FileURL: f.fileURL, Replaces: hasColors(f.content)}
		files[i] = file
		key := imageKey(f.content)
		if key == "" {
			file.Error = "It has no images.key, so its original can't be found in R2."
			continue
		}
		reads = append(reads, func() {
			analysis, msg := read(ctx, key)
			if msg != "" {
				file.Error = msg
				return
			}
			file.Colors = &analysis
		})
	}
	readOriginals(ctx, reads)
	return files
}

// hasColors reports whether a photo file has colors that aren't null.
func hasColors(content []byte) bool {
	var photo struct {
		Colors json.RawMessage `json:"colors"`
	}
	return json.Unmarshal(content, &photo) == nil && !isEmptyJSON(photo.Colors)
}

// hasCurrentColors reports whether a photo file has colors saved with
// peakChroma, the newest field of colors.Summary, so they needn't be read
// again.
func hasCurrentColors(content []byte) bool {
	var photo struct {
		Colors *struct {
			PeakChroma *float64 `json:"peakChroma"`
		} `json:"colors"`
	}
	return json.Unmarshal(content, &photo) == nil && photo.Colors != nil && photo.Colors.PeakChroma != nil
}

// withColors is content with its "colors" set to analysis.
func withColors(content []byte, analysis colors.Summary) ([]byte, error) {
	value, err := json.Marshal(analysis)
	if err != nil {
		return nil, err
	}
	return setField(content, ColorsField, value)
}
