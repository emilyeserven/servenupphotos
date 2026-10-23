package github

import (
	"net/http"
	"testing"
)

// TestCheckKeepsGitHubsAnswer expects a failed call's error to carry GitHub's
// whole answer: the step, the request, the status, the message, the errors
// and the request ID.
func TestCheckKeepsGitHubsAnswer(t *testing.T) {
	res := response{
		Method: http.MethodPost, Path: "/repos/o/r/git/trees", Status: http.StatusUnprocessableEntity,
		Header: http.Header{"X-Github-Request-Id": {"ABCD:1234"}},
		Body: `{"message":"Validation Failed","errors":[{"resource":"Tree","code":"invalid"}],` +
			`"documentation_url":"https://docs.github.com/rest/git/trees"}`,
	}
	perr := check(res, nil, "saving the changed files")
	want := `GitHub responded 422 when saving the changed files ("Validation Failed").`
	if perr == nil || perr.Message != want {
		t.Fatalf("check() = %v, want %q", perr, want)
	}
	f := perr.GitHub
	if f == nil || f.Step != "saving the changed files" || f.Method != http.MethodPost || f.Path != res.Path ||
		f.Status != 422 || f.Message != "Validation Failed" || f.RequestID != "ABCD:1234" ||
		len(f.Errors) != 1 || f.DocumentationURL != "https://docs.github.com/rest/git/trees" {
		t.Errorf("check().GitHub = %+v", f)
	}
}

// TestCheckKeepsTextAnswer expects an answer that isn't JSON to be kept as
// text.
func TestCheckKeepsTextAnswer(t *testing.T) {
	perr := check(response{Status: http.StatusBadGateway, Body: " upstream down \n"}, nil, "making the commit")
	if perr == nil || perr.GitHub == nil || perr.GitHub.Body != "upstream down" {
		t.Fatalf("check() = %+v, want the text kept", perr)
	}
}
