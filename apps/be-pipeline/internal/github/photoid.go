package github

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"sort"
	"strings"
	"sync"
	"time"
)

// idField is the photo file field holding the photo's ID: a whole number,
// unique among the photo files, counting up from 1 in the order the files
// were created. The portfolio's links name a photo by it, such as
// /grid?photo=12.
const idField = "id"

// historyBatch is how many files one GraphQL query asks the history of. Each
// path's history is a walk back through the branch's commits, so a query of
// many can run past GitHub's time limit for one query.
const historyBatch = 25

// historyConcurrency is how many history queries run at once.
const historyConcurrency = 4

// photoID is a photo file's ID, and false when it has none.
func photoID(content []byte) (int, bool) {
	var photo struct {
		ID *json.Number `json:"id"`
	}
	if json.Unmarshal(content, &photo) != nil || photo.ID == nil {
		return 0, false
	}
	n, err := photo.ID.Int64()
	return int(n), err == nil
}

// highestID is the highest ID among the photo files in folder as the next
// Commit will have them, or 0 when none has one.
func (w *workspace) highestID(folder string) int {
	highest := 0
	for _, p := range w.paths(folder, AllPhotosFile) {
		content, _ := w.file(p)
		if id, ok := photoID(content); ok && id > highest {
			highest = id
		}
	}
	return highest
}

// nextID is the ID a new photo file in folder gets: one more than the
// highest one there.
func (w *workspace) nextID(folder string) int {
	return w.highestID(folder) + 1
}

// historyQuery asks, for each of n paths ($p0, $p1, …), the dates of the
// commits that changed it, newest first, on the commit $ref.
func historyQuery(n int) string {
	var b strings.Builder
	b.WriteString("query($owner: String!, $name: String!, $ref: String!")
	for i := range n {
		fmt.Fprintf(&b, ", $p%d: String!", i)
	}
	b.WriteString(") {\n  repository(owner: $owner, name: $name) {\n    object(expression: $ref) {\n      ... on Commit {\n")
	for i := range n {
		fmt.Fprintf(&b, "        f%d: history(path: $p%d, first: 100) { nodes { committedDate } }\n", i, i)
	}
	b.WriteString("      }\n    }\n  }\n}")
	return b.String()
}

// historyAnswer is the data of historyQuery, by alias.
type historyAnswer struct {
	Repository *struct {
		Object map[string]struct {
			Nodes []struct {
				CommittedDate time.Time `json:"committedDate"`
			} `json:"nodes"`
		} `json:"object"`
	} `json:"repository"`
}

// committedTimes asks GitHub when each of paths was first committed, as far
// back as the history of the next Commit's branch goes. A path without
// commits there is left out. A file's first commit never changes, so each
// answer is kept (see firstCommits) and only paths not asked before are
// asked, a few batches at once: Update Data's preview pays for them, and
// applying it doesn't.
func (c *Client) committedTimes(ctx context.Context, w *workspace, paths []string) (map[string]time.Time, *PublishError) {
	out, ask := c.firstCommits(w.t, paths)
	var batches [][]string
	for start := 0; start < len(ask); start += historyBatch {
		batches = append(batches, ask[start:min(start+historyBatch, len(ask))])
	}
	var mu sync.Mutex
	var failed *PublishError
	var wg sync.WaitGroup
	sem := make(chan struct{}, historyConcurrency)
	for _, batch := range batches {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			times, perr := c.historyBatch(ctx, w, batch)
			mu.Lock()
			defer mu.Unlock()
			if perr != nil {
				failed = perr
				return
			}
			maps.Copy(out, times)
		}()
	}
	wg.Wait()
	if failed != nil {
		return nil, failed
	}
	c.keepFirstCommits(w.t, out)
	return out, nil
}

