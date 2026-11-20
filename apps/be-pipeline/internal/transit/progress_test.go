package transit

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestFetchToCountsProgress(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(strings.Repeat("x", 1000)))
	}))
	t.Cleanup(srv.Close)
	var m mapProgress
	p := m.begin("k", "Japan's rail map")
	if got := m.list(); len(got) != 1 || got[0].Step != StepChecking {
		t.Fatalf("before = %+v", got)
	}
	if _, err := fetchTo(context.Background(), srv.Client(), srv.URL, io.Discard, p); err != nil {
		t.Fatal(err)
	}
	got := m.list()
	if len(got) != 1 || got[0].Step != StepDownloading || got[0].Bytes != 1000 || got[0].Total != 1000 || got[0].Map != "Japan's rail map" {
		t.Errorf("after = %+v", got)
	}
	m.end("k", nil)
	if got := m.list(); len(got) != 0 {
		t.Errorf("ended = %+v", got)
	}
}

func TestMapLoadsListsWhileLoading(t *testing.T) {
	c := &Client{}
	release := make(chan struct{})
	load := func(p *progress) (*busNet, error) {
		p.setStep(StepReading, "Reading")
		<-release
		return &busNet{}, nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	_, err := c.Buses.get(ctx, &c.progress, "k", "OpenStreetMap's bus map of South Korea", load)
	if !errors.Is(err, ErrMapLoading) {
		t.Fatalf("err = %v, want ErrMapLoading", err)
	}
	if got := c.Downloads(); len(got) != 1 || got[0].Step != StepReading {
		t.Errorf("downloads = %+v", got)
	}
	close(release)
	if _, err := c.Buses.get(context.Background(), &c.progress, "k", "", load); err != nil {
		t.Fatal(err)
	}
	if got := c.Downloads(); len(got) != 0 {
		t.Errorf("downloads after = %+v", got)
	}
}
