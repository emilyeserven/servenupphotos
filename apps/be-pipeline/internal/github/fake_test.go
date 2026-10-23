package github

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"
)

const token = "github_pat_abcdefgh1234"

// fakeGitHub is an in-memory owner/repo with default branch main: the GraphQL
// queries state and snapshot make, and the Git data API calls Commit makes.
// Every request is counted in calls, as "graphql state", "graphql snapshot"
// or "METHOD /path".
type fakeGitHub struct {
	mu sync.Mutex
	// files are every branch's files, as "branch:path" → content.
	files map[string]string
	// versions are each branch's number of commits, which its head's ID
	// names.
	versions map[string]int
	pulls    []fakePull
	trees    map[string]fakeTree
	commits  map[string]fakeCommit
	calls    []string
	// messages are the messages of the commits branches were moved to.
	messages []string
	// fail answers the call with this key with a status instead.
	fail map[string]int
	// truncated are paths GraphQL leaves the text out of, as it does for
	// large files.
	truncated map[string]bool
	// limited answers every request as rate limited.
	limited bool
	// created are when each path was first committed, as RFC 3339, for the
	// history query; a path without one has no commits.
	created map[string]string
}

type fakePull struct {
	number              int
	title, branch, base string
}

type fakeTree struct {
	base    string // branch
	entries []map[string]any
}

type fakeCommit struct {
	tree, parent, message string
}

func newFakeGitHub(t *testing.T) (*fakeGitHub, *Client) {
	t.Helper()
	f := &fakeGitHub{
		files: map[string]string{}, versions: map[string]int{"main": 1}, trees: map[string]fakeTree{},
		commits: map[string]fakeCommit{}, fail: map[string]int{}, truncated: map[string]bool{},
		created: map[string]string{},
	}
	srv := httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(srv.Close)
	now := time.Date(2026, 10, 15, 2, 45, 0, 0, time.UTC)
	return f, &Client{BaseURL: srv.URL, Client: srv.Client(), Now: func() time.Time { return now }}
}

// openPull opens the photo data pull request from branch, made from main
// with files added.
func (f *fakeGitHub) openPull(branch string, files map[string]string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for k, v := range f.files {
		if p, ok := strings.CutPrefix(k, "main:"); ok {
			f.files[branch+":"+p] = v
		}
	}
	for p, v := range files {
		f.files[branch+":"+p] = v
	}
	f.versions[branch] = 1
	f.pulls = append(f.pulls, fakePull{number: len(f.pulls) + 1, title: PullRequestTitle, branch: branch, base: "main"})
}

// count is how many calls had key.
func (f *fakeGitHub) count(key string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for _, c := range f.calls {
		if c == key {
			n++
		}
	}
	return n
}

// writes are the calls that changed something on GitHub.
func (f *fakeGitHub) writes() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for _, c := range f.calls {
		if !strings.HasPrefix(c, "GET ") && !strings.HasPrefix(c, "graphql ") {
			out = append(out, c)
		}
	}
	return out
}

func (f *fakeGitHub) file(branch, path string) (string, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.files[branch+":"+path]
	return v, ok
}

func (f *fakeGitHub) head(branch string) string {
	return branch + "@" + strconv.Itoa(f.versions[branch])
}

func branchOf(oid string) string {
	return oid[:strings.LastIndex(oid, "@")]
}

