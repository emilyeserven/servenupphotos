package github

import (
	"context"
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"time"
)

// snapshotTimeout bounds one read of a snapshot from GitHub, which carries on
// after the page that asked for it stops waiting (see sharedRead).
const snapshotTimeout = 3 * time.Minute

// blobsPerQuery is how many files readBlobs reads the content of in one
// GraphQL query: small enough for GitHub to answer well inside its time limit.
const blobsPerQuery = 100

// stillReading is the answer to a page that stopped waiting for a snapshot
// still being read.
func stillReading() *PublishError {
	return publishErr(http.StatusGatewayTimeout,
		"Still reading the photo data from GitHub. It carries on in the background, so try again in a minute.")
}

// sharedSnapshot is a snapshot read that's running: done closes when s or
// perr is set.
type sharedSnapshot struct {
	done chan struct{}
	s    *snapshot
	perr *PublishError
}

// sharedRead runs read for key once, however many pages ask for it together,
// and waits for it until ctx ends. The read itself carries on after that, up
// to snapshotTimeout, so a read slower than a page's time limit, such as the
// first after a merge, is kept for the next try instead of starting over.
//
// > Frontend analogy: like TanStack Query deduping one fetch across every
// > component that asks for the same key, and letting it finish into the cache
// > even after the component that started it unmounts.
func (c *Client) sharedRead(ctx context.Context, key string, read func(context.Context) (*snapshot, *PublishError)) (*snapshot, *PublishError) {
	r := c.startRead(ctx, key, read)
	select {
	case <-r.done:
		return r.s, r.perr
	case <-ctx.Done():
		return nil, stillReading()
	}
}

// startRead is the running read for key, started now when none is.
func (c *Client) startRead(ctx context.Context, key string, read func(context.Context) (*snapshot, *PublishError)) *sharedSnapshot {
	c.mu.Lock()
	defer c.mu.Unlock()
	if r, ok := c.reading[key]; ok {
		return r
	}
	if c.reading == nil {
		c.reading = map[string]*sharedSnapshot{}
	}
	r := &sharedSnapshot{done: make(chan struct{})}
	c.reading[key] = r
	go func() {
		readCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), snapshotTimeout)
		defer cancel()
		r.s, r.perr = read(readCtx)
		c.mu.Lock()
		delete(c.reading, key)
		c.mu.Unlock()
		close(r.done)
	}()
	return r
}

// knownBlobs is the content of every file in the snapshots of root kept for
// t's repository, leaving out files that couldn't be read, and of root's data
// files in the checkout, by blob SHA.
func (c *Client) knownBlobs(t target, root string) map[string][]byte {
	prefix := repoKey(t) + "\x00" + root + "\x00"
	known := c.localCopy().blobs(prefix)
	addCheckoutBlobs(known, c.Checkout, root)
	for key, s := range c.reads().allSnapshots() {
		if strings.HasPrefix(key, prefix) {
			addBlobs(known, s)
		}
	}
	return known
}

// addBlobs adds the content of s's readable files to known, by blob SHA.
func addBlobs(known map[string][]byte, s *snapshot) {
	for _, f := range s.files {
		if f.err == "" {
			known[f.sha] = f.content
		}
	}
}

// addKnown adds the files of tree, the folder at folder, to s when known has
// their content, and the rest to missing (path → blob SHA).
func addKnown(s *snapshot, folder string, tree treeAnswer, known map[string][]byte, missing map[string]string) {
	if tree == nil {
		return
	}
	for _, e := range tree.Entries {
		if e.Type != "blob" {
			continue
		}
		p := folder + "/" + e.Name
		if content, ok := known[e.OID]; ok {
			s.files[p] = snapFile{sha: e.OID, content: content}
			continue
		}
		missing[p] = e.OID
	}
}

// blobAnswer is one blob in blobsQuery's answer; nil when it isn't there.
type blobAnswer *struct {
	Text        *string `json:"text"`
	IsTruncated bool    `json:"isTruncated"`
	IsBinary    bool    `json:"isBinary"`
}

// blobsQuery reads the content of n blobs, by the SHAs $b0 to $b<n-1>, in one
// GraphQL query, each answered under its own alias.
func blobsQuery(n int) string {
	var vars, fields strings.Builder
	for i := range n {
		b := "b" + strconv.Itoa(i)
		fmt.Fprintf(&vars, ", $%s: GitObjectID!", b)
		fmt.Fprintf(&fields, "    %s: object(oid: $%s) { ... on Blob { text isTruncated isBinary } }\n", b, b)
	}
	return "query($owner: String!, $name: String!" + vars.String() + ") {\n  repository(owner: $owner, name: $name) {\n" +
		fields.String() + "  }\n}"
}

// readBlobs adds the files of missing (path → blob SHA) to s, read
// blobsPerQuery at a time. A file GraphQL didn't give the text of, such as a
// large combined list, is read from its blob.
func (c *Client) readBlobs(ctx context.Context, t target, s *snapshot, missing map[string]string) *PublishError {
	paths := slices.Sorted(maps.Keys(missing))
	for batch := range slices.Chunk(paths, blobsPerQuery) {
		if perr := c.readBlobBatch(ctx, t, s, missing, batch); perr != nil {
			return perr
		}
	}
	return nil
}

// readBlobBatch adds the files at paths, whose blob SHAs are in missing, to s,
// read in one query.
func (c *Client) readBlobBatch(ctx context.Context, t target, s *snapshot, missing map[string]string, paths []string) *PublishError {
	vars := map[string]any{"owner": t.owner, "name": t.name}
	for i, p := range paths {
		vars["b"+strconv.Itoa(i)] = missing[p]
	}
	var answer struct {
		Repository map[string]blobAnswer `json:"repository"`
	}
	if perr := c.graphql(ctx, t, blobsQuery(len(paths)), vars, &answer, "reading the photo data"); perr != nil {
		return perr
	}
	for i, p := range paths {
		s.files[p] = c.blobFile(ctx, t, missing[p], answer.Repository["b"+strconv.Itoa(i)])
	}
	return nil
}

// blobFile is the file with blob SHA sha, from its answer in blobsQuery.
func (c *Client) blobFile(ctx context.Context, t target, sha string, b blobAnswer) snapFile {
	f := snapFile{sha: sha}
	switch {
	case b != nil && b.IsBinary:
		f.err = "The file isn't text."
	case b == nil || b.Text == nil || b.IsTruncated:
		f.content, f.err = c.readBlobContent(ctx, t, sha)
	default:
		f.content = []byte(*b.Text)
	}
	return f
}