// historyBatch asks GitHub, in one query, when each of paths was first
// committed on the next Commit's branch, leaving out paths without commits.
func (c *Client) historyBatch(ctx context.Context, w *workspace, paths []string) (map[string]time.Time, *PublishError) {
	vars := map[string]any{"owner": w.t.owner, "name": w.t.name, "ref": w.head.commit}
	for i, p := range paths {
		vars[fmt.Sprintf("p%d", i)] = p
	}
	var answer historyAnswer
	if perr := c.graphql(ctx, w.t, historyQuery(len(paths)), vars, &answer, "reading when the photo files were created"); perr != nil {
		return nil, perr
	}
	out := map[string]time.Time{}
	if answer.Repository == nil {
		return out, nil
	}
	for i, p := range paths {
		nodes := answer.Repository.Object[fmt.Sprintf("f%d", i)].Nodes
		if len(nodes) > 0 {
			out[p] = nodes[len(nodes)-1].CommittedDate
		}
	}
	return out, nil
}

// firstCommits returns the first commit times kept for t's paths, and the
// paths it has none for.
func (c *Client) firstCommits(t target, paths []string) (map[string]time.Time, []string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	known := map[string]time.Time{}
	var ask []string
	for _, p := range paths {
		if when, ok := c.firstCommit[repoKey(t)+"\x00"+p]; ok {
			known[p] = when
		} else {
			ask = append(ask, p)
		}
	}
	return known, ask
}

// keepFirstCommits keeps times, the first commit of each of t's paths, for
// committedTimes to reuse.
func (c *Client) keepFirstCommits(t target, times map[string]time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.firstCommit == nil {
		c.firstCommit = map[string]time.Time{}
	}
	for p, when := range times {
		c.firstCommit[repoKey(t)+"\x00"+p] = when
	}
}

// createdTimes is when each of paths was created: its first commit, or for a
// file only in the pending changes, when it was saved.
func (c *Client) createdTimes(ctx context.Context, w *workspace, paths []string) (map[string]time.Time, *PublishError) {
	var committed []string
	for _, p := range paths {
		if _, ok := w.head.files[p]; ok {
			committed = append(committed, p)
		}
	}
	times, perr := c.committedTimes(ctx, w, committed)
	if perr != nil {
		return nil, perr
	}
	for _, p := range paths {
		if _, ok := times[p]; !ok {
			times[p] = w.savedTime(p, c.now())
		}
	}
	return times, nil
}

// savedTime is when p was last saved in the pending changes, or fallback
// when it isn't there.
func (w *workspace) savedTime(p string, fallback time.Time) time.Time {
	if f, ok := w.staged[p]; ok && !f.Saved.IsZero() {
		return f.Saved
	}
	return fallback
}

// byCreation sorts paths by when they were created, oldest first, and by
// path when two were created at once, as in one commit.
func byCreation(paths []string, created map[string]time.Time) {
	sort.SliceStable(paths, func(i, j int) bool {
		a, b := created[paths[i]], created[paths[j]]
		if !a.Equal(b) {
			return a.Before(b)
		}
		return paths[i] < paths[j]
	})
}

// numberPhotos gives each plan missing an ID the next one, counting up from
// the highest ID the scanned files have, in the order the files were
// created.
func numberPhotos(scan baseURLScan, plans []backfillPlan, created map[string]time.Time) {
	gapAt := map[string]*gap{}
	var paths []string
	highest := 0
	for i, f := range scan.files {
		if id, ok := photoID(f.content); ok && id > highest {
			highest = id
		}
		if g := fieldGap(plans[i].gaps, idField); g != nil {
			gapAt[f.path] = g
			paths = append(paths, f.path)
		}
	}
	byCreation(paths, created)
	for i, p := range paths {
		g := gapAt[p]
		g.value = json.RawMessage(fmt.Sprint(highest + i + 1))
		g.numbered = true
	}
}

// datePhotos gives each plan missing addedDate the time its file was created,
// when the photo is on the portfolio. A draft's stays null, and it's dated
// when it gets a title (see stampAdded).
func datePhotos(scan baseURLScan, plans []backfillPlan, created map[string]time.Time) {
	for i, f := range scan.files {
		g := fieldGap(plans[i].gaps, addedField)
		if g == nil || !scan.w.onPortfolio(f.content) {
			continue
		}
		g.value, _ = json.Marshal(addedTime(created[f.path]))
		g.fromHistory = true
	}
}

// fieldGap is the gap for the top-level field among gaps, or nil when the
// file has it.
func fieldGap(gaps []gap, field string) *gap {
	for i := range gaps {
		if gaps[i].field == field {
			return &gaps[i]
		}
	}
	return nil
}
