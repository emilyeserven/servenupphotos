package github

import (
	"context"
	"encoding/json"
	"net/http"
	"path"
	"strings"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/phash"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// PerceptualHashField is where a photo file keeps its perceptual hash (see
// package phash), as 16 hex digits, read from its Small version.
const PerceptualHashField = "perceptualHash"

// CompareGroupField is where a photo file names the compare group it's in, as
// the Compare page sets it.
const CompareGroupField = "compareGroup"

// HashReader returns the perceptual hash of the image at smallURL, a photo's
// Small version in R2, or a message fit to show saying why it couldn't.
type HashReader func(ctx context.Context, smallURL string) (string, string)

// nearPhoto is a photo file that can be found as a near duplicate.
type nearPhoto struct {
	path    string
	content []byte
	// hash is the photo's perceptual hash; hashed is false while it has none.
	hash   uint64
	hashed bool
	// group is the compare group it's in, or "" for none.
	group string
	// name is its title, or else its original file name.
	name string
}

// nearFields is the part of a photo file nearPhoto reads.
type nearFields struct {
	Title          *string         `json:"title"`
	File           string          `json:"file"`
	PerceptualHash *string         `json:"perceptualHash"`
	CompareGroup   *string         `json:"compareGroup"`
	Unselected     json.RawMessage `json:"unselected"`
	Images         struct {
		Full  *string `json:"full"`
		Small *string `json:"small"`
	} `json:"images"`
}

func readNearFields(content []byte) (nearFields, bool) {
	var f nearFields
	return f, json.Unmarshal(content, &f) == nil
}

// newNearPhoto is the photo file at p with content as a nearPhoto, or false
// for one that can't be read or was left out of a compare group as
// unselected, since its images may be gone.
func newNearPhoto(p string, content []byte) (nearPhoto, bool) {
	f, ok := readNearFields(content)
	if !ok || isUnselected(content) {
		return nearPhoto{}, false
	}
	photo := nearPhoto{path: p, content: content, group: trimmed(f.CompareGroup), name: trimmed(f.Title)}
	if photo.name == "" {
		photo.name = strings.TrimSpace(f.File)
	}
	photo.hash, photo.hashed = phash.Parse(trimmed(f.PerceptualHash))
	return photo, true
}

func trimmed(s *string) string {
	if s == nil {
		return ""
	}
	return strings.TrimSpace(*s)
}

// nearPhotos is every photo file in folder in w that can be a near
// duplicate, in path order, leaving out the one at except.
func (w *workspace) nearPhotos(folder, except string) []nearPhoto {
	var out []nearPhoto
	for _, p := range w.paths(folder, AllPhotosFile) {
		if p == except || skippedDataFiles[strings.ToLower(path.Base(p))] || w.readErr(p) != "" {
			continue
		}
		content, _ := w.file(p)
		if photo, ok := newNearPhoto(p, content); ok {
			out = append(out, photo)
		}
	}
	return out
}

// isNear reports whether a and b both have hashes that differ by at most
// phash.Near bits.
func isNear(a, b nearPhoto) bool {
	return a.hashed && b.hashed && phash.Distance(a.hash, b.hash) <= phash.Near
}

// groupName is the compare group near duplicates go in: the first group one
// of them is in already, or else a new one named after the first of them.
func groupName(photos []nearPhoto) string {
	for _, p := range photos {
		if p.group != "" {
			return p.group
		}
	}
	return "Near duplicates of " + photos[0].name
}

// joinGroup is the changes putting each of photos that isn't in a compare
// group into the one called name. Photos already in another group are left
// in it, so a group being compared never loses a photo.
func joinGroup(photos []nearPhoto, name string) ([]ScanChange, *PublishError) {
	value, _ := json.Marshal(name)
	var changes []ScanChange
	for _, p := range photos {
		if p.group != "" {
			continue
		}
		after, err := setField(p.content, CompareGroupField, value)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s couldn't be put in a compare group: %v.", p.path, err)
		}
		changes = append(changes, ScanChange{Path: p.path, Before: p.content, After: after})
	}
	return changes, nil
}

