package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
)

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// writePublishError responds with perr's message and, when a GitHub call
// failed, GitHub's own answer, so the page can show what went wrong.
func writePublishError(w http.ResponseWriter, perr *github.PublishError) {
	if perr.GitHub != nil {
		slog.Warn("github call failed", "step", perr.GitHub.Step, "method", perr.GitHub.Method, "path", perr.GitHub.Path,
			"status", perr.GitHub.Status, "message", perr.GitHub.Message, "requestId", perr.GitHub.RequestID)
	}
	writeJSON(w, perr.Status, publishErrorBody{Message: perr.Message, GitHub: perr.GitHub})
}

// publishErrorBody is the answer to a request that failed with a
// PublishError.
type publishErrorBody struct {
	Message string          `json:"message"`
	GitHub  *github.Failure `json:"github,omitempty"`
}
