package transit

import (
	"cmp"
	"fmt"
	"log/slog"
	"slices"
	"strings"
	"sync"
	"time"
)

// A map that's downloaded once (Japan's rail map, OpenStreetMap's list of
// extracts, or a country's OpenStreetMap rail and bus maps) can take minutes
// to download and read, so each one being loaded is listed with what it's
// doing and how far it has got, for the page to show while its look-up waits
// (see Client.Downloads), and each step is logged. A load that fails stays
// listed for a while with why, so the page can say what went wrong.

// The steps of loading a map, as Download.Step names them.
const (
	// StepChecking is looking for a copy of the map on this computer.
	StepChecking = "checking"
	// StepWaiting is waiting for another download to finish first: one
	// OpenStreetMap extract downloads at a time.
	StepWaiting = "waiting"
	// StepConnecting is asking the server for the file, before it answers.
	StepConnecting = "connecting"
	// StepDownloading is downloading the file.
	StepDownloading = "downloading"
	// StepReading is reading the file downloaded, or the copy on this
	// computer, into the map.
	StepReading = "reading"
	// StepSaving is writing what was read to this computer.
	StepSaving = "saving"
	// StepFailed is a load that stopped, with why in Download.Error.
	StepFailed = "failed"
)

// failedKept is how long a failed load stays listed, so the page can still
// show why after its look-up has given up.
const failedKept = 5 * time.Minute

// Download is one map being loaded, as GET /api/transit/downloads lists it.
type Download struct {
	// Map names the map, such as "OpenStreetMap's bus map of South Korea".
	Map string `json:"map"`
	// Step is what it's doing, one of the Step constants.
	Step string `json:"step"`
	// Detail says what it's doing in a sentence, such as "Reading the bus
	// routes (pass 1 of 3)".
	Detail string `json:"detail"`
	// URL is the file being downloaded; "" before it's asked for.
	URL string `json:"url,omitempty"`
	// Bytes is how much of the file has been downloaded, or read while
	// reading; Total is its size, 0 while it isn't known.
	Bytes int64 `json:"bytes"`
	Total int64 `json:"total,omitempty"`
	// Rate is how fast the step has gone so far, in bytes a second; 0 when
	// it isn't one that moves bytes.
	Rate int64 `json:"rate,omitempty"`
	// Seconds is how long the whole load has taken so far, and StepSeconds
	// how long its step has.
	Seconds     int `json:"seconds"`
	StepSeconds int `json:"stepSeconds"`
	// Error is why it failed, when Step is StepFailed.
	Error string `json:"error,omitempty"`
}

// mapProgress lists the maps being loaded, by key.
type mapProgress struct {
	mu      sync.Mutex
	running map[string]*progress
}

// progress is how far one map's load has got. A nil progress tracks nothing,
// so code that loads a map can report to it without checking.
type progress struct {
	mu        sync.Mutex
	name      string
	step      string
	detail    string
	url       string
	bytes     int64
	total     int64
	start     time.Time
	stepStart time.Time
	err       string
	ended     time.Time
}

// begin lists the map named name, kept as key, as loading, looking for a copy
// on this computer until told otherwise.
func (m *mapProgress) begin(key, name string) *progress {
	now := time.Now()
	p := &progress{name: name, start: now}
	p.setStep(StepChecking, "Looking for a copy saved on this computer")
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.running == nil {
		m.running = map[string]*progress{}
	}
	m.running[key] = p
	return p
}

// end takes the map kept as key off the list once it's loaded, or, when err
// says it failed, keeps it listed for failedKept with why.
func (m *mapProgress) end(key string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p := m.running[key]
	if p == nil {
		return
	}
	if err == nil {
		slog.Info("map ready", "map", p.name, "took", time.Since(p.start).Round(time.Second))
		delete(m.running, key)
		return
	}
	p.fail(err)
}