// NearDuplicates is the compare group a newly saved photo went in with the
// photos it looks nearly the same as.
type NearDuplicates struct {
	// Group is the compare group's name.
	Group string `json:"group"`
	// Paths are the photo files it looks like.
	Paths []string `json:"paths"`
}

// withNearDuplicates puts the new photo at p, with content, in a compare
// group with every photo in w it looks nearly the same as, when there are
// any. It returns the new photo's content, the other files it changed, and
// the group.
func (w *workspace) withNearDuplicates(folder, p string, content []byte) ([]byte, []ScanChange, *NearDuplicates, *PublishError) {
	photo, ok := newNearPhoto(p, content)
	if !ok || !photo.hashed {
		return content, nil, nil, nil
	}
	var near []nearPhoto
	for _, other := range w.nearPhotos(folder, p) {
		if isNear(photo, other) {
			near = append(near, other)
		}
	}
	if len(near) == 0 {
		return content, nil, nil, nil
	}
	name := groupName(near)
	changes, perr := joinGroup(append(near, photo), name)
	if perr != nil {
		return nil, nil, nil, perr
	}
	found := &NearDuplicates{Group: name}
	for _, n := range near {
		found.Paths = append(found.Paths, n.path)
	}
	last := changes[len(changes)-1]
	return last.After, changes[:len(changes)-1], found, nil
}

// NearDuplicatesResult is what finding near duplicates saved, in the pending
// changes.
type NearDuplicatesResult struct {
	pendingSave
	// Photos is how many photo files were looked through.
	Photos int `json:"photos"`
	// Hashed is how many got a perceptual hash, and HashFailed how many
	// couldn't, such as one without a Small version in R2.
	Hashed     int `json:"hashed"`
	HashFailed int `json:"hashFailed"`
	// Groups are the compare groups near duplicates were put in, each with
	// the photo files it has now.
	Groups []NearDuplicates `json:"groups"`
}

// FindNearDuplicates gives every photo file without a perceptual hash one,
// read by read from its Small version, then puts each set of photos that
// look nearly the same into a compare group, as changes waiting for Commit.
// Photos that are unselected are left out, and a photo already in a compare
// group stays in it.
func (c *Client) FindNearDuplicates(ctx context.Context, gh settings.GitHub, read HashReader) (NearDuplicatesResult, error) {
	folder, perr := photoFolder(gh.Folder)
	if perr != nil {
		return NearDuplicatesResult{}, perr
	}
	reportProgress(ctx, ProgressGitHub, 0, 0)
	w, perr := c.workspace(ctx, gh)
	if perr != nil {
		return NearDuplicatesResult{}, perr
	}
	photos := w.nearPhotos(folder, "")
	result := NearDuplicatesResult{Photos: len(photos), Groups: []NearDuplicates{}}
	changed, perr := hashPhotos(ctx, photos, read, &result)
	if perr != nil {
		return NearDuplicatesResult{}, perr
	}
	grouped, perr := groupNearDuplicates(photos, &result)
	if perr != nil {
		return NearDuplicatesResult{}, perr
	}
	if result.pendingSave, perr = c.saveFiles(w, mergeChanges(changed, grouped)); perr != nil {
		return NearDuplicatesResult{}, perr
	}
	return result, nil
}

// hashPhotos reads the hash of each of photos without one, a few at a time,
// and returns the changes saving them. photos get their hashes too.
func hashPhotos(ctx context.Context, photos []nearPhoto, read HashReader, result *NearDuplicatesResult) ([]ScanChange, *PublishError) {
	hashes := make([]string, len(photos))
	var reads []func()
	for i := range photos {
		if photos[i].hashed {
			continue
		}
		small := smallURL(photos[i].content)
		reads = append(reads, func() {
			if small != "" {
				hashes[i], _ = read(ctx, small)
			}
		})
	}
	readOriginals(ctx, reads)
	return applyHashes(photos, hashes, result)
}

