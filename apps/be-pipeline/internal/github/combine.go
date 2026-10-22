package github

import (
	"context"
	"net/http"
	"net/url"
	"regexp"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombineWorkflowFile is the workflow that rebuilds AllPhotosFile, and each
// Kind's AllFile, on the photo data pull request. It only runs when Rebuild
// starts it, not on each push.
const CombineWorkflowFile = "combine-photo-data.yml"

// Combine run states, from first to last.
const (
	// CombineStale means the pull request's head was pushed after the last
	// rebuild, so AllPhotosFile may be missing its changes until Rebuild
	// starts another run.
	CombineStale = "stale"
	// CombineWaiting means GitHub hasn't started a run for the commit yet.
	CombineWaiting = "waiting"
	CombineRunning = "running"
	// CombineDone means the run finished without failing, so AllPhotosFile is
	// up to date with the commit.
	CombineDone   = "done"
	CombineFailed = "failed"
	// CombineUnavailable means the runs couldn't be read, usually because the
	// token lacks Actions read access; Message says why.
	CombineUnavailable = "unavailable"
)

// CombineStatus is where the CombineWorkflowFile run for one commit is.
type CombineStatus struct {
	// SHA is the commit the run is for.
	SHA    string `json:"sha"`
	State  string `json:"state"`
	RunURL string `json:"runUrl,omitempty"`
	// RunsURL is the workflow's runs page on GitHub, to link to when RunURL
	// is unknown, such as before GitHub starts the run.
	RunsURL string `json:"runsUrl"`
	Message string `json:"message,omitempty"`
}

// shaPattern matches a full or abbreviated commit SHA.
var shaPattern = regexp.MustCompile(`^[0-9a-f]{7,40}$`)

// workflowRun is the part of a listed workflow run Combine uses.
type workflowRun struct {
	HeadSHA    string `json:"head_sha"`
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	HTMLURL    string `json:"html_url"`
}

// combineBot is the author of the commits CombineWorkflowFile pushes. Its
// pushes use the workflow's own token, so they don't start another run.
const combineBot = "github-actions[bot]"

// Combine reports the CombineWorkflowFile run Rebuild started at commit sha
// in gh's repository. When sha is "", it reports whether AllPhotosFile is up
// to date on the open pull request titled PullRequestTitle: the newest run on
// its branch, or stale when its head was pushed after that run by someone
// other than the workflow itself. It only reads from GitHub.
func (c *Client) Combine(ctx context.Context, gh settings.GitHub, sha string) (CombineStatus, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return CombineStatus{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	if sha != "" && !shaPattern.MatchString(sha) {
		return CombineStatus{}, publishErr(http.StatusBadRequest, "sha should be a commit SHA.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	status, err := c.combine(ctx, t, sha)
	if err == nil {
		status.RunsURL = "https://github.com/" + owner + "/" + name + "/actions/workflows/" + CombineWorkflowFile
	}
	return status, err
}

// combine is Combine for t, without RunsURL.
func (c *Client) combine(ctx context.Context, t target, sha string) (CombineStatus, error) {
	if sha != "" {
		runs, perr := c.combineRuns(ctx, t, url.Values{"head_sha": {sha}, "event": {"workflow_dispatch"}})
		if perr != nil {
			return unavailableOr(sha, perr)
		}
		return combineStatus(sha, runs), nil
	}

	pr, perr := c.findInFlightPull(ctx, t)
	if perr != nil {
		return CombineStatus{}, perr
	}
	if pr == nil {
		return CombineStatus{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
	}
	return c.combinePull(ctx, t, pr)
}

// combinePull is Combine for the head of pr.
func (c *Client) combinePull(ctx context.Context, t target, pr *inFlightPull) (CombineStatus, error) {
	head := pr.Head.SHA
	runs, perr := c.combineRuns(ctx, t, url.Values{"branch": {pr.Head.Ref}})
	if perr != nil {
		return unavailableOr(head, perr)
	}
	if len(runs) > 0 && (runs[0].Status != "completed" || runs[0].HeadSHA == head) {
		return combineStatus(head, runs), nil
	}
	// The head is newer than the last run: either the workflow's own commit,
	// or a push that nothing has rebuilt from yet.
	byBot, perr := c.committedBy(ctx, t, head, combineBot)
	if perr != nil {
		return CombineStatus{}, perr
	}
	switch {
	case !byBot:
		return CombineStatus{SHA: head, State: CombineStale}, nil
	case len(runs) == 0:
		return CombineStatus{SHA: head, State: CombineDone}, nil
	}
	return combineStatus(head, runs), nil
}

// errNoActions marks a runs listing the token isn't allowed to read.
var errNoActions = publishErr(http.StatusForbidden, "no actions access")

// unavailableOr turns errNoActions into an unavailable status for sha.
func unavailableOr(sha string, perr *PublishError) (CombineStatus, error) {
	if perr != errNoActions {
		return CombineStatus{}, perr
	}
	return CombineStatus{SHA: sha, State: CombineUnavailable,
		Message: "The token can't read Actions runs. Give it Actions read access to see when ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json are rebuilt."}, nil
}

// combineRuns lists the newest CombineWorkflowFile runs matching query, or
// errNoActions when the token can't read them.
func (c *Client) combineRuns(ctx context.Context, t target, query url.Values) ([]workflowRun, *PublishError) {
	query.Set("per_page", "10")
	p := repoPath(t.owner, t.name) + "/actions/workflows/" + CombineWorkflowFile + "/runs?" + query.Encode()
	var out struct {
		Runs []workflowRun `json:"workflow_runs"`
	}
	res, err := c.do(ctx, http.MethodGet, p, t.token, nil, &out)
	if err == nil && (res.Status == http.StatusForbidden || res.Status == http.StatusNotFound) && !isRateLimited(res) {
		return nil, errNoActions
	}
	if perr := check(res, err, "reading the workflow runs"); perr != nil {
		return nil, perr
	}
	return out.Runs, nil
}

// committedBy reports whether login authored commit sha.
func (c *Client) committedBy(ctx context.Context, t target, sha, login string) (bool, *PublishError) {
	var commit struct {
		Author *struct {
			Login string `json:"login"`
		} `json:"author"`
	}
	res, err := c.do(ctx, http.MethodGet, repoPath(t.owner, t.name)+"/commits/"+url.PathEscape(sha), t.token, nil, &commit)
	if perr := readCheck(res, err, "reading the pull request's head commit"); perr != nil {
		return false, perr
	}
	return commit.Author != nil && commit.Author.Login == login, nil
}

// combineStatus summarizes runs, newest first as GitHub lists them.
func combineStatus(sha string, runs []workflowRun) CombineStatus {
	if len(runs) == 0 {
		return CombineStatus{SHA: sha, State: CombineWaiting}
	}
	run := runs[0]
	status := CombineStatus{SHA: sha, RunURL: run.HTMLURL}
	switch {
	case run.Status != "completed":
		status.State = CombineRunning
	// Skipped and neutral runs had nothing to rebuild.
	case run.Conclusion == "success" || run.Conclusion == "skipped" || run.Conclusion == "neutral":
		status.State = CombineDone
	default:
		status.State = CombineFailed
		status.Message = "The Combine photo data run ended with " + run.Conclusion + "."
	}
	return status
}
