package throttle

import (
	"context"
	"testing"
	"time"
)

func TestGateSpacesRequests(t *testing.T) {
	g := &Gate{Gap: 30 * time.Millisecond}
	start := time.Now()
	for range 3 {
		if err := g.Wait(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
	if took := time.Since(start); took < 60*time.Millisecond {
		t.Errorf("three requests took %v, want at least two gaps", took)
	}
}

func TestGateStopsWithContext(t *testing.T) {
	g := &Gate{Gap: time.Hour}
	_ = g.Wait(context.Background())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := g.Wait(ctx); err == nil {
		t.Error("Wait after cancel = nil, want an error")
	}
}
