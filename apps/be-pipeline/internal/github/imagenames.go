package github

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// ImageRename is a photo whose image moves in R2 to keys named after its
// title, such as photos/59124cb186a8-dsc0001.jpg to
// photos/59124cb186a8-amsterdam-canal.jpg.
type ImageRename struct {
	Path    string `json:"path"`
	FileURL string `json:"fileUrl"`
	Title   string `json:"title"`
	// From and To are the original's key now and after.
	From string `json:"from"`
	To   string `json:"to"`
	// Changes are the image URLs and key the rename rewrites in the photo's
	// JSON, each under "images".
	Changes []FieldChange `json:"changes"`
}

// ImageNamesPreview is what naming the photos' images in R2 after their
// titles would do to the photo files on Branch.
type ImageNamesPreview struct {
	Repo   string `json:"repo"`
	Folder string `json:"folder"`
	// Branch and PullRequest are as in BaseURLPreview.
	Branch      string              `json:"branch"`
	PullRequest *BaseURLPullRequest `json:"pullRequest"`
	PhotoFiles  int                 `json:"photoFiles"`
	// Named is how many photos' images are already named after their titles.
	Named int `json:"named"`
	// Untitled is how many photos have no title, or one without any letters
	// or numbers to name the image by, so they keep their names.
	Untitled int `json:"untitled"`
	// Elsewhere is how many photos' images weren't uploaded by the pipeline,
	// so they can't be renamed.
	Elsewhere  int                 `json:"elsewhere"`
	Files      []ImageRename       `json:"files"`
	Unreadable []BaseURLUnreadable `json:"unreadable"`
}

// ImageNamesResult says where the renamed photos' files were saved: in the
// pending changes, for the next Commit.
type ImageNamesResult struct {
	pendingSave
	Files  int `json:"files"`
	Fields int `json:"fields"`
}

// ImageCopier copies the original at from and its versions to the keys named
// like to, keeping the old ones, and returns why it couldn't, or "".
// storage.CopyPhoto in production.
type ImageCopier func(ctx context.Context, from, to string) string

// PreviewImageNames reads every photo JSON file, as PreviewBaseURL does, and
// lists the photos whose images would move to keys named after their titles,
// with the image URLs that change in each. A name already used in the bucket
// by another photo, in bucketKeys, or by another photo file gets "-2", "-3",
// and so on. It only reads.
func (c *Client) PreviewImageNames(ctx context.Context, gh settings.GitHub, bucketKeys []string) (ImageNamesPreview, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return ImageNamesPreview{}, perr
	}
	preview := ImageNamesPreview{
		Repo: scan.t.repo.FullName, Folder: scan.folder, Branch: scan.branch,
		Files: []ImageRename{}, Unreadable: []BaseURLUnreadable{},
	}
	if scan.pr != nil {
		preview.PullRequest = &BaseURLPullRequest{Number: scan.pr.Number, URL: scan.pr.HTMLURL}
	}
	var readable []photoFile
	for _, f := range scan.files {
		if f.err != "" {
			preview.Unreadable = append(preview.Unreadable, BaseURLUnreadable{Path: f.path, Error: f.err})
			continue
		}
		readable = append(readable, f)
	}
	preview.PhotoFiles = len(readable)
	plan := planImageNames(readable, bucketKeys)
	preview.Named, preview.Untitled, preview.Elsewhere = plan.named, plan.untitled, plan.elsewhere
	for _, r := range plan.renames {
		preview.Files = append(preview.Files, r.rename)
	}
	return preview, nil
}

// RenameImages copies each photo PreviewImageNames lists to its new keys in
// R2 with copier, then saves its JSON with the new image URLs in the pending
// changes. The old objects stay in R2, since the portfolio shows them until
// the photo data pull request merges. Nothing is saved when any photo file
// can't be read or any photo can't be copied; the copies already made are
// harmless, and trying again copies over them.
func (c *Client) RenameImages(ctx context.Context, gh settings.GitHub, bucketKeys []string, copier ImageCopier) (ImageNamesResult, error) {
	scan, perr := c.scanPhotos(ctx, gh)
	if perr != nil {
		return ImageNamesResult{}, perr
	}
	for _, f := range scan.files {
		if f.err != "" {
			return ImageNamesResult{}, publishErr(http.StatusConflict,
				"%s couldn't be read (%s), so nothing was changed.", f.path, f.err)
		}
	}
	plan := planImageNames(scan.files, bucketKeys)
	if len(plan.renames) == 0 {
		return ImageNamesResult{}, publishErr(http.StatusConflict,
			"Every titled photo's image is already named after its title, so there's nothing to rename.")
	}
	if perr := copyImages(ctx, plan.renames, copier); perr != nil {
		return ImageNamesResult{}, perr
	}

	result := ImageNamesResult{}
	entries := make([]map[string]string, 0, len(plan.renames))
	for _, r := range plan.renames {
		entries = append(entries, map[string]string{"path": r.rename.Path, "content": string(r.content())})
		result.Files++
		result.Fields += len(r.rename.Changes)
	}
	if result.pendingSave, perr = c.saveScan(scan, entries); perr != nil {
		return ImageNamesResult{}, perr
	}
	return result, nil
}