func (f *fakeGitHub) serve(w http.ResponseWriter, r *http.Request) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r.Header.Get("Authorization") != "Bearer "+token {
		w.WriteHeader(http.StatusUnauthorized)
		return
	}
	if f.limited {
		w.Header().Set("X-RateLimit-Remaining", "0")
		w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(23*time.Minute).Unix(), 10))
		w.WriteHeader(http.StatusForbidden)
		return
	}
	if r.URL.Path == "/graphql" {
		f.graphql(w, r)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/repos/owner/repo")
	key := r.Method + " " + path
	if strings.HasPrefix(path, "/git/refs/heads/") {
		key = r.Method + " /git/refs/heads/"
	}
	f.calls = append(f.calls, key)
	if status := f.fail[key]; status != 0 {
		w.WriteHeader(status)
		return
	}
	var in map[string]any
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&in)
	}
	switch {
	case path == "" && r.Method == http.MethodGet:
		writeBody(w, http.StatusOK, map[string]any{"full_name": "owner/repo", "default_branch": "main"})
	case strings.HasPrefix(path, "/git/blobs/"):
		f.blob(w, strings.TrimPrefix(path, "/git/blobs/"))
	case path == "/git/trees" && r.Method == http.MethodPost:
		id := "tree-" + strconv.Itoa(len(f.trees)+1)
		var entries []map[string]any
		for _, e := range in["tree"].([]any) {
			entries = append(entries, e.(map[string]any))
		}
		f.trees[id] = fakeTree{base: branchOf(strings.TrimPrefix(in["base_tree"].(string), "tree:")), entries: entries}
		writeBody(w, http.StatusCreated, map[string]any{"sha": id})
	case path == "/git/commits" && r.Method == http.MethodPost:
		id := "commit-" + strconv.Itoa(len(f.commits)+1)
		parents := in["parents"].([]any)
		f.commits[id] = fakeCommit{tree: in["tree"].(string), parent: parents[0].(string), message: in["message"].(string)}
		writeBody(w, http.StatusCreated, map[string]any{"sha": id, "html_url": "https://github.com/owner/repo/commit/" + id})
	case strings.HasPrefix(path, "/git/refs/heads/") && r.Method == http.MethodPatch:
		branch := strings.TrimPrefix(path, "/git/refs/heads/")
		commit := f.commits[in["sha"].(string)]
		if commit.parent != f.head(branch) {
			w.WriteHeader(http.StatusUnprocessableEntity)
			return
		}
		f.apply(branch, commit)
		writeBody(w, http.StatusOK, map[string]any{})
	case path == "/git/refs" && r.Method == http.MethodPost:
		branch := strings.TrimPrefix(in["ref"].(string), "refs/heads/")
		f.versions[branch] = 0
		f.apply(branch, f.commits[in["sha"].(string)])
		writeBody(w, http.StatusCreated, map[string]any{})
	case path == "/pulls" && r.Method == http.MethodPost:
		n := len(f.pulls) + 1
		f.pulls = append(f.pulls, fakePull{number: n, title: in["title"].(string), branch: in["head"].(string), base: in["base"].(string)})
		writeBody(w, http.StatusCreated, map[string]any{"number": n, "html_url": "https://github.com/owner/repo/pull/" + strconv.Itoa(n)})
	case strings.HasPrefix(path, "/branches/"):
		if _, ok := f.versions[strings.TrimPrefix(path, "/branches/")]; !ok {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		writeBody(w, http.StatusOK, map[string]any{})
	default:
		w.WriteHeader(http.StatusNotFound)
	}
}

// apply sets branch's files to commit's tree: its base branch's files with
// the tree's entries made over them.
func (f *fakeGitHub) apply(branch string, commit fakeCommit) {
	tree := f.trees[commit.tree]
	next := map[string]string{}
	for k, v := range f.files {
		if p, ok := strings.CutPrefix(k, tree.base+":"); ok {
			next[p] = v
		}
	}
	for _, e := range tree.entries {
		p := e["path"].(string)
		if content, ok := e["content"].(string); ok {
			next[p] = content
		} else {
			delete(next, p)
		}
	}
	for k := range f.files {
		if strings.HasPrefix(k, branch+":") {
			delete(f.files, k)
		}
	}
	for p, v := range next {
		f.files[branch+":"+p] = v
	}
	f.versions[branch]++
	f.messages = append(f.messages, commit.message)
}

func (f *fakeGitHub) blob(w http.ResponseWriter, sha string) {
	for _, v := range f.files {
		if blobSHA([]byte(v)) == sha {
			writeBody(w, http.StatusOK, map[string]any{"encoding": "base64", "content": base64.StdEncoding.EncodeToString([]byte(v))})
			return
		}
	}
	w.WriteHeader(http.StatusNotFound)
}

