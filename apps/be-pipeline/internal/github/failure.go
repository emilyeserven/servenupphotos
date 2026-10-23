package github

import (
	"encoding/json"
	"strings"
)

// Failure is what GitHub answered to a call that failed, kept so the
// page can show it whole: which step of the work it was, the request, the
// status, GitHub's message and its list of errors.
//
// > Frontend analogy: it's the Network tab's entry for the failed fetch,
// passed along instead of being boiled down to "something went wrong".
type Failure struct {
	// Step is what the call was for, such as "saving the changed files".
	Step string `json:"step"`
	// Method and Path are the request, such as POST /repos/o/r/git/trees.
	Method string `json:"method"`
	Path   string `json:"path"`
	// Status is GitHub's HTTP status, such as 422.
	Status int `json:"status"`
	// Message is GitHub's message, such as "Validation Failed".
	Message string `json:"message,omitempty"`
	// Errors is GitHub's list of what failed validation, as GitHub sent it.
	Errors []json.RawMessage `json:"errors,omitempty"`
	// DocumentationURL is the GitHub docs page GitHub pointed to.
	DocumentationURL string `json:"documentationUrl,omitempty"`
	// RequestID is GitHub's X-GitHub-Request-Id, which GitHub support asks for.
	RequestID string `json:"requestId,omitempty"`
	// Body is the start of GitHub's answer, when it wasn't JSON.
	Body string `json:"body,omitempty"`
}

// githubAnswer is the body of a failed GitHub REST call.
type githubAnswer struct {
	Message          string            `json:"message"`
	Errors           []json.RawMessage `json:"errors"`
	DocumentationURL string            `json:"documentation_url"`
}

// failureOf is res, a failed call made while doing, as a Failure.
func failureOf(res response, doing string) *Failure {
	f := &Failure{Step: doing, Method: res.Method, Path: res.Path, Status: res.Status}
	if res.Header != nil {
		f.RequestID = res.Header.Get("X-GitHub-Request-Id")
	}
	var answer githubAnswer
	if err := json.Unmarshal([]byte(res.Body), &answer); err != nil {
		f.Body = strings.TrimSpace(res.Body)
		return f
	}
	f.Message, f.Errors, f.DocumentationURL = answer.Message, answer.Errors, answer.DocumentationURL
	return f
}

// githubSaid is GitHub's message for res in brackets and quotes, or "" when it has none.
func githubSaid(res response) string {
	var answer githubAnswer
	if json.Unmarshal([]byte(res.Body), &answer) != nil || answer.Message == "" {
		return ""
	}
	return ` ("` + answer.Message + `")`
}
