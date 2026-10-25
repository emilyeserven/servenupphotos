package httpapi

import (
	"net/http"
	"sync"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
)

// readProgress keeps how far each Update Data read has got, by task (such as
// "colors"), so the page can ask while the read runs.
type readProgress struct {
	mu     sync.Mutex
	byTask map[string]taskProgress
}

// taskProgress is how far a task's read has got; Running is false when none
// is running.
type taskProgress struct {
	Running bool `json:"running"`
	github.Progress
}

func newReadProgress() *readProgress {
	return &readProgress{byTask: map[string]taskProgress{}}
}

func (p *readProgress) set(task string, tp taskProgress) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.byTask[task] = tp
}

func (p *readProgress) get(task string) taskProgress {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.byTask[task]
}

// tracked runs next with its progress kept as task's, from reading the photo
// files from GitHub until it answers.
func (p *readProgress) tracked(task string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		report := func(pr github.Progress) { p.set(task, taskProgress{Running: true, Progress: pr}) }
		report(github.Progress{Step: github.ProgressGitHub})
		defer p.set(task, taskProgress{})
		next(w, r.WithContext(github.WithProgress(r.Context(), report)))
	}
}

// handleReadProgress answers how far the task in the path has got.
func handleReadProgress(p *readProgress) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, p.get(r.PathValue("task")))
	}
}