func (f *fakeGitHub) graphql(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Query     string         `json:"query"`
		Variables map[string]any `json:"variables"`
	}
	_ = json.NewDecoder(r.Body).Decode(&in)
	kind := "snapshot"
	switch {
	case strings.Contains(in.Query, "pullRequests"):
		kind = "state"
	case strings.Contains(in.Query, "history("):
		kind = "history"
	}
	f.calls = append(f.calls, "graphql "+kind)
	if status := f.fail["graphql "+kind]; status != 0 {
		w.WriteHeader(status)
		return
	}
	if in.Variables["owner"] != "owner" || in.Variables["name"] != "repo" {
		writeBody(w, http.StatusOK, map[string]any{"data": map[string]any{"repository": nil},
			"errors": []map[string]any{{"type": "NOT_FOUND", "message": "Could not resolve to a Repository."}}})
		return
	}
	if kind == "state" {
		writeBody(w, http.StatusOK, map[string]any{"data": map[string]any{"repository": f.state(in.Variables)}})
		return
	}
	if kind == "history" {
		writeBody(w, http.StatusOK, map[string]any{"data": map[string]any{"repository": f.history(in.Variables)}})
		return
	}
	repo := map[string]any{"commit": map[string]any{"tree": map[string]any{"oid": "tree:" + in.Variables["commit"].(string)}}}
	for _, alias := range []string{"photos", "albums", "tags", "places", "localizations", "metainfo"} {
		repo[alias] = f.tree(in.Variables[alias].(string))
	}
	writeBody(w, http.StatusOK, map[string]any{"data": map[string]any{"repository": repo}})
}

// history answers the history query: a later edit, then the commit that
// created each path in created, newest first as GitHub lists them.
func (f *fakeGitHub) history(vars map[string]any) map[string]any {
	object := map[string]any{}
	for i := 0; ; i++ {
		p, ok := vars["p"+strconv.Itoa(i)].(string)
		if !ok {
			break
		}
		nodes := []map[string]any{}
		if created, ok := f.created[p]; ok {
			nodes = append(nodes, map[string]any{"committedDate": "2030-01-01T00:00:00Z"},
				map[string]any{"committedDate": created})
		}
		object["f"+strconv.Itoa(i)] = map[string]any{"nodes": nodes}
	}
	return map[string]any{"object": object}
}

func (f *fakeGitHub) state(vars map[string]any) map[string]any {
	var nodes []map[string]any
	for _, pr := range f.pulls {
		nodes = append(nodes, map[string]any{
			"number": pr.number, "title": pr.title, "url": "https://github.com/owner/repo/pull/" + strconv.Itoa(pr.number),
			"headRefName": pr.branch, "headRefOid": f.head(pr.branch), "baseRefName": pr.base,
		})
	}
	repo := map[string]any{
		"nameWithOwner":    "owner/repo",
		"defaultBranchRef": map[string]any{"name": "main", "target": map[string]any{"oid": f.head("main")}},
		"pullRequests":     map[string]any{"nodes": nodes},
	}
	if vars["hasBase"] == true {
		branch := strings.TrimPrefix(vars["base"].(string), "refs/heads/")
		repo["ref"] = nil
		if _, ok := f.versions[branch]; ok {
			repo["ref"] = map[string]any{"target": map[string]any{"oid": f.head(branch)}}
		}
	}
	return repo
}

// tree answers an expression "<oid>:<folder>" with the folder's files on the
// oid's branch, or nil when it has none.
func (f *fakeGitHub) tree(expr string) any {
	oid, folder, _ := strings.Cut(expr, ":")
	prefix := branchOf(oid) + ":" + folder + "/"
	var names []string
	for k := range f.files {
		if name, ok := strings.CutPrefix(k, prefix); ok && !strings.Contains(name, "/") {
			names = append(names, name)
		}
	}
	if names == nil {
		return nil
	}
	sort.Strings(names)
	entries := []map[string]any{}
	for _, name := range names {
		content := f.files[prefix+name]
		object := map[string]any{"text": content, "isTruncated": false, "isBinary": false}
		if f.truncated[folder+"/"+name] {
			object = map[string]any{"text": nil, "isTruncated": true, "isBinary": false}
		}
		entries = append(entries, map[string]any{"name": name, "type": "blob", "oid": blobSHA([]byte(content)), "object": object})
	}
	return map[string]any{"entries": entries}
}

func writeBody(w http.ResponseWriter, status int, body any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func ptr(s string) *string { return &s }

func ref[T any](v T) *T { return &v }