// applyHashes sets each hash read on its photo and its content.
func applyHashes(photos []nearPhoto, hashes []string, result *NearDuplicatesResult) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for i, h := range hashes {
		if photos[i].hashed {
			continue
		}
		hash, ok := phash.Parse(h)
		if !ok {
			result.HashFailed++
			continue
		}
		value, _ := json.Marshal(h)
		after, err := setField(photos[i].content, PerceptualHashField, value)
		if err != nil {
			return nil, publishErr(http.StatusConflict, "%s couldn't be changed: %v.", photos[i].path, err)
		}
		changes = append(changes, ScanChange{Path: photos[i].path, Before: photos[i].content, After: after})
		photos[i].content, photos[i].hash, photos[i].hashed = after, hash, true
		result.Hashed++
	}
	return changes, nil
}

// groupNearDuplicates puts each set of photos that look nearly the same, by
// way of each other, in a compare group, and returns the changes.
func groupNearDuplicates(photos []nearPhoto, result *NearDuplicatesResult) ([]ScanChange, *PublishError) {
	var changes []ScanChange
	for _, set := range nearSets(photos) {
		name := groupName(set)
		joined, perr := joinGroup(set, name)
		if perr != nil {
			return nil, perr
		}
		if len(joined) == 0 {
			continue
		}
		changes = append(changes, joined...)
		result.Groups = append(result.Groups, NearDuplicates{Group: name, Paths: groupPaths(set, name)})
	}
	return changes, nil
}

// groupPaths are the paths of the photos in set that are in the group called
// name once it's joined.
func groupPaths(set []nearPhoto, name string) []string {
	var paths []string
	for _, p := range set {
		if p.group == "" || p.group == name {
			paths = append(paths, p.path)
		}
	}
	return paths
}

// nearSets are the sets of two or more photos linked by looking nearly the
// same, each photo with the next or by way of others, in path order.
func nearSets(photos []nearPhoto) [][]nearPhoto {
	parent := make([]int, len(photos))
	for i := range parent {
		parent[i] = i
	}
	root := func(i int) int {
		for parent[i] != i {
			parent[i] = parent[parent[i]]
			i = parent[i]
		}
		return i
	}
	for i := range photos {
		for j := i + 1; j < len(photos); j++ {
			if isNear(photos[i], photos[j]) {
				parent[root(j)] = root(i)
			}
		}
	}
	return setsOf(photos, root)
}

// setsOf groups photos by root, keeping the groups of two or more.
func setsOf(photos []nearPhoto, root func(int) int) [][]nearPhoto {
	byRoot := map[int][]nearPhoto{}
	var order []int
	for i, p := range photos {
		r := root(i)
		if len(byRoot[r]) == 0 {
			order = append(order, r)
		}
		byRoot[r] = append(byRoot[r], p)
	}
	var sets [][]nearPhoto
	for _, r := range order {
		if len(byRoot[r]) > 1 {
			sets = append(sets, byRoot[r])
		}
	}
	return sets
}

// mergeChanges is hashed with each file grouped changes again replaced by
// its grouped change, which was made over the hashed content, so each file
// is saved once.
func mergeChanges(hashed, grouped []ScanChange) []ScanChange {
	index := map[string]int{}
	out := append([]ScanChange{}, hashed...)
	for i, ch := range out {
		index[ch.Path] = i
	}
	for _, ch := range grouped {
		if i, ok := index[ch.Path]; ok {
			out[i].After = ch.After
			continue
		}
		out = append(out, ch)
	}
	return out
}

// smallURL is the photo file's Small version: its images.small, or else the
// one named after images.full as uploads name it, or "" without either.
func smallURL(content []byte) string {
	f, _ := readNearFields(content)
	if small := trimmed(f.Images.Small); small != "" {
		return small
	}
	full := trimmed(f.Images.Full)
	if full == "" {
		return ""
	}
	return strings.TrimSuffix(full, path.Ext(full)) + "-small.webp"
}
