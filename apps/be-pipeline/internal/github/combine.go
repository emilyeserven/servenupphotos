package github

import (
	"context"
	"net/http"
	"net/url"
	"regexp"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// CombineWorkflowFile is the workflow that rebuilds AllPhotosFile on the
// photo data pull request after each push to it.
const CombineWorkflowFile = "combine-photo-data.yml"

// Combine run states, from first to last.
const (
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
	SHA     string `json:"sha"`
	State   string `json:"state"`
	RunURL  string `json:"runUrl,omitempty"`
	Message string `json:"message,omitempty"`
}

// shaPattern matches a full or abbreviated commit SHA.
var shaPattern = regexp.MustCompile(`^[0-9a-f]{7,40}$`)

// workflowRun is the part of a listed workflow run Combine uses.
type workflowRun struct {
	Status     string `json:"status"`
	Conclusion string `json:"conclusion"`
	HTMLURL    string `json:"html_url"`
}

// Combine reports the CombineWorkflowFile run for commit sha in gh's
// repository, or for the head of the open pull request titled
// PullRequestTitle when sha is "". It only reads from GitHub.
func (c *Client) Combine(ctx context.Context, gh settings.GitHub, sha string) (CombineStatus, error) {
	owner, name, ok := splitRepo(gh.Repo)
	if !ok || gh.Token == "" {
		return CombineStatus{}, publishErr(http.StatusBadRequest, "Set the GitHub repository and token in Settings first.")
	}
	if sha != "" && !shaPattern.MatchString(sha) {
		return CombineStatus{}, publishErr(http.StatusBadRequest, "sha should be a commit SHA.")
	}
	t := target{owner: owner, name: name, token: gh.Token}
	if sha == "" {
		pr, perr := c.findInFlightPull(ctx, t)
		if perr != nil {
			return CombineStatus{}, perr
		}
		if pr == nil {
			return CombineStatus{}, publishErr(http.StatusNotFound, "No pull request titled %q is open.", PullRequestTitle)
		}
		sha = pr.Head.SHA
	}

	query := url.Values{"head_sha": {sha}, "per_page": {"10"}}
	p := repoPath(owner, name) + "/actions/workflows/" + CombineWorkflowFile + "/runs?" + query.Encode()
	var out struct {
		Runs []workflowRun `json:"workflow_runs"`
	}
	res, err := c.do(ctx, http.MethodGet, p, gh.Token, nil, &out)
	if err == nil && (res.Status == http.StatusForbidden || res.Status == http.StatusNotFound) && !isRateLimited(res) {
		return CombineStatus{SHA: sha, State: CombineUnavailable,
			Message: "The token can't read Actions runs. Give it Actions read access to see when ALLPHOTOS.json is rebuilt."}, nil
	}
	if perr := check(res, err, "reading the workflow runs"); perr != nil {
		return CombineStatus{}, perr
	}
	return combineStatus(sha, out.Runs), nil
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