// list is every map being loaded, and those that failed lately, the one that
// started first first.
func (m *mapProgress) list() []Download {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Download, 0, len(m.running))
	for key, p := range m.running {
		if p.expired() {
			delete(m.running, key)
			continue
		}
		out = append(out, p.snapshot())
	}
	slices.SortFunc(out, func(a, b Download) int {
		return cmp.Or(cmp.Compare(b.Seconds, a.Seconds), cmp.Compare(a.Map, b.Map))
	})
	return out
}

// snapshot is how far p has got now.
func (p *progress) snapshot() Download {
	p.mu.Lock()
	defer p.mu.Unlock()
	now := time.Now()
	if !p.ended.IsZero() {
		now = p.ended
	}
	d := Download{
		Map: p.name, Step: p.step, Detail: p.detail, URL: p.url, Bytes: p.bytes, Total: p.total,
		Seconds: int(now.Sub(p.start).Seconds()), StepSeconds: int(now.Sub(p.stepStart).Seconds()), Error: p.err,
	}
	if elapsed := now.Sub(p.stepStart).Seconds(); (p.step == StepDownloading || p.step == StepReading) && elapsed >= 1 {
		d.Rate = int64(float64(p.bytes) / elapsed)
	}
	return d
}

// expired reports whether p failed longer than failedKept ago.
func (p *progress) expired() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return !p.ended.IsZero() && time.Since(p.ended) > failedKept
}

// setStep moves p on to step, saying what it's doing in detail, and logs it.
func (p *progress) setStep(step, detail string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.step, p.detail, p.stepStart, p.bytes, p.total = step, detail, time.Now(), 0, 0
	slog.Info("map load", "map", p.name, "step", step, "detail", detail)
}

// connecting starts asking url for a file.
func (p *progress) connecting(url string) {
	if p == nil {
		return
	}
	p.setStep(StepConnecting, "Asking "+hostOf(url)+" for the file")
	p.mu.Lock()
	defer p.mu.Unlock()
	p.url = url
}

// downloading starts downloading a file of total bytes, 0 when not known.
func (p *progress) downloading(total int64) {
	if p == nil {
		return
	}
	p.setStep(StepDownloading, "Downloading the file from "+hostOf(p.url))
	p.mu.Lock()
	defer p.mu.Unlock()
	p.total = max(total, 0)
}

// reading starts reading a file of total bytes, saying what it reads in
// detail; Write counts what's read.
func (p *progress) reading(detail string, total int64) {
	if p == nil {
		return
	}
	p.setStep(StepReading, detail)
	p.mu.Lock()
	defer p.mu.Unlock()
	p.total = max(total, 0)
}

// fail marks p as stopped by err.
func (p *progress) fail(err error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	slog.Warn("map load failed", "map", p.name, "step", p.step, "err", err)
	p.detail = "Stopped while: " + p.detail
	p.step, p.err, p.ended = StepFailed, err.Error(), time.Now()
}

// Write counts b as downloaded or read, so a file can be copied or read
// through p.
func (p *progress) Write(b []byte) (int, error) {
	if p == nil {
		return len(b), nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bytes += int64(len(b))
	return len(b), nil
}

// sizeText is a size in bytes as megabytes, such as "312 MB", or kilobytes
// under one megabyte.
func sizeText(bytes int64) string {
	if bytes < 1<<20 {
		return fmt.Sprintf("%d KB", (bytes+1023)>>10)
	}
	return fmt.Sprintf("%d MB", bytes>>20)
}

// hostOf is url's server, such as "download.geofabrik.de", for saying where a
// file comes from.
func hostOf(url string) string {
	_, rest, found := strings.Cut(url, "://")
	if !found {
		return url
	}
	host, _, _ := strings.Cut(rest, "/")
	return host
}

// Downloads are the maps being downloaded or read now, and those that failed
// lately, each with what it's doing and how far it has got, for the page to
// show while a look-up waits for one.
func (c *Client) Downloads() []Download {
	return c.progress.list()
}
