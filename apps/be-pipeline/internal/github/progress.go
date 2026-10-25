package github

import (
	"context"
	"sync"
	"sync/atomic"
)

// Progress steps: what an Update Data read is doing.
const (
	// ProgressGitHub is reading the photo files from GitHub, one query with no count.
	ProgressGitHub = "github"
	// ProgressHistory is asking GitHub when the photo files were created, a
	// batch of files at a time.
	ProgressHistory = "history"
	// ProgressR2 is reading the photos' originals in R2, one photo at a time.
	ProgressR2 = "r2"
)

// Progress is how far an Update Data read has got: Done of Total in Step.
// Total is 0 when the step can't be counted.
type Progress struct {
	Step  string `json:"step"`
	Done  int    `json:"done"`
	Total int    `json:"total"`
}

// ProgressFunc is told each time a read moves on.
type ProgressFunc func(Progress)

type progressKey struct{}

// WithProgress is ctx with report told how a read under it moves on.
func WithProgress(ctx context.Context, report ProgressFunc) context.Context {
	return context.WithValue(ctx, progressKey{}, report)
}

// reportProgress tells ctx's ProgressFunc, when it has one, that step is at
// done of total.
func reportProgress(ctx context.Context, step string, done, total int) {
	if report, ok := ctx.Value(progressKey{}).(ProgressFunc); ok {
		report(Progress{Step: step, Done: done, Total: total})
	}
}

// readOriginals runs reads, each of one photo's original in R2, a few at a
// time, reporting ProgressR2 as each finishes.
func readOriginals(ctx context.Context, reads []func()) {
	progress := startProgress(ctx, ProgressR2, len(reads))
	var wg sync.WaitGroup
	sem := make(chan struct{}, exifConcurrency)
	for _, read := range reads {
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()
			read()
			progress.add()
		}()
	}
	wg.Wait()
}

// progressCounter counts the reads of a step that run a few at a time.
type progressCounter struct {
	ctx   context.Context
	step  string
	total int
	done  atomic.Int64
}

// startProgress reports step at 0 of total and returns its counter.
func startProgress(ctx context.Context, step string, total int) *progressCounter {
	reportProgress(ctx, step, 0, total)
	return &progressCounter{ctx: ctx, step: step, total: total}
}

// add counts one more read done.
func (p *progressCounter) add() { p.addN(1) }

// addN counts n more reads done, such as a batch of files.
func (p *progressCounter) addN(n int) {
	reportProgress(p.ctx, p.step, int(p.done.Add(int64(n))), p.total)
}