// copyImages copies every rename's images in R2, a few at a time, and fails
// with the first that couldn't be copied.
func copyImages(ctx context.Context, renames []plannedRename, copier ImageCopier) *PublishError {
	var mu sync.Mutex
	var first *PublishError
	copies := make([]func(), 0, len(renames))
	for _, r := range renames {
		copies = append(copies, func() {
			msg := copier(ctx, r.rename.From, r.rename.To)
			mu.Lock()
			defer mu.Unlock()
			if msg != "" && first == nil {
				first = publishErr(http.StatusBadGateway,
					"Couldn't copy %s to %s in R2 (%s), so nothing was saved. Try again: the copies already made are reused.",
					r.rename.From, r.rename.To, msg)
			}
		})
	}
	readOriginals(ctx, copies)
	return first
}

// plannedRename is one photo's rename, with what it needs to rewrite its file.
type plannedRename struct {
	rename ImageRename
	file   photoFile
	from   storage.PhotoKey
	to     storage.PhotoKey
}

// imageNamePlan is which photos' images move to which names, and why the
// others don't.
type imageNamePlan struct {
	renames                    []plannedRename
	named, untitled, elsewhere int
}

// titledPhoto is a photo file with a title and an image the pipeline uploaded.
type titledPhoto struct {
	file  photoFile
	title string
	key   storage.PhotoKey
	// stem is the name its title gives, before any "-2".
	stem string
}

// planImageNames picks each titled photo's new image name. Photos already
// named after their titles keep their names first, in path order, unless an
// earlier one kept the same name; then the rest take their title's name, or
// the first of "-2", "-3", … that no other photo uses in bucketKeys or files.
func planImageNames(files []photoFile, bucketKeys []string) imageNamePlan {
	var plan imageNamePlan
	var photos []titledPhoto
	for _, f := range files {
		p, why := titled(f)
		switch why {
		case "untitled":
			plan.untitled++
		case "elsewhere":
			plan.elsewhere++
		default:
			photos = append(photos, p)
		}
	}
	names := newStemOwners(bucketKeys, photos)
	var rest []titledPhoto
	for _, p := range photos {
		if namedAfter(p.key.Stem, p.stem) && names.keep(p.key.Stem, p.key.Hash) {
			plan.named++
			continue
		}
		rest = append(rest, p)
	}
	for _, p := range rest {
		stem := p.stem
		for i := 2; !names.claim(stem, p.key.Hash); i++ {
			stem = p.stem + "-" + strconv.Itoa(i)
		}
		if r, ok := renamePhoto(p, stem); ok {
			plan.renames = append(plan.renames, r)
		}
	}
	return plan
}

// namedAfter reports whether stem is titleStem, or titleStem with a "-2",
// "-3", … PlanImageNames gave it.
func namedAfter(stem, titleStem string) bool {
	if stem == titleStem {
		return true
	}
	n, ok := strings.CutPrefix(stem, titleStem+"-")
	_, err := strconv.Atoi(n)
	return ok && err == nil && !strings.HasPrefix(n, "0")
}

// stemOwners is which photos, by hash, use each name stem in the bucket or
// the photo files, and which one each name was given to.
type stemOwners struct {
	used    map[string]map[string]bool
	claimed map[string]string
}

func newStemOwners(bucketKeys []string, photos []titledPhoto) stemOwners {
	o := stemOwners{used: map[string]map[string]bool{}, claimed: map[string]string{}}
	add := func(k storage.PhotoKey) {
		if o.used[k.Stem] == nil {
			o.used[k.Stem] = map[string]bool{}
		}
		o.used[k.Stem][k.Hash] = true
	}
	for _, key := range bucketKeys {
		if k, ok := storage.ParsePhotoKey(key); ok {
			add(k)
		}
	}
	for _, p := range photos {
		add(p.key)
	}
	return o
}

