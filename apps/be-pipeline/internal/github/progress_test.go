package github

import (
	"context"
	"sync"
	"testing"
)

func TestReadOriginalsReportsProgress(t *testing.T) {
	var mu sync.Mutex
	var got []Progress
	ctx := WithProgress(t.Context(), func(p Progress) {
		mu.Lock()
		defer mu.Unlock()
		got = append(got, p)
	})
	ran := 0
	reads := make([]func(), 5)
	for i := range reads {
		reads[i] = func() {
			mu.Lock()
			defer mu.Unlock()
			ran++
		}
	}

	readOriginals(ctx, reads)

	if ran != 5 {
		t.Fatalf("ran %d reads, want 5", ran)
	}
	if len(got) != 6 || got[0] != (Progress{Step: ProgressR2, Total: 5}) {
		t.Fatalf("reported %+v, want 0 of 5 and then one per read", got)
	}
	most := 0
	for _, p := range got {
		most = max(most, p.Done)
	}
	if most != 5 {
		t.Errorf("reported at most %d done, want 5", most)
	}
}

func TestReportProgressWithoutReporter(_ *testing.T) {
	reportProgress(context.Background(), ProgressGitHub, 0, 0)
}