// keep gives stem to the photo with hash, which already has it, and reports
// false when an earlier photo kept it.
func (o stemOwners) keep(stem, hash string) bool {
	if owner, ok := o.claimed[stem]; ok {
		return owner == hash
	}
	o.claimed[stem] = hash
	return true
}

// claim gives stem to the photo with hash, and reports false when another
// photo uses it or was given it.
func (o stemOwners) claim(stem, hash string) bool {
	if owner, ok := o.claimed[stem]; ok {
		return owner == hash
	}
	for other := range o.used[stem] {
		if other != hash {
			return false
		}
	}
	o.claimed[stem] = hash
	return true
}

// photoKeyInURL finds an original's key in an image URL.
var photoKeyInURL = regexp.MustCompile(`photos/[0-9a-f]{12}(?:-[a-z0-9-]+)?\.jpg(?:$|[?#])`)

// titled reads f's title and its original's key, or says why it has none to
// rename: "untitled" or "elsewhere".
func titled(f photoFile) (titledPhoto, string) {
	var fields struct {
		Title  *string        `json:"title"`
		Images map[string]any `json:"images"`
	}
	_ = json.Unmarshal(f.content, &fields)
	p := titledPhoto{file: f}
	if fields.Title != nil {
		p.title = strings.TrimSpace(*fields.Title)
		p.stem = storage.TitleStem(p.title)
	}
	if p.stem == "" {
		return p, "untitled"
	}
	key, ok := originalKey(fields.Images)
	if !ok {
		return p, "elsewhere"
	}
	p.key = key
	return p, ""
}

// originalKey is the original's key from a photo's "images": its "key", or
// else the one in its "full" URL.
func originalKey(images map[string]any) (storage.PhotoKey, bool) {
	if key, _ := images["key"].(string); key != "" {
		return storage.ParsePhotoKey(key)
	}
	full, _ := images["full"].(string)
	m := photoKeyInURL.FindString(full)
	return storage.ParsePhotoKey(strings.TrimRight(m, "?#"))
}

// renamePhoto is p's rename to stem, with the image URLs it rewrites, or
// false when none of them change.
func renamePhoto(p titledPhoto, stem string) (plannedRename, bool) {
	to := storage.PhotoKey{Hash: p.key.Hash, Stem: stem}
	r := plannedRename{file: p.file, from: p.key, to: to, rename: ImageRename{
		Path: p.file.path, FileURL: p.file.fileURL, Title: p.title, From: p.key.Key(), To: to.Key(),
	}}
	for _, l := range p.file.leaves {
		if moved, ok := renamedImage(l.value, p.key, to); ok {
			r.rename.Changes = append(r.rename.Changes, FieldChange{Field: l.field, From: jsonString(l.value), To: jsonString(moved)})
		}
	}
	return r, len(r.rename.Changes) > 0
}

// renamedImage returns the image URL or key u with the original's name moved
// from from to to, keeping its version suffix, query and fragment, and false
// when u isn't one of that original's images.
func renamedImage(u string, from, to storage.PhotoKey) (string, bool) {
	old := strings.TrimSuffix(from.Key(), ".jpg")
	pattern := regexp.MustCompile(`(^|/)` + regexp.QuoteMeta(old) + `(\.jpg|-[a-z]+\.webp)($|[?#])`)
	loc := pattern.FindStringSubmatchIndex(u)
	if loc == nil {
		return "", false
	}
	// loc[2]:loc[3] is the "/" before the key, if any; the key starts after it.
	start := loc[3]
	return u[:start] + strings.TrimSuffix(to.Key(), ".jpg") + u[start+len(old):], true
}

// content is the photo's file with each image the rename moves rewritten,
// leaving every other byte as it was.
func (r plannedRename) content() []byte {
	var out bytes.Buffer
	last := 0
	for _, l := range r.file.leaves {
		moved, ok := renamedImage(l.value, r.from, r.to)
		if !ok {
			continue
		}
		out.Write(r.file.content[last:l.start])
		out.WriteByte('"')
		out.Write(jsonStringBody(moved))
		out.WriteByte('"')
		last = l.end
	}
	out.Write(r.file.content[last:])
	return out.Bytes()
}

// jsonString is s as a JSON string.
func jsonString(s string) json.RawMessage {
	b, _ := json.Marshal(s)
	return b
}
